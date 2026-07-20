# Marketplace Service

| | |
|---|---|
| **Mục đích** | Gian hàng 0 đồng: đăng listing từ kho, người cần đăng ký nhận, nhóm duyệt, hẹn lịch, trao tặng (QR), thống kê |
| **Stack** | Node.js · Express · pg · amqplib |
| **Port** | `3004` |
| **Gateway** | `/api/marketplace` |
| **Database** | `marketplace_db` |
| **Code** | `apps/marketplace-service/` |
| **OpenAPI** | Live: `/openapi.json` · Hub: `/docs` → Marketplace |
| **Schema** | `infra/postgres/init/04-marketplace-schema.sql` |

---

## Trách nhiệm

| Có | Không |
|---|---|
| Listing (per-group + catalog) | Auth cấp JWT |
| Request nhận đồ + approve/reject/schedule/complete/cancel/no_show | Quyên góp / check kho (gọi Donation) |
| Close listing | Upload (Media) |
| daily_stats (analytics consumer) | Membership (đọc Community) |

**Quy tắc:** Người nhận phải là **member approved** của nhóm. Listing chỉ từ inventory `in_stock`.

---

## API

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/catalog` | no | Listing active |
| GET/POST | `/listings` | POST JWT | List / tạo (verify inventory + mod) |
| PUT | `/listings/{id}/close` | JWT mod | Đóng listing |
| POST | `/requests` | JWT | Xin nhận (verify member) |
| PUT | `/requests/{id}/approve` | JWT mod | Duyệt + **trừ qty** + inventory reserved |
| PUT | `/requests/{id}/reject` | JWT mod | Từ chối |
| PUT | `/requests/{id}/schedule` | JWT mod | Hẹn lịch |
| PUT | `/requests/{id}/complete` | JWT mod | QR complete + inventory delivered |
| PUT | `/requests/{id}/cancel` | JWT | Hủy + hoàn qty nếu đã approve |
| PUT | `/requests/{id}/no-show` | JWT mod | Không đến + hoàn qty |
| GET | `/stats` · `/stats/overview` | no | daily_stats |

---

## Events publish

`listing.created` · `request.created` · `request.approved` · `request.scheduled` · `request.completed` · `request.rejected`

## Analytics consume (`marketplace.analytics.queue`)

`listing.created` → items_listed  
`request.created` → requests_count  
`request.completed` → items_delivered, people_helped  
`donation.completed` → donations_count, items_received  
`user.verified` → new_users  
`group.member_approved` → new_members  

---

## Env

```env
PORT=3004
JWT_SECRET=...
COMMUNITY_SERVICE_URL=http://community-service:3002
DONATION_SERVICE_URL=http://donation-service:3003
MARKETPLACE_SOFT_CHECKS=false
RABBITMQ_URL=...
```
