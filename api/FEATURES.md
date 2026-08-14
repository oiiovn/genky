# Feature Entitlement System

## Tách 2 khái niệm

| | Feature (Entitlement) | Permission (RBAC) |
|---|---|---|
| Hỏi gì? | Org/Branch **có được dùng** module? | User **có được thao tác**? |
| Ví dụ off | `FEATURE_NOT_ENABLED` | `403` insufficient permission |
| Tầng | Plan → Org → Branch | Role → Permission |

## Resolve

```
Branch override  →  Organization override  →  Plan default  →  false
```

Header tuỳ chọn: `X-Branch-Id` để resolve theo chi nhánh.

## Tables

`features` · `plans` · `plan_features` · `subscriptions`  
`organization_features` · `branch_features` · `feature_flags`

## API

| Method | Path |
|--------|------|
| GET | `/api/features?branch_id=` |
| POST | `/api/features/organization` |
| POST | `/api/features/branches/{id}` |
| GET | `/api/me` → `entitlements` |

## Middleware

```php
Route::middleware(['feature:employees'])->group(...)
Route::middleware(['feature:payroll'])->group(...) // sau này
```

## Plan mặc định khi đăng ký: FREE

employees ✅ · attendance ✅ · shifts ✅ · payroll ❌ · pos ❌ · ai ❌
