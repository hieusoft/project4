# Marketplace Service — Đã bỏ

> **Lưu ý:** Marketplace service đã được thay thế bằng luồng **Campaign-driven** trong Donation Service.
>
> Thay vì tạo listing riêng từng món rồi receiver đăng ký nhận, nhóm giờ tạo **cuộc quyên góp** (campaign) với mục tiêu cụ thể (vd: 15 áo, 15 bao gạo cho địa phương X). Donor đóng góp vào campaign, nhóm kiểm tra và trao tặng cả đợt.
>
| | |
|---|---|
| **Trạng thái** | **Đã bỏ** — code vẫn còn trong `apps/marketplace-service/` nhưng không còn trong compose/Kong/CI/CD |
| **Thay thế bởi** | [Donation Service](./donation.md) — campaigns + contributions |
| **Database** | `marketplace_db` đã bỏ khỏi init script |
| **Kong route** | `/api/marketplace` đã bỏ |
