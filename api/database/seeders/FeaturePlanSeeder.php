<?php

namespace Database\Seeders;

use App\Models\Feature;
use App\Models\Plan;
use Illuminate\Database\Seeder;

class FeaturePlanSeeder extends Seeder
{
    public function run(): void
    {
        $features = [
            [Feature::EMPLOYEES, 'Nhân viên', 'hrm', 1],
            [Feature::ATTENDANCE, 'Chấm công', 'hrm', 2],
            [Feature::SHIFTS, 'Ca làm', 'hrm', 3],
            [Feature::TIMESHEET, 'Bảng công', 'hrm', 4],
            [Feature::PAYROLL, 'Tiền lương', 'hrm', 5],
            [Feature::LEAVE, 'Nghỉ phép', 'hrm', 6],
            [Feature::INVENTORY, 'Kho', 'inventory', 10],
            [Feature::POS, 'POS', 'pos', 11],
            [Feature::ORDERS, 'Đơn hàng', 'pos', 12],
            [Feature::REPORTS, 'Báo cáo', 'reports', 20],
            [Feature::AI_ASSISTANT, 'AI Assistant', 'ai', 30],
        ];

        foreach ($features as [$code, $name, $group, $sort]) {
            Feature::query()->updateOrCreate(
                ['code' => $code],
                [
                    'name' => $name,
                    'module_group' => $group,
                    'is_active' => true,
                    'sort_order' => $sort,
                ]
            );
        }

        $plans = [
            Plan::FREE => [
                'name' => 'Free',
                'price_monthly' => 0,
                'max_branches' => 1,
                'max_employees' => 20,
                'sort_order' => 1,
                'features' => [
                    Feature::EMPLOYEES,
                    Feature::ATTENDANCE,
                    Feature::SHIFTS,
                    Feature::TIMESHEET,
                    Feature::PAYROLL,
                ],
            ],
            Plan::STARTER => [
                'name' => 'Starter',
                'price_monthly' => 299000,
                'max_branches' => 3,
                'max_employees' => 30,
                'sort_order' => 2,
                'features' => [
                    Feature::EMPLOYEES,
                    Feature::ATTENDANCE,
                    Feature::SHIFTS,
                    Feature::TIMESHEET,
                    Feature::PAYROLL,
                    Feature::LEAVE,
                    Feature::REPORTS,
                ],
            ],
            Plan::PRO => [
                'name' => 'Pro',
                'price_monthly' => 599000,
                'max_branches' => 10,
                'max_employees' => 100,
                'sort_order' => 3,
                'features' => [
                    Feature::EMPLOYEES,
                    Feature::ATTENDANCE,
                    Feature::SHIFTS,
                    Feature::TIMESHEET,
                    Feature::PAYROLL,
                    Feature::LEAVE,
                    Feature::INVENTORY,
                    Feature::REPORTS,
                ],
            ],
            Plan::BUSINESS => [
                'name' => 'Business',
                'price_monthly' => 999000,
                'max_branches' => 50,
                'max_employees' => 300,
                'sort_order' => 4,
                'features' => [
                    Feature::EMPLOYEES,
                    Feature::ATTENDANCE,
                    Feature::SHIFTS,
                    Feature::TIMESHEET,
                    Feature::PAYROLL,
                    Feature::LEAVE,
                    Feature::INVENTORY,
                    Feature::POS,
                    Feature::ORDERS,
                    Feature::REPORTS,
                    Feature::AI_ASSISTANT,
                ],
            ],
            Plan::ENTERPRISE => [
                'name' => 'Enterprise',
                'price_monthly' => 0,
                'max_branches' => null,
                'max_employees' => null,
                'sort_order' => 5,
                'features' => array_column($features, 0),
            ],
        ];

        foreach ($plans as $code => $meta) {
            $plan = Plan::query()->updateOrCreate(
                ['code' => $code],
                [
                    'name' => $meta['name'],
                    'description' => $meta['name'].' plan',
                    'price_monthly' => $meta['price_monthly'],
                    'max_branches' => $meta['max_branches'],
                    'max_employees' => $meta['max_employees'],
                    'is_active' => true,
                    'sort_order' => $meta['sort_order'],
                ]
            );

            $sync = [];
            foreach ($meta['features'] as $featureCode) {
                $featureId = Feature::query()->where('code', $featureCode)->value('id');
                if ($featureId) {
                    $sync[$featureId] = ['enabled' => true];
                }
            }
            $plan->features()->sync($sync);
        }
    }
}
