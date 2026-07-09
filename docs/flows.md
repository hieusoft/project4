#### Luồng 1: Tạo tài khoản pending, xác thực email, đăng nhập

```mermaid
sequenceDiagram
    participant C as Client
    participant K as Kong
    participant ID as Identity
    participant COM as Communication
    C->>K: POST /api/identity/auth/register (public)
    K->>ID: forward
    ID->>ID: INSERT accounts(status=unverified,email_verified=false)<br/>account_roles(role=USER) + verification token hash
    ID-->>COM: ⇢ email.verification_requested {user_id,email,token,expires_at}
    COM->>COM: gửi email verify link
    Note over ID,COM: Chưa coi là đăng ký thành công cho đến khi email được xác minh
    C->>K: POST /api/identity/auth/verify-email {token}
    K->>ID: forward
    ID->>ID: check token hash + expires → accounts.status=active,email_verified=true<br/>INSERT user_profiles nếu chưa có
    ID-->>COM: ⇢ user.registered + email.verified
    C->>K: POST /api/identity/auth/login
    ID->>ID: verify password → INSERT refresh_tokens
    ID-->>C: access_token (iss=charity-auth, 15p) + refresh_token (7d)
    Note over K: Từ đây mọi route private:<br/>Kong plugin jwt verify chữ ký + exp.<br/>Service chỉ decode payload lấy sub, roles
```

- **Refresh**: `POST /api/identity/auth/refresh` → verify hash trong `refresh_tokens`, rotate (revoke cũ, cấp mới)
- **Quên mật khẩu**: `forgot-password` → publish `password.reset_requested` để Communication gửi link reset; `reset-password` nhận token link.
- **Role lưu ý**: Identity chỉ quản lý role toàn hệ thống (`USER`, `PLATFORM_ADMIN`). Role trong nhóm như `owner/moderator/member` thuộc Community `group_members` và được kiểm tra theo từng group.

#### Luồng 2: Tạo nhóm, xin tham gia, duyệt thành viên

```mermaid
sequenceDiagram
    participant U as User
    participant CM as Community
    participant M as Media
    participant COM as Communication
    participant AD as Admin
    Note over U,M: Upload avatar nhóm trước (luồng 3)
    U->>CM: POST /api/groups {name, province_code, avatar_url}
    CM->>CM: INSERT groups(status=pending, owner_id=user)<br/>INSERT group_members(role=owner, status=approved)
    CM-->>COM: ⇢ group.created → notify Admin duyệt
    AD->>CM: PUT /api/groups/:id/approve → groups.status=active
    CM-->>COM: ⇢ group.approved → notify owner
    Note over U,CM: --- Người khác xin tham gia ---
    U->>CM: POST /api/groups/:id/join {message}
    CM->>CM: INSERT group_join_requests(status=pending)
    CM-->>COM: ⇢ group.join_requested → notify owner + moderators
    Note over CM: Owner/moderator duyệt
    CM->>CM: UPDATE join_request → approved<br/>INSERT group_members(status=approved, joined_at)<br/>groups.member_count +1
    CM-->>COM: ⇢ group.member_approved → notify user
```

Đổi role moderator: `PUT /api/groups/:id/members/:uid/role` (chỉ owner). Kick/ban: cập nhật `group_members.status=banned`.

#### Luồng 3: Upload ảnh (dùng chung mọi nơi)

```mermaid
sequenceDiagram
    participant C as Client
    participant M as Media
    participant R2 as Cloudflare R2
    participant X as Service nghiệp vụ
    C->>M: POST /api/media/presign {mime_type, ref_type}
    M->>M: INSERT media_files(status=temp, bucket_key)
    M-->>C: {media_id, presigned_url, public_url}
    C->>R2: PUT file lên presigned_url (không qua backend)
    C->>M: POST /api/media/confirm {media_id}
    Note over C,X: Client tạo entity (donation/post/listing...)<br/>gửi kèm public_url + media_id
    X->>M: PUT /media/link {media_ids, ref_type, ref_id} (sync, sau khi tạo entity)
    M->>M: UPDATE status=linked, gắn ref_id
    Note over M: Cron mỗi giờ: DELETE file temp > 24h (cả R2 + DB)
```

#### Luồng 4: Quyên góp - từ đăng ký đến nhập kho (luồng lõi 1)

Donor **không cần là member** của nhóm (đã chốt).

