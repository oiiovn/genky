<?php

namespace App\Support\Activity;

use Illuminate\Http\Request;

class ActivityActionMap
{
    /**
     * @return array{action: string, action_label: string, object: string}|null
     */
    public static function describe(Request $request): ?array
    {
        $method = strtoupper($request->method());
        $path = trim((string) preg_replace('#^api/#', '', $request->path()), '/');

        foreach (self::rules() as $rule) {
            if (! in_array($method, $rule['methods'], true)) {
                continue;
            }
            if (preg_match($rule['pattern'], $path) !== 1) {
                continue;
            }

            $object = $rule['object'] ?? null;
            if ($object === null && isset($rule['input'])) {
                $value = $request->input($rule['input']);
                $object = is_scalar($value) ? trim((string) $value) : null;
            }

            return [
                'action' => $rule['action'],
                'action_label' => $rule['label'],
                'object' => $object !== null && $object !== '' ? $object : ($rule['fallback'] ?? 'Hệ thống'),
            ];
        }

        $action = match ($method) {
            'POST' => 'create',
            'DELETE' => 'delete',
            default => 'update',
        };

        return [
            'action' => $action,
            'action_label' => match ($action) {
                'create' => 'Tạo mới',
                'delete' => 'Xóa',
                default => 'Cập nhật',
            },
            'object' => self::fallbackObject($request, $path),
        ];
    }

