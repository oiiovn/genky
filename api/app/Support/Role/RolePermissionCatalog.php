<?php

namespace App\Support\Role;

class RolePermissionCatalog
{
    public const ACTIONS = ['view', 'create', 'update', 'delete', 'export'];

    /**
     * @return list<array{id: string, label: string, rows: list<array{id: string, label: string, description: string, actions: list<string>}>}>
     */
    public static function groups(): array
    {
        return [
            [
                'id' => 'overview',
                'label' => 'Tổng quan',
                'rows' => [
                    [
                        'id' => 'dashboard',
                        'label' => 'Dashboard tổng quan',
                        'description' => 'Xem thống kê và báo cáo tổng hợp',
                        'actions' => ['view', 'export'],
                    ],
                ],
            ],
            [
                'id' => 'hr',
                'label' => 'Nhân sự',
                'rows' => [
                    [
                        'id' => 'employees',
                        'label' => 'Quản lý nhân viên',
                        'description' => 'Thêm, sửa, xóa thông tin nhân viên',
                        'actions' => ['view', 'create', 'update', 'delete', 'export'],
                    ],
                    [
                        'id' => 'shifts',
                        'label' => 'Ca làm việc',
                        'description' => 'Thiết lập và phân ca làm việc',
                        'actions' => ['view', 'create', 'update', 'delete'],
                    ],
                    [
                        'id' => 'attendance',
                        'label' => 'Chấm công',
                        'description' => 'Xem và chỉnh sửa dữ liệu chấm công',
                        'actions' => ['view', 'create', 'update', 'delete', 'export'],
                    ],
                    [
                        'id' => 'leave',
                        'label' => 'Nghỉ phép',
                        'description' => 'Duyệt và quản lý đơn nghỉ phép',
                        'actions' => ['view', 'create', 'update', 'delete'],
                    ],
                ],
            ],
            [
                'id' => 'payroll',
                'label' => 'Lương & Thưởng',
                'rows' => [
                    [
                        'id' => 'payroll',
                        'label' => 'Bảng lương',
                        'description' => 'Tính và xuất bảng lương tháng',
                        'actions' => ['view', 'create', 'update', 'delete', 'export'],
                    ],
                    [
                        'id' => 'bonus',
                        'label' => 'Thưởng / Phạt',
                        'description' => 'Quản lý thưởng phạt nhân viên',
                        'actions' => ['view', 'create', 'update', 'delete'],
                    ],
                    [
                        'id' => 'payroll_export',
                        'label' => 'Xuất dữ liệu lương',
                        'description' => 'Xuất file lương ra Excel/PDF',
                        'actions' => ['view', 'export'],
                    ],
                ],
            ],
            [
                'id' => 'inventory',
                'label' => 'Kho & Sản phẩm',
                'rows' => [
                    [
                        'id' => 'products',
                        'label' => 'Sản phẩm / Menu',
                        'description' => 'Quản lý danh mục sản phẩm',
                        'actions' => ['view', 'create', 'update', 'delete'],
                    ],
                    [
                        'id' => 'inventory',
                        'label' => 'Quản lý kho',
                        'description' => 'Nhập xuất tồn kho',
                        'actions' => ['view', 'create', 'update', 'delete', 'export'],
                    ],
                ],
            ],
            [
                'id' => 'system',
                'label' => 'Hệ thống',
                'rows' => [
                    [
                        'id' => 'schedule',
                        'label' => 'Lịch làm việc',
                        'description' => 'Phân ca và lịch làm nhân viên',
                        'actions' => ['view', 'create', 'update', 'delete'],
                    ],
                    [
                        'id' => 'timesheet',
                        'label' => 'Bảng công',
                        'description' => 'Tổng hợp công theo kỳ',
                        'actions' => ['view', 'create', 'update', 'export'],
                    ],
                    [
                        'id' => 'settings',
                        'label' => 'Cài đặt hệ thống',
                        'description' => 'Cấu hình tổ chức và giao diện',
                        'actions' => ['view', 'update'],
                    ],
                    [
                        'id' => 'roles',
                        'label' => 'Vai trò & Quyền',
                        'description' => 'Phân quyền sử dụng hệ thống',
                        'actions' => ['view', 'create', 'update', 'delete'],
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array<string, list<string>>
     */
    public static function resourceActions(): array
    {
        $map = [];
        foreach (self::groups() as $group) {
            foreach ($group['rows'] as $row) {
                $map[$row['id']] = $row['actions'];
            }
        }

        return $map;
    }

    /**
     * @param  array<string, array<string, bool>>  $overrides
     * @return array<string, array{view: bool, create: bool, update: bool, delete: bool, export: bool}>
     */
    public static function fullMatrix(array $overrides = []): array
    {
        $result = [];
        foreach (self::resourceActions() as $resource => $actions) {
            $cell = [
                'view' => false,
                'create' => false,
                'update' => false,
                'delete' => false,
                'export' => false,
            ];
            foreach ($actions as $action) {
                $cell[$action] = true;
            }
            if (isset($overrides[$resource])) {
                $cell = array_merge($cell, $overrides[$resource]);
            }
            $result[$resource] = $cell;
        }

        return $result;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function defaultRoles(): array
    {
        return [
            [
                'slug' => 'owner',
                'name' => 'Chủ quán',
                'description' => 'Toàn quyền hệ thống',
                'icon' => 'crown',
                'color' => 'text-amber-600',
                'bg' => 'bg-amber-50',
                'is_system' => true,
                'is_default' => true,
                'sort_order' => 1,
                'permissions' => self::fullMatrix([
                    'payroll_export' => ['view' => false, 'export' => true],
                ]),
            ],
            [
                'slug' => 'manager',
                'name' => 'Quản lý',
                'description' => 'Quản lý chi nhánh và nhân sự',
                'icon' => 'shield',
                'color' => 'text-sky-600',
                'bg' => 'bg-sky-50',
                'is_system' => true,
                'is_default' => false,
                'sort_order' => 2,
                'permissions' => self::fullMatrix([
                    'payroll' => ['delete' => false],
                    'payroll_export' => ['view' => true, 'export' => true],
                    'products' => ['delete' => false],
                    'settings' => ['view' => true, 'update' => false],
                    'roles' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                ]),
            ],
            [
                'slug' => 'cashier',
                'name' => 'Thu ngân',
                'description' => 'Thanh toán và báo cáo ca',
                'icon' => 'cash',
                'color' => 'text-emerald-600',
                'bg' => 'bg-emerald-50',
                'is_system' => true,
                'is_default' => false,
                'sort_order' => 3,
                'permissions' => self::fullMatrix([
                    'employees' => [
                        'view' => true, 'create' => false, 'update' => false, 'delete' => false, 'export' => false,
                    ],
                    'shifts' => ['view' => true, 'create' => false, 'update' => false, 'delete' => false],
                    'attendance' => [
                        'view' => true, 'create' => true, 'update' => false, 'delete' => false, 'export' => false,
                    ],
                    'leave' => ['view' => true, 'create' => true, 'update' => false, 'delete' => false],
                    'payroll' => [
                        'view' => false, 'create' => false, 'update' => false, 'delete' => false, 'export' => false,
                    ],
                    'bonus' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                    'payroll_export' => ['view' => false, 'export' => false],
                    'products' => ['view' => true, 'create' => false, 'update' => false, 'delete' => false],
                    'inventory' => [
                        'view' => true, 'create' => false, 'update' => false, 'delete' => false, 'export' => false,
                    ],
                    'schedule' => ['view' => true, 'create' => false, 'update' => false, 'delete' => false],
                    'timesheet' => ['view' => false, 'create' => false, 'update' => false, 'export' => false],
                    'settings' => ['view' => false, 'update' => false],
                    'roles' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                ]),
            ],
            [
                'slug' => 'waiter',
                'name' => 'Nhân viên phục vụ',
                'description' => 'Chấm công và xem lịch làm',
                'icon' => 'user',
                'color' => 'text-violet-600',
                'bg' => 'bg-violet-50',
                'is_system' => true,
                'is_default' => false,
                'sort_order' => 4,
                'permissions' => self::fullMatrix([
                    'dashboard' => ['view' => true, 'export' => false],
                    'employees' => [
                        'view' => false, 'create' => false, 'update' => false, 'delete' => false, 'export' => false,
                    ],
                    'shifts' => ['view' => true, 'create' => false, 'update' => false, 'delete' => false],
                    'attendance' => [
                        'view' => true, 'create' => false, 'update' => false, 'delete' => false, 'export' => false,
                    ],
                    'leave' => ['view' => true, 'create' => true, 'update' => false, 'delete' => false],
                    'payroll' => [
                        'view' => false, 'create' => false, 'update' => false, 'delete' => false, 'export' => false,
                    ],
                    'bonus' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                    'payroll_export' => ['view' => false, 'export' => false],
                    'products' => ['view' => true, 'create' => false, 'update' => false, 'delete' => false],
                    'inventory' => [
                        'view' => false, 'create' => false, 'update' => false, 'delete' => false, 'export' => false,
                    ],
                    'schedule' => ['view' => true, 'create' => false, 'update' => false, 'delete' => false],
                    'timesheet' => ['view' => false, 'create' => false, 'update' => false, 'export' => false],
                    'settings' => ['view' => false, 'update' => false],
                    'roles' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                ]),
            ],
            [
                'slug' => 'warehouse',
                'name' => 'Nhân viên kho',
                'description' => 'Quản lý nhập xuất kho',
                'icon' => 'box',
                'color' => 'text-orange-600',
                'bg' => 'bg-orange-50',
                'is_system' => true,
                'is_default' => false,
                'sort_order' => 5,
                'permissions' => self::fullMatrix([
                    'dashboard' => ['view' => true, 'export' => false],
                    'employees' => [
                        'view' => false, 'create' => false, 'update' => false, 'delete' => false, 'export' => false,
                    ],
                    'shifts' => ['view' => true, 'create' => false, 'update' => false, 'delete' => false],
                    'attendance' => [
                        'view' => true, 'create' => false, 'update' => false, 'delete' => false, 'export' => false,
                    ],
                    'leave' => ['view' => true, 'create' => true, 'update' => false, 'delete' => false],
                    'payroll' => [
                        'view' => false, 'create' => false, 'update' => false, 'delete' => false, 'export' => false,
                    ],
                    'bonus' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                    'payroll_export' => ['view' => false, 'export' => false],
                    'products' => ['view' => true, 'create' => true, 'update' => true, 'delete' => false],
                    'inventory' => [
                        'view' => true, 'create' => true, 'update' => true, 'delete' => false, 'export' => true,
                    ],
                    'schedule' => ['view' => true, 'create' => false, 'update' => false, 'delete' => false],
                    'timesheet' => ['view' => false, 'create' => false, 'update' => false, 'export' => false],
                    'settings' => ['view' => false, 'update' => false],
                    'roles' => ['view' => false, 'create' => false, 'update' => false, 'delete' => false],
                ]),
            ],
        ];
    }
}
