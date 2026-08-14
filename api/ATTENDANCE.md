# Attendance (Chấm công)

## Tables

`attendance_logs` · `attendance_adjustments` · `attendance_imports`

## API

| Method | Path |
|--------|------|
| GET | `/api/attendances/dashboard?date=&branch_id=` |
| GET | `/api/attendances/shifts/today?date=&branch_id=` |
| GET | `/api/attendances?date=&branch_id=&shift_id=&status=&search=&page=` |
| POST | `/api/attendances/check-in` |
| POST | `/api/attendances/check-out` |
| POST | `/api/attendances/bulk` |
| GET/PUT/DELETE | `/api/attendances/{id}` |
| GET | `/api/attendances/{id}/adjustments` |
| GET | `/api/attendances/export?date=&branch_id=` |

Check-in body: `employee_id`, `branch_id`, `shift_id?`, `latitude?`, `longitude?`, `location_label?`

Check-out body: `employee_id`, `branch_id`, `latitude?`, `longitude?`, `note?`

`ui_status`: `not_checked_in` | `working` | `checked_out`

Guard: `feature:attendance`