    /**
     * @return list<array{methods: list<string>, pattern: string, action: string, label: string, input?: string, object?: string, fallback?: string}>
     */
    protected static function rules(): array
    {
        return [
            ['methods' => ['POST'], 'pattern' => '#^employees$#', 'action' => 'create', 'label' => 'Thêm nhân viên', 'input' => 'full_name'],
            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^employees/\d+$#', 'action' => 'update', 'label' => 'Cập nhật nhân viên', 'input' => 'full_name', 'fallback' => 'Nhân viên'],
            ['methods' => ['DELETE'], 'pattern' => '#^employees/\d+$#', 'action' => 'delete', 'label' => 'Xóa nhân viên', 'fallback' => 'Nhân viên'],
            ['methods' => ['POST'], 'pattern' => '#^employees/\d+/invite$#', 'action' => 'create', 'label' => 'Mời tài khoản nhân viên', 'fallback' => 'Nhân viên'],
            ['methods' => ['POST'], 'pattern' => '#^employees/\d+/assign-branch$#', 'action' => 'update', 'label' => 'Gán chi nhánh nhân viên', 'fallback' => 'Nhân viên'],
            ['methods' => ['DELETE'], 'pattern' => '#^employees/\d+/branches/\d+$#', 'action' => 'update', 'label' => 'Gỡ chi nhánh nhân viên', 'fallback' => 'Nhân viên'],

            ['methods' => ['POST'], 'pattern' => '#^branches$#', 'action' => 'create', 'label' => 'Tạo chi nhánh', 'input' => 'name'],
            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^branches/\d+$#', 'action' => 'update', 'label' => 'Cập nhật chi nhánh', 'input' => 'name', 'fallback' => 'Chi nhánh'],
            ['methods' => ['DELETE'], 'pattern' => '#^branches/\d+$#', 'action' => 'delete', 'label' => 'Xóa chi nhánh', 'fallback' => 'Chi nhánh'],

            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^organization$#', 'action' => 'update', 'label' => 'Cập nhật thông tin công ty', 'object' => 'Hồ sơ công ty'],
            ['methods' => ['POST'], 'pattern' => '#^organization/logo$#', 'action' => 'update', 'label' => 'Cập nhật logo công ty', 'object' => 'Logo'],
            ['methods' => ['POST'], 'pattern' => '#^organization/documents$#', 'action' => 'create', 'label' => 'Tải tài liệu công ty', 'fallback' => 'Tài liệu'],
            ['methods' => ['DELETE'], 'pattern' => '#^organization/documents/\d+$#', 'action' => 'delete', 'label' => 'Xóa tài liệu công ty', 'fallback' => 'Tài liệu'],

            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^settings/interface$#', 'action' => 'update', 'label' => 'Cập nhật giao diện', 'object' => 'Giao diện'],
            ['methods' => ['POST'], 'pattern' => '#^settings/interface/reset$#', 'action' => 'update', 'label' => 'Khôi phục giao diện mặc định', 'object' => 'Giao diện'],
            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^settings/general$#', 'action' => 'update', 'label' => 'Cập nhật cài đặt chung', 'object' => 'Cài đặt chung'],
            ['methods' => ['POST'], 'pattern' => '#^settings/general/backup$#', 'action' => 'create', 'label' => 'Sao lưu dữ liệu', 'object' => 'Hệ thống'],

            ['methods' => ['POST'], 'pattern' => '#^onboarding/organization$#', 'action' => 'update', 'label' => 'Hoàn tất hồ sơ tổ chức', 'input' => 'name', 'fallback' => 'Tổ chức'],
            ['methods' => ['POST'], 'pattern' => '#^onboarding/branch$#', 'action' => 'create', 'label' => 'Tạo chi nhánh', 'input' => 'name'],

            ['methods' => ['POST'], 'pattern' => '#^shifts$#', 'action' => 'create', 'label' => 'Tạo ca làm', 'input' => 'name'],
            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^shifts/\d+$#', 'action' => 'update', 'label' => 'Sửa thông tin ca làm việc', 'input' => 'name', 'fallback' => 'Ca làm việc'],
            ['methods' => ['DELETE'], 'pattern' => '#^shifts/\d+$#', 'action' => 'delete', 'label' => 'Xóa ca làm', 'fallback' => 'Ca làm việc'],
            ['methods' => ['POST'], 'pattern' => '#^shifts/import$#', 'action' => 'create', 'label' => 'Nhập ca làm việc', 'object' => 'Ca làm việc'],

            ['methods' => ['POST'], 'pattern' => '#^shift-assignments$#', 'action' => 'create', 'label' => 'Phân ca làm việc', 'object' => 'Lịch làm việc'],
            ['methods' => ['DELETE'], 'pattern' => '#^shift-assignments/\d+$#', 'action' => 'delete', 'label' => 'Xóa phân ca', 'object' => 'Lịch làm việc'],

            ['methods' => ['POST'], 'pattern' => '#^attendances/check-in$#', 'action' => 'create', 'label' => 'Chấm công vào', 'object' => 'Chấm công'],
            ['methods' => ['POST'], 'pattern' => '#^attendances/check-out$#', 'action' => 'update', 'label' => 'Chấm công ra', 'object' => 'Chấm công'],
            ['methods' => ['POST'], 'pattern' => '#^attendances/bulk$#', 'action' => 'update', 'label' => 'Chấm công hàng loạt', 'object' => 'Chấm công'],
            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^attendances/\d+$#', 'action' => 'update', 'label' => 'Cập nhật chấm công', 'object' => 'Chấm công'],
            ['methods' => ['DELETE'], 'pattern' => '#^attendances/\d+$#', 'action' => 'delete', 'label' => 'Xóa bản ghi chấm công', 'object' => 'Chấm công'],
            ['methods' => ['POST'], 'pattern' => '#^attendances/qr/scan$#', 'action' => 'create', 'label' => 'Quét QR chấm công', 'object' => 'Chấm công QR'],
            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^attendances/qr/settings$#', 'action' => 'update', 'label' => 'Cập nhật cài đặt QR', 'object' => 'QR chấm công'],

            ['methods' => ['POST'], 'pattern' => '#^timesheets/generate$#', 'action' => 'create', 'label' => 'Tạo bảng công', 'object' => 'Bảng công'],
            ['methods' => ['POST'], 'pattern' => '#^timesheets/approve$#', 'action' => 'update', 'label' => 'Duyệt bảng công', 'object' => 'Bảng công'],

            ['methods' => ['POST'], 'pattern' => '#^payrolls/generate$#', 'action' => 'create', 'label' => 'Tính bảng lương', 'object' => 'Bảng lương'],
            ['methods' => ['POST'], 'pattern' => '#^payrolls/pay$#', 'action' => 'update', 'label' => 'Thanh toán lương', 'object' => 'Bảng lương'],
            ['methods' => ['POST'], 'pattern' => '#^payrolls/mark-paid$#', 'action' => 'update', 'label' => 'Đánh dấu đã trả lương', 'object' => 'Bảng lương'],

            ['methods' => ['POST'], 'pattern' => '#^leaves$#', 'action' => 'create', 'label' => 'Tạo đơn nghỉ phép', 'input' => 'reason', 'fallback' => 'Đơn nghỉ phép'],
            ['methods' => ['POST'], 'pattern' => '#^leaves/\d+/cancel$#', 'action' => 'update', 'label' => 'Hủy đơn nghỉ phép', 'object' => 'Đơn nghỉ phép'],
            ['methods' => ['POST'], 'pattern' => '#^leaves/\d+/review$#', 'action' => 'update', 'label' => 'Duyệt đơn nghỉ phép', 'object' => 'Đơn nghỉ phép'],

            ['methods' => ['POST'], 'pattern' => '#^adjustments$#', 'action' => 'create', 'label' => 'Thêm thưởng / phạt', 'input' => 'reason', 'fallback' => 'Thưởng / phạt'],
            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^adjustments/\d+$#', 'action' => 'update', 'label' => 'Cập nhật thưởng / phạt', 'input' => 'reason', 'fallback' => 'Thưởng / phạt'],
            ['methods' => ['DELETE'], 'pattern' => '#^adjustments/\d+$#', 'action' => 'delete', 'label' => 'Xóa thưởng / phạt', 'fallback' => 'Thưởng / phạt'],

            ['methods' => ['POST'], 'pattern' => '#^roles$#', 'action' => 'create', 'label' => 'Tạo vai trò', 'input' => 'name'],
            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^roles/\d+$#', 'action' => 'update', 'label' => 'Cập nhật vai trò', 'input' => 'name', 'fallback' => 'Vai trò'],
            ['methods' => ['DELETE'], 'pattern' => '#^roles/\d+$#', 'action' => 'delete', 'label' => 'Xóa vai trò', 'fallback' => 'Vai trò'],
            ['methods' => ['PUT'], 'pattern' => '#^roles/\d+/permissions$#', 'action' => 'update', 'label' => 'Cập nhật quyền vai trò', 'object' => 'Vai trò'],
            ['methods' => ['POST'], 'pattern' => '#^roles/\d+/members$#', 'action' => 'update', 'label' => 'Gán thành viên vai trò', 'object' => 'Vai trò'],
            ['methods' => ['DELETE'], 'pattern' => '#^roles/\d+/members/\d+$#', 'action' => 'update', 'label' => 'Gỡ thành viên vai trò', 'object' => 'Vai trò'],

            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^me$#', 'action' => 'update', 'label' => 'Cập nhật hồ sơ tài khoản', 'object' => 'Tài khoản'],
            ['methods' => ['POST'], 'pattern' => '#^me/avatar$#', 'action' => 'update', 'label' => 'Cập nhật ảnh đại diện', 'object' => 'Tài khoản'],
            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^me/staff-profile$#', 'action' => 'update', 'label' => 'Cập nhật hồ sơ nhân viên', 'object' => 'Hồ sơ cá nhân'],
            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^me/preferences$#', 'action' => 'update', 'label' => 'Cập nhật tuỳ chọn giao diện', 'object' => 'Tuỳ chọn'],

            ['methods' => ['POST'], 'pattern' => '#^positions$#', 'action' => 'create', 'label' => 'Tạo chức vụ', 'input' => 'name'],
            ['methods' => ['PUT', 'PATCH'], 'pattern' => '#^positions/\d+$#', 'action' => 'update', 'label' => 'Cập nhật chức vụ', 'input' => 'name', 'fallback' => 'Chức vụ'],
            ['methods' => ['DELETE'], 'pattern' => '#^positions/\d+$#', 'action' => 'delete', 'label' => 'Xóa chức vụ', 'fallback' => 'Chức vụ'],
        ];
    }

    protected static function fallbackObject(Request $request, string $path): string
    {
        foreach (['full_name', 'name', 'reason', 'title'] as $key) {
            $value = $request->input($key);
            if (is_scalar($value) && trim((string) $value) !== '') {
                return trim((string) $value);
            }
        }

        $segment = basename($path);

        return $segment !== '' ? $segment : 'Hệ thống';
    }
}
