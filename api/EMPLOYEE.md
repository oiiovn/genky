# Employee + Position + Permission

## Tách khái niệm

| | User | Employee |
|---|---|---|
| Là gì | Tài khoản đăng nhập Genky | Người làm việc tại cửa hàng |
| Bắt buộc? | Có nếu dùng app | Có trong HR |
| Liên kết | `employees.user_id` nullable | Qua invite |

## Tables

`positions` · `employees` · `employee_branches` · `employee_invitations`

## API

| Method | Path |
|--------|------|
| GET/POST | `/api/positions` |
| PUT/DELETE | `/api/positions/{id}` |
| GET/POST | `/api/employees` |
| GET/PUT/DELETE | `/api/employees/{id}` |
| POST | `/api/employees/{id}/assign-branch` |
| DELETE | `/api/employees/{id}/branches/{branch}` |
| POST | `/api/employees/{id}/invite` |
| GET | `/api/invitations/{token}` (public) |
| POST | `/api/invitations/{token}/accept` (public) |

Accept body: `password`, `password_confirmation`, `name?`, `phone?`

→ Tạo User (hoặc liên kết user email sẵn có) + role `employee` + gắn `employees.user_id` + trả tokens.

Filter: `?branch_id=&status=&position_id=&search=`

## Permission

| Role | Xem | Tạo | Sửa | Xóa | Gán CN | Invite |
|------|-----|-----|-----|-----|--------|--------|
| Owner/Admin/HR | All org | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | Chi nhánh mình* | ✅ | ✅ (CN mình) | ❌ | ✅ (CN mình) | ✅ |
| Employee | Hồ sơ mình | ❌ | Hồ sơ cơ bản | ❌ | ❌ | ❌ |

\* Manager cần có Employee gắn `user_id` + `employee_branches`.

## Response mẫu

```json
{
  "data": {
    "employee_code": "NV001",
    "full_name": "Nguyễn Văn An",
    "position": { "id": 2, "name": "Phục vụ" },
    "branches": [{ "id": 1, "name": "Lê Đức Thọ", "is_primary": true }],
    "status": "active",
    "has_user_account": false
  }
}
```
