# Genky Auth + Tenant

## Flow đăng ký

```
User  →  Organization  →  Owner
 Vũ   →  FRESH - Bánh tráng trộn  →  role: owner
```

Mỗi lần đăng ký tạo **tenant mới** — dữ liệu tách hoàn toàn qua `organization_id`.

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/refresh` | Public (refresh_token) |
| POST | `/api/auth/logout` | Bearer |
| GET | `/api/me` | Bearer |

### Register body

```json
{
  "name": "Vũ",
  "email": "vu@fresh.test",
  "phone": "0901234567",
  "password": "Password1!",
  "password_confirmation": "Password1!",
  "organization_name": "FRESH - Bánh tráng trộn"
}
```

### Login body

```json
{
  "login": "vu@fresh.test",
  "password": "Password1!"
}
```

### Response (register / login / refresh)

```json
{
  "token_type": "Bearer",
  "access_token": "...",
  "refresh_token": "...",
  "user": { "id": 1, "name": "Vũ", "email": "..." },
  "organization": { "id": 1, "name": "FRESH - Bánh tráng trộn", "slug": "..." },
  "role": "owner"
}
```

## Tenant isolation

- Trait `BelongsToOrganization` — global scope theo `TenantContext`
- Middleware `SetTenantFromUser` gắn org hiện tại sau khi auth
- Bảng `organization_user` (role: owner | admin | manager | employee)
