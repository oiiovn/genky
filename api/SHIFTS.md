# Shift + Assignment

## Tables

`shifts` · `shift_assignments`

## API

| Method | Path |
|--------|------|
| GET | `/api/shifts` |
| POST | `/api/shifts` |
| GET | `/api/shifts/summary` |
| GET | `/api/shifts/export` |
| POST | `/api/shifts/import` |
| GET/PUT/DELETE | `/api/shifts/{id}` |
| GET/POST | `/api/shift-assignments` |
| DELETE | `/api/shift-assignments/{id}` |

Filter shifts: `?branch_id=&status=&search=&date=`

Filter assignments: `?branch_id=&shift_id=&employee_id=&date_from=&date_to=&status=`

Create shift body: `name`, `start_time`, `end_time`, `break_time?`, `color?`, `description?`, `code?`, `branch_id?`, `status?`, `capacity?`

Assign body: `employee_id`, `shift_id`, `branch_id`, `date`, `note?`

Import: multipart `file` (CSV) + `branch_id?`

Guard: middleware `feature:shifts`

## Permission

| Role | Xem | Tạo/Sửa | Xoá | Phân ca |
|------|-----|---------|-----|---------|
| Owner/Admin/HR | All org | ✅ | ✅ | ✅ |
| Manager | Ca org + CN mình | CN mình | ❌ | CN mình |
| Employee | Xem ca | ❌ | ❌ | ❌ |

## Seed mặc định

Khi tạo chi nhánh đầu tiên: Ca sáng / Ca chiều / Ca tối / Ca đêm.
