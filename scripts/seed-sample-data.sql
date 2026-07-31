-- =============================================================================
-- Sample seed data for the Charity Platform.
-- Password for ALL sample users: SamplePass123!
-- Idempotent: re-runnable (ON CONFLICT DO NOTHING on fixed UUIDs).
-- Apply:  docker exec -i charity-prod-postgres-1 psql -U charity -d charity_root < scripts/seed-sample-data.sql
-- =============================================================================

-- ── identity_db ─────────────────────────────────────────────────────────────
\connect identity_db

INSERT INTO accounts (id, username, email, password_hash, status, email_verified, created_at, updated_at) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'nguyenvanan',  'an.nguyen@example.com',   '$2b$12$zAlV5g1oclbhYz9tmmt7O..xUeU9DZwVSMuiHp90f2GnHfPkcVL82', 'active', true, now(), now()),
  ('b2222222-2222-2222-2222-222222222222', 'tranthibinh',  'binh.tran@example.com',   '$2b$12$zAlV5g1oclbhYz9tmmt7O..xUeU9DZwVSMuiHp90f2GnHfPkcVL82', 'active', true, now(), now()),
  ('c3333333-3333-3333-3333-333333333333', 'levancuong',    'cuong.le@example.com',    '$2b$12$zAlV5g1oclbhYz9tmmt7O..xUeU9DZwVSMuiHp90f2GnHfPkcVL82', 'active', true, now(), now()),
  ('d4444444-4444-4444-4444-444444444444', 'phamthidung',   'dung.pham@example.com',   '$2b$12$zAlV5g1oclbhYz9tmmt7O..xUeU9DZwVSMuiHp90f2GnHfPkcVL82', 'active', true, now(), now()),
  ('e5555555-5555-5555-5555-555555555555', 'hoangvanem',    'em.hoang@example.com',    '$2b$12$zAlV5g1oclbhYz9tmmt7O..xUeU9DZwVSMuiHp90f2GnHfPkcVL82', 'active', true, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO account_roles (account_id, role_id) VALUES
  ('a1111111-1111-1111-1111-111111111111', 2),
  ('b2222222-2222-2222-2222-222222222222', 1),
  ('c3333333-3333-3333-3333-333333333333', 1),
  ('d4444444-4444-4444-4444-444444444444', 1),
  ('e5555555-5555-5555-5555-555555555555', 1)
ON CONFLICT (account_id, role_id) DO NOTHING;

INSERT INTO user_profiles (id, full_name, avatar_url, gender, address, province_code, bio, reputation_score, donation_count, received_count) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Nguyễn Văn An',   'http://161.118.247.84:8333/media/avatar-an.jpg',  'male',   'Số 12 Tràng Tiền, Hà Nội', '01', 'Quản trị viên nền tảng.', 95, 12, 5),
  ('b2222222-2222-2222-2222-222222222222', 'Trần Thị Bình',   'http://161.118.247.84:8333/media/avatar-binh.jpg', 'female', 'Đà Nẵng', '48', 'Tổ trưởng nhóm từ thiện miền Trung.', 88, 30, 2),
  ('c3333333-3333-3333-3333-333333333333', 'Lê Văn Cường',   'http://161.118.247.84:8333/media/avatar-cuong.jpg', 'male',   'Huế', '46', 'Mạnh thường quân, hay quyên góp quần áo.', 76, 18, 0),
  ('d4444444-4444-4444-4444-444444444444', 'Phạm Thị Dung',  'http://161.118.247.84:8333/media/avatar-dung.jpg', 'female', 'Nha Trang', '50', 'Điều phối quỹ lương thực.', 70, 9, 14),
  ('e5555555-5555-5555-5555-555555555555', 'Hoàng Văn Em',   'http://161.118.247.84:8333/media/avatar-em.jpg',  'male',   'Cần Thơ', '54', 'Tình nguyện viên.', 60, 4, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_activity_logs (user_id, action, ref_type, ref_id, metadata) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'register', 'account', 'a1111111-1111-1111-1111-111111111111', '{"source":"seed"}'::jsonb),
  ('b2222222-2222-2222-2222-222222222222', 'register', 'account', 'b2222222-2222-2222-2222-222222222222', '{"source":"seed"}'::jsonb)
ON CONFLICT DO NOTHING;

-- ── community_db ───────────────────────────────────────────────────────────
\connect community_db

INSERT INTO groups (id, name, slug, description, owner_id, status, member_count, reputation_score, province_code, address) VALUES
  ('1bbb1111-1111-1111-1111-111111111111', 'Cộng đồng Từ thiện Hà Nội', 'cong-dong-tu-thien-ha-noi', 'Nhóm kết nối mạnh thường quân khu vực Hà Nội và phía Bắc.', 'a1111111-1111-1111-1111-111111111111', 'active', 3, 80, '01', 'Hà Nội'),
  ('2ccc2222-2222-2222-2222-222222222222', 'Quỹ Mùa Lũ Miền Trung',    'quy-mua-lu-mien-trung',      'Hỗ trợ bà con vùng bão lũ miền Trung.',                     'b2222222-2222-2222-2222-222222222222', 'active', 2, 70, '48', 'Đà Nẵng')
ON CONFLICT (id) DO NOTHING;

INSERT INTO group_members (id, group_id, user_id, role, status, joined_at) VALUES
  ('a1000000-0000-0000-0000-000000000001', '1bbb1111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'owner',      'approved', now()),
  ('a1000000-0000-0000-0000-000000000002', '1bbb1111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333', 'member',     'approved', now()),
  ('a1000000-0000-0000-0000-000000000003', '1bbb1111-1111-1111-1111-111111111111', 'e5555555-5555-5555-5555-555555555555', 'member',     'approved', now()),
  ('a1000000-0000-0000-0000-000000000004', '2ccc2222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'owner',      'approved', now()),
  ('a1000000-0000-0000-0000-000000000005', '2ccc2222-2222-2222-2222-222222222222', 'd4444444-4444-4444-4444-444444444444', 'moderator', 'approved', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO posts (id, group_id, author_id, content, type, status, is_pinned, like_count, comment_count) VALUES
  ('a2000000-0000-0000-0000-000000000001', '1bbb1111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Chào cả nhà! Tuần này chúng ta khởi động chiến dịch Mùa Đông ấm. Mọi người cùng đóng góp quần áo nhé!', 'announcement', 'active', true, 8, 2),
  ('a2000000-0000-0000-0000-000000000002', '1bbb1111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333', 'Mình có 5 áo khoác còn mới, ai cần nhận giúp đỡ cứ liên hệ nhé.', 'call_for_donation', 'active', false, 5, 1),
  ('a2000000-0000-0000-0000-000000000003', '2ccc2222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'Đợt bão vừa qua, bà con vùng lũ đang rất cần lương thực và quần áo. Mọi người ủng hộ nhé!', 'call_for_donation', 'active', true, 12, 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO post_comments (id, post_id, author_id, content, status) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'c3333333-3333-3333-3333-333333333333', 'Tuyệt vời, mình tham gia!', 'active'),
  ('a3000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'e5555555-5555-5555-5555-555555555555', 'Mình có thể chở đồ đến nơi tập kết.', 'active'),
  ('a3000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000003', 'd4444444-4444-4444-4444-444444444444', 'Mình sẽ gom được khoảng 20kg gạo.', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO post_reactions (post_id, user_id, type) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'b2222222-2222-2222-2222-222222222222', 'like'),
  ('a2000000-0000-0000-0000-000000000001', 'd4444444-4444-4444-4444-444444444444', 'like'),
  ('a2000000-0000-0000-0000-000000000003', 'a1111111-1111-1111-1111-111111111111', 'like')
ON CONFLICT (post_id, user_id) DO NOTHING;

-- ── donation_db ────────────────────────────────────────────────────────────
\connect donation_db

INSERT INTO campaigns (id, code, group_id, title, description, province_code, status, created_by, deadline, beneficiary_description) VALUES
  ('3ddd3333-3333-3333-3333-333333333333', 'CP-2026-001', '1bbb1111-1111-1111-1111-111111111111', 'Chiến dịch Mùa Đông ấm',   'Thu gom quần áo, chăn màn ấm cho người nghèo vùng cao dịp đông.', '01', 'active', 'a1111111-1111-1111-1111-111111111111', '2026-12-31', 'Bà con vùng cao Hà Giang, Lào Cai.'),
  ('4eee4444-4444-4444-4444-444444444444', 'CP-2026-002', '2ccc2222-2222-2222-2222-222222222222', 'Quyên góp lương thực miền lũ', 'Hỗ trợ gạo, mì, nước sạch cho bà con vùng bão lũ.',             '48', 'active', 'b2222222-2222-2222-2222-222222222222', '2026-09-30', 'Bà con xã vùng lũ Quảng Nam, Thừa Thiên Huế.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO campaign_items (id, campaign_id, name, category_id, target_quantity, received_quantity, unit, condition_required, note) VALUES
  ('a4000000-0000-0000-0000-000000000001', '3ddd3333-3333-3333-3333-333333333333', 'Áo khoác ấm',     (SELECT id FROM categories WHERE slug='quan-ao'),     50, 15, 'cái', 'good', 'Ưu tiên áo còn dùng được.'),
  ('a4000000-0000-0000-0000-000000000002', '3ddd3333-3333-3333-3333-333333333333', 'Chăn màn',         (SELECT id FROM categories WHERE slug='do-gia-dung'), 30, 8,  'cái', 'used', NULL),
  ('a4000000-0000-0000-0000-000000000003', '4eee4444-4444-4444-4444-444444444444', 'Gạo (bao 5kg)',    (SELECT id FROM categories WHERE slug='khac'),         40, 20, 'bao', 'new',  'Còn hạn sử dụng.'),
  ('a4000000-0000-0000-0000-000000000004', '4eee4444-4444-4444-4444-444444444444', 'Quần áo trẻ em',   (SELECT id FROM categories WHERE slug='quan-ao'),     100, 25, 'cái', 'good', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO contributions (id, code, campaign_id, donor_id, status, pickup_method, pickup_address, received_at) VALUES
  ('a5000000-0000-0000-0000-000000000001', 'CTR-2026-001', '3ddd3333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'received', 'pickup',  'Số 12 Tràng Tiền, Hà Nội', now()),
  ('a5000000-0000-0000-0000-000000000002', 'CTR-2026-002', '4eee4444-4444-4444-4444-444444444444', 'd4444444-4444-4444-4444-444444444444', 'accepted', 'drop_off', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO contribution_items (id, contribution_id, campaign_item_id, name, quantity, condition_declared, condition_actual, status) VALUES
  ('a6000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'Áo khoác mùa đông (xanh)', 5,  'good', 'good', 'accepted'),
  ('a6000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000003', 'Gạo tấm 5kg',              4,  'new',  NULL,   'accepted')
ON CONFLICT (id) DO NOTHING;

INSERT INTO contribution_images (id, contribution_item_id, image_url, type) VALUES
  ('a7000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'http://161.118.247.84:8333/media/ao-khoac-xanh.jpg', 'declared')
ON CONFLICT (id) DO NOTHING;

INSERT INTO daily_stats (stat_date, group_id, campaigns_count, contributions_count, items_received, donors_count, new_users, new_members) VALUES
  (CURRENT_DATE, NULL, 2, 2, 33, 2, 5, 5)
ON CONFLICT (stat_date, group_id) DO NOTHING;

-- ── communication_db ───────────────────────────────────────────────────────
\connect communication_db

INSERT INTO conversations (id, type, group_id, user_id, context_type, context_id, last_message_at, last_message_preview) VALUES
  ('a8000000-0000-0000-0000-000000000001', 'donor_group', '1bbb1111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333', 'campaign', '3ddd3333-3333-3333-3333-333333333333', now(), 'Rất vui được giúp đỡ.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (id, conversation_id, sender_id, sender_side, type, content) VALUES
  ('a9000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 'user', 'text', 'Cảm ơn bạn đã đóng góp cho chiến dịch Mùa Đông ấm!'),
  ('a9000000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-000000000001', 'c3333333-3333-3333-3333-333333333333', 'user', 'text', 'Rất vui được giúp đỡ, mình sẽ tiếp tục ủng hộ.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO message_reads (conversation_id, user_id, last_read_at) VALUES
  ('a8000000-0000-0000-0000-000000000001', 'c3333333-3333-3333-3333-333333333333', now())
ON CONFLICT (conversation_id, user_id) DO NOTHING;

INSERT INTO notifications (id, user_id, type, title, body, ref_type, ref_id) VALUES
  ('aa000000-0000-0000-0000-000000000001', 'c3333333-3333-3333-3333-333333333333', 'contribution_accepted', 'Đóng góp đã được duyệt', 'Đóng góp CTR-2026-001 của bạn (5 áo khoác) đã được nhận.', 'contribution', 'a5000000-0000-0000-0000-000000000001'),
  ('aa000000-0000-0000-0000-000000000002', 'a1111111-1111-1111-1111-111111111111', 'new_contribution',     'Có đóng góp mới',       'Lê Văn Cường vừa đóng góp vào chiến dịch Mùa Đông ấm.',     'campaign',     '3ddd3333-3333-3333-3333-333333333333')
ON CONFLICT (id) DO NOTHING;

-- ── media_db ───────────────────────────────────────────────────────────────
\connect media_db

INSERT INTO media_files (id, owner_id, bucket_key, public_url, mime_type, size_bytes, ref_type, ref_id, status) VALUES
  ('ab000000-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', 'media/avatar-an.jpg',        'http://161.118.247.84:8333/media/avatar-an.jpg',        'image/jpeg', 102400, 'avatar',       'a1111111-1111-1111-1111-111111111111', 'linked'),
  ('ab000000-0000-0000-0000-000000000002', 'c3333333-3333-3333-3333-333333333333', 'media/ao-khoac-xanh.jpg',    'http://161.118.247.84:8333/media/ao-khoac-xanh.jpg',    'image/jpeg', 204800, 'contribution',  'a5000000-0000-0000-0000-000000000001', 'linked'),
  ('ab000000-0000-0000-0000-000000000003', 'b2222222-2222-2222-2222-222222222222', 'media/campaign-lu-thuc.jpg',  'http://161.118.247.84:8333/media/campaign-lu-thuc.jpg', 'image/jpeg', 153600, 'campaign',     '4eee4444-4444-4444-4444-444444444444', 'linked')
ON CONFLICT (id) DO NOTHING;