```mermaid
sequenceDiagram
    participant D as Donor
    participant AI as AI Service
    participant DON as Donation
    participant CM as Community
    participant COM as Communication
    Note over D,AI: --- Bước hỗ trợ AI (optional) ---
    D->>AI: POST /api/ai/detect-item {image_urls}
    AI-->>D: {name, category_id, condition} gợi ý sẵn form
    D->>AI: POST /api/ai/suggest-groups {mô tả, province}
    AI->>CM: GET groups active theo province (sync)
    AI-->>D: danh sách nhóm phù hợp + lý do
    Note over D,DON: --- Tạo donation ---
    D->>DON: POST /api/donations {group_id, title, items[], pickup_method}
    DON->>CM: verify group tồn tại + status=active (sync)
    DON->>DON: INSERT donations(status=pending, code=DON-xxx)<br/>+ donation_items(status=pending)<br/>+ donation_images(type=declared)
    DON-->>COM: ⇢ donation.created
    COM->>COM: INSERT conversations(type=donor_group,<br/>context=donation, system message đầu tiên)<br/>+ notify moderators nhóm
```

**Nhóm xử lý — 3 bước trạng thái:**

```mermaid
sequenceDiagram
    participant MOD as Moderator
    participant DON as Donation
    participant CM as Community
    participant COM as Communication
    Note over MOD: B1. Duyệt sơ bộ qua ảnh
    MOD->>DON: PUT /api/donations/:id/review {action}
    DON->>CM: verify MOD là owner/moderator của group_id (sync)
    alt Chấp nhận
        DON->>DON: status=accepted
    else Từ chối
        DON->>DON: status=rejected + rejected_reason
    end
    DON-->>COM: ⇢ donation.reviewed → notify donor
    Note over MOD: B2. Hẹn lịch (chốt qua chat trước nếu cần)
    MOD->>DON: PUT /api/donations/:id/schedule {scheduled_at}
    DON->>DON: status=scheduled
    DON-->>COM: ⇢ donation.scheduled<br/>→ notify 2 bên + INSERT scheduled_reminders(remind_at = giờ hẹn - 2h)
    Note over MOD: B3. Nhận đồ thực tế, kiểm tra TỪNG món
    MOD->>DON: PUT /api/donations/:id/items/:itemId/check<br/>{condition_actual, ảnh actual_check, action}
    alt Món dùng được
        DON->>DON: item.status=accepted<br/>CÙNG TRANSACTION: INSERT inventory_items(status=in_stock,<br/>code=ITM-xxx, donor_id) + item_status_histories(null→in_stock)
    else Món hỏng
        DON->>DON: item.status=rejected + reject_reason
    end
    Note over DON: Khi mọi item đã check:<br/>donations.status=completed (hoặc rejected nếu hỏng hết)
    DON-->>COM: ⇢ donation.completed → notify donor<br/>"3/4 món đã nhập kho, 1 món từ chối vì..."
```

Điểm quan trọng: check → nhập kho là **một transaction nội bộ** Donation Service (Donation + Inventory chung DB), không có rủi ro mất đồng bộ.

#### Luồng 5: Đăng gian hàng 0 đồng (luồng lõi 2)

```mermaid
sequenceDiagram
    participant MOD as Moderator
    participant DON as Donation
    participant AI as AI Service
    participant MKT as Marketplace
    participant COM as Communication
    MOD->>DON: GET /api/inventory?group_id=&status=in_stock (chọn đồ)
    MOD->>AI: POST /api/ai/generate-description {image_url, name, condition}
    AI-->>MOD: mô tả tự sinh (sửa được)
    MOD->>MKT: POST /api/listings {inventory_item_id, title, ...}
    MKT->>DON: GET inventory item (sync) → verify in_stock,<br/>lấy category, condition, group_id
    MKT->>DON: PUT item status=listed (sync) + ghi history
    MKT->>MKT: INSERT listings(status=active,<br/>province_code copy từ group) + listing_images
    MKT-->>AI: ⇢ listing.created → moderation async
    MKT-->>COM: ⇢ listing.created → notify member nhóm "có đồ mới"
    Note over AI: Nếu vi phạm:
    AI-->>MKT: ⇢ ai.moderation_result {verdict=blocked}
    MKT->>MKT: listings.status=blocked → notify admin
```

#### Luồng 6: Đăng ký nhận đồ → xét duyệt → trao tặng (luồng lõi 3)

Receiver **bắt buộc là member approved** của nhóm.

