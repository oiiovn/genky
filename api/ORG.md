# Organization + Branch

## Kiến trúc tenant

```
Authenticated User
        ↓
Organization (TenantContext — KHÔNG nhận organization_id từ client)
        ↓
Branches / Employees / ...
```

User ≠ Employee. Không gắn `branch_id` vào `users`.

## Đăng ký

```
User → Organization → Owner
```

## Onboarding

1. `POST /api/onboarding/organization` — tên, SĐT, địa chỉ
2. `POST /api/onboarding/branch` — chi nhánh đầu + GPS + bán kính
3. Vào Dashboard khi `setup_completed = true`

## API

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/organization` | Org hiện tại |
| PUT/PATCH | `/api/organization` | Cập nhật org |
| GET | `/api/onboarding/status` | Bước tiếp theo |
| POST | `/api/onboarding/organization` | Bước 1 |
| POST | `/api/onboarding/branch` | Bước 2 / tạo branch |
| GET | `/api/branches` | List (scoped tenant) |
| POST | `/api/branches` | Tạo |
| GET/PUT/DELETE | `/api/branches/{id}` | CRUD |

## Tables

`users` · `organizations` · `organization_user` · `branches`

Tiếp theo: `employees` · `employee_branches` · `positions` · `roles` · `permissions`
