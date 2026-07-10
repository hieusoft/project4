# AI Service

| | |
|---|---|
| **Mục đích** | Tích hợp LLM/vision hỗ trợ: nhận diện loại đồ từ ảnh, gợi ý nhóm phù hợp, kiểm duyệt nội dung, sinh mô tả listing |
| **Stack hiện tại** | NestJS scaffold (Node) |
| **Port** | `3007` |
| **Gateway** | `/api/ai` |
| **Database** | `ai_db` (dự kiến log / cache kết quả) |
| **Code** | `apps/ai-service/` — **scaffold (health only)** |

---

## Service này sẽ làm gì?

AI **không** thay quyết định cuối của hội nhóm; chỉ **gợi ý** để giảm thao tác.

| Tính năng thiết kế | Input | Output gợi ý |
|---|---|---|
| Detect item | Ảnh đồ | Tên, category, tình trạng |
| Suggest groups | Mô tả + province | Danh sách group_id + lý do |
| Moderate content | Text/ảnh post | flag spam/inappropriate |
| Generate description | Ảnh + meta | Mô tả listing |

---

## Phụ thuộc

- **Media / CDN**: URL ảnh public  
- **Community**: list group active theo province (HTTP)  
- **LLM provider**: `LLM_API_KEY`, `LLM_MODEL`, `LLM_PROVIDER` trong env  

---

## API hiện tại

| Method | Path | Mô tả |
|---|---|---|
| GET | `/` · `/health` | Health scaffold |
| GET | `/openapi.json` | Spec tối thiểu |

## API dự kiến

- `POST /detect-item` `{ image_urls[] }`  
- `POST /suggest-groups` `{ description, province_code }`  
- `POST /moderate` `{ text?, image_urls? }`  
- `POST /generate-description` `{ ... }`  

---

## Luồng gắn vào nghiệp vụ

```text
Donor chụp ảnh
  → Media upload
  → AI detect-item (optional) điền form donation
  → AI suggest-groups
  → Donor chọn group → Donation service
```