```mermaid
sequenceDiagram
    participant R as Receiver
    participant MKT as Marketplace
    participant CM as Community
    participant DON as Donation
    participant COM as Communication
    R->>MKT: GET /api/listings?category=&province=&group_id= (public, xem tự do)
    R->>MKT: POST /api/requests {listing_id, quantity, reason}
    MKT->>CM: verifyMembership(receiver, group) (sync)<br/>chưa là member → 403 "Tham gia nhóm để nhận"
    MKT->>MKT: check listing active + quantity_available đủ<br/>+ unique index chặn request trùng đang mở
    MKT->>MKT: INSERT item_requests(status=pending, code=REQ-xxx)
    MKT-->>COM: ⇢ request.created → notify moderators
    Note over MKT: --- Moderator xét duyệt ---
    MKT->>MKT: PUT /api/requests/:id/review (verify role qua CM)
    alt Approve
        MKT->>MKT: status=approved<br/>listings.quantity_available -1<br/>hết hàng → listings.status=reserved
        MKT->>DON: PUT item status=reserved (sync) + history
        MKT-->>COM: ⇢ request.approved<br/>→ tạo conversation(receiver↔group) + notify receiver
    else Reject
        MKT->>MKT: status=rejected + reject_reason → notify
    end
    Note over MKT: --- Hẹn lịch nhận ---
    MKT->>MKT: PUT /api/requests/:id/schedule → status=scheduled
    MKT-->>COM: ⇢ request.scheduled → notify + scheduled_reminders
    Note over R: --- Trao tặng ---
    R->>MKT: đến điểm hẹn, mở QR (qr_token từ app)
    MKT->>MKT: moderator quét/confirm:<br/>INSERT delivery_confirmations {qr_token, photo}<br/>status=completed + completed_at
    MKT->>DON: PUT item status=delivered (sync) + history
    MKT-->>COM: ⇢ request.completed → 3 notification:<br/>1. Receiver: "Nhận thành công, hãy đánh giá"<br/>2. DONOR: "Món đồ của bạn đã đến tay người cần" ✨<br/>3. Moderators: cập nhật thống kê nhóm
```

Trường hợp phụ: receiver không đến (`no_show`) hoặc hủy (`cancelled`) → hoàn `quantity_available +1`, item về `in_stock`, listing về `active`.

#### Luồng 7: Chat realtime (shared inbox phía nhóm)

```mermaid
sequenceDiagram
    participant U as Donor/Receiver
    participant WS as Communication (WS :3105)
    participant RD as Redis
    participant CM as Community
    participant AI as AI Service
    participant MOD as Moderator (bất kỳ của nhóm)
    U->>WS: connect Socket.IO + JWT (verify lúc handshake)
    WS->>RD: SET presence:user:{id}, map socket_id
    U->>WS: emit send_message {conversation_id, content}
    WS->>WS: check quyền: user_id khớp conversations.user_id<br/>HOẶC là owner/moderator của conversations.group_id (verify CM, cache Redis 5p)
    WS->>WS: INSERT messages(sender_side=user)<br/>UPDATE conversations.last_message_at/preview
    alt Moderator nào đó online
        WS-->>MOD: emit new_message (room = conversation_id)
    else Tất cả offline
        WS-->>WS: ⇢ message.sent → notification module bắn FCM
    end
    WS-->>AI: ⇢ message.sent → moderate async
    AI-->>WS: verdict=blocked → messages.is_hidden=true + cảnh cáo sender
    Note over MOD: Moderator trả lời: sender_id=moderator thật,<br/>sender_side=group → user thấy tên NHÓM trả lời
```

#### Luồng 8: Đánh giá sau giao dịch

```mermaid
sequenceDiagram
    participant R as Receiver/Donor
    participant CM as Community
    participant MKT as Marketplace
    participant ID as Identity
    Note over R: Sau request.completed / donation.completed,<br/>notification kèm deep-link mời đánh giá
    R->>CM: POST /api/ratings {target_type=group, target_id, context_ref=request_id, score}
    CM->>MKT: verify request completed + receiver đúng người (sync)
    CM->>CM: INSERT ratings (unique rater+context+target chặn rate 2 lần)<br/>tính lại groups.reputation_score (avg)
    CM-->>ID: ⇢ rating.created → user_profiles.reputation_score (nếu target=user)
```

Chiều ngược lại: nhóm đánh giá donor (đồ đúng mô tả không) với `context_ref=donation_id`.

#### Luồng 9: Báo cáo vi phạm → xử lý

```mermaid
sequenceDiagram
    participant U as User
    participant CM as Community
    participant AI as AI Service
    participant AD as Admin
    participant ID as Identity
    U->>CM: POST /api/reports {target_type, target_id, reason, description}
    CM->>CM: INSERT reports(status=pending)
    CM-->>AI: ⇢ report.created
    AI-->>CM: ⇢ severity (low/medium/high) → UPDATE reports.severity<br/>(admin thấy hàng đợi sort theo severity)
    AD->>CM: GET /api/reports?status=pending → xử lý
    alt Vi phạm xác nhận
        CM->>CM: reports.status=resolved + resolution
        opt Khóa tài khoản
            CM-->>ID: ⇢ report.resolved {action=lock_account}<br/>→ accounts.status=locked (+ revoke refresh_tokens)
        end
        opt Đình chỉ nhóm
            CM->>CM: groups.status=suspended
        end
    else Không vi phạm
        CM->>CM: status=dismissed
    end
```

#### Luồng 10: Bài viết trong nhóm (feed)

```mermaid
sequenceDiagram
    participant U as Member
    participant CM as Community
    participant AI as AI Service
    participant COM as Communication
    U->>CM: POST /api/groups/:id/posts {content, type, images}
    CM->>CM: verify membership + quyền theo type:<br/>announcement/call_for_donation → owner/moderator<br/>normal → member (nếu allow_member_post)<br/>require_post_review=true → status=pending_review
    CM->>CM: INSERT posts + post_images
    CM-->>AI: ⇢ post.created → moderate async
    CM-->>COM: ⇢ post.created → notify member trong nhóm (nếu active)
    Note over U: Comment/reaction:
    U->>CM: POST /api/posts/:id/comments | /reactions
    CM->>CM: INSERT + counter denormalize (like_count, comment_count)
    CM-->>COM: ⇢ comment.created → notify tác giả bài
```

#### Luồng 11: Notification + nhắc lịch (chạy ngầm)

```mermaid
sequenceDiagram
    participant MQ as RabbitMQ
    participant COM as Communication
    participant FCM as FCM
    MQ-->>COM: consume MỌI event nghiệp vụ<br/>(donation.*, request.*, group.*, post.*, message.sent)
    COM->>COM: map event → template tiếng Việt<br/>INSERT notifications(user_id, type, ref_type, ref_id)
    COM->>FCM: push tới device_tokens của user (nếu có)
    Note over COM: Cron mỗi 5 phút:
    COM->>COM: SELECT scheduled_reminders WHERE remind_at <= now() AND sent_at IS NULL
    COM->>FCM: "Bạn có lịch hẹn giao/nhận đồ lúc 15h hôm nay"
    COM->>COM: UPDATE sent_at
```

#### Luồng 12: Analytics (module trong Marketplace)

```mermaid
sequenceDiagram
    participant MQ as RabbitMQ
    participant ANA as Marketplace (analytics module)
    participant AD as Admin/Owner
    MQ-->>ANA: consume: user.verified, donation.completed,<br/>listing.created, request.completed, group.member_approved
    ANA->>ANA: UPSERT daily_stats(stat_date, group_id)<br/>+ dòng group_id=NULL cho toàn hệ thống
    AD->>ANA: GET /api/stats/overview | /stats/groups/:id?from=&to= | /stats/monthly
    ANA-->>AD: tổng quyên góp, đã trao, người được giúp, chart theo tháng
```

#### Luồng 13: Hành trình món đồ (minh bạch cho donor)

```mermaid
sequenceDiagram
    participant D as Donor
    participant DON as Donation
    D->>DON: GET /api/inventory/:itemId/history<br/>(verify: inventory_items.donor_id = user)
    DON-->>D: timeline từ item_status_histories + ref
    Note over D: 05/07 Đã kiểm tra & nhập kho (ảnh thực tế)<br/>06/07 Đăng lên gian hàng (link listing)<br/>07/07 Có người đăng ký nhận<br/>08/07 ✅ Đã trao tặng (ảnh xác nhận từ delivery)
```

#### Bảng tổng hợp chuỗi trạng thái xuyên suốt

```text
DONATION:  pending → accepted → scheduled → completed (hoặc rejected/cancelled)
ITEM (kho): in_stock → listed → reserved → delivered (hoặc discarded)
LISTING:   active → reserved → closed (hoặc blocked)
REQUEST:   pending → approved → scheduled → completed (hoặc rejected/cancelled/no_show)

Sync (client lib):  Marketplace→Community (membership), Marketplace→Donation (item),
                    Donation→Community (group/role), AI→Community (groups)
Event (RabbitMQ):   mọi thay đổi trạng thái → Communication (notify) + Analytics (stats)
                    post/listing/message.created → AI (moderation)
```
