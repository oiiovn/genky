<?php

namespace App\Services\Billing;

use App\Models\Plan;
use App\Models\Subscription;
use App\Support\Tenancy\TenantContext;

class PlanCatalogService
{
    /**
     * Marketing copy khớp màn hình nâng cấp gói.
     *
     * @return array<string, array<string, mixed>>
     */
    public function marketing(): array
    {
        return [
            Plan::STARTER => [
                'tagline' => 'Dành cho doanh nghiệp nhỏ bắt đầu số hóa',
                'tone' => 'blue',
                'popular' => false,
                'contact_only' => false,
                'price_monthly' => 299000,
                'savings_yearly' => null,
                'highlights' => [
                    'Tối đa 30 nhân viên',
                    'Chấm công & Ca làm',
                    'Lịch làm việc',
                    'Bảng công cơ bản',
                    'Quản lý nghỉ phép',
                    'Báo cáo cơ bản',
                ],
            ],
            Plan::PRO => [
                'tagline' => 'Dành cho doanh nghiệp đang phát triển nhanh',
                'tone' => 'purple',
                'popular' => true,
                'contact_only' => false,
                'price_monthly' => 599000,
                'savings_yearly' => 1200000,
                'highlights' => [
                    'Tối đa 100 nhân viên',
                    'Tất cả tính năng Starter',
                    'Báo cáo nâng cao',
                    'Quản lý lương',
                    'Thưởng / Phạt',
                    'Nghỉ phép nâng cao',
                    'Xuất Excel',
                    'Hỗ trợ ưu tiên',
                ],
            ],
            Plan::BUSINESS => [
                'tagline' => 'Dành cho doanh nghiệp vừa và lớn',
                'tone' => 'orange',
                'popular' => false,
                'contact_only' => false,
                'price_monthly' => 999000,
                'savings_yearly' => 2400000,
                'highlights' => [
                    'Tối đa 300 nhân viên',
                    'Tất cả tính năng Pro',
                    'Phân quyền nâng cao',
                    'Tích hợp API',
                    'Nhật ký hệ thống',
                    'Hỗ trợ đa chi nhánh',
                    'Sao lưu tự động',
                    'Hỗ trợ ưu tiên 24/7',
                ],
            ],
            Plan::ENTERPRISE => [
                'tagline' => 'Giải pháp toàn diện cho quy mô lớn',
                'tone' => 'green',
                'popular' => false,
                'contact_only' => true,
                'price_monthly' => null,
                'savings_yearly' => null,
                'highlights' => [
                    'Không giới hạn nhân viên',
                    'Tất cả tính năng Business',
                    'Tùy chỉnh theo yêu cầu',
                    'Hệ thống riêng',
                    'Hỗ trợ triển khai',
                    'Đào tạo & bảo hành riêng',
                    'Hỗ trợ VIP 24/7',
                ],
            ],
        ];
    }

    public function catalog(): array
    {
        $organization = TenantContext::organization();
        $current = $organization
            ? Subscription::query()
                ->with('plan')
                ->where('organization_id', $organization->id)
                ->where('status', 'active')
                ->latest('id')
                ->first()
            : null;

        $marketing = $this->marketing();
        $codes = array_keys($marketing);

        $plans = Plan::query()
            ->whereIn('code', $codes)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->keyBy('code');

        $items = [];
        foreach ($codes as $code) {
            $meta = $marketing[$code];
            $plan = $plans->get($code);
            $monthly = $meta['price_monthly'];
            $yearly = $monthly !== null ? $monthly * 12 : null;

            $items[] = [
                'id' => $plan?->id,
                'code' => $code,
                'name' => $plan?->name ?? ucfirst($code),
                'tagline' => $meta['tagline'],
                'tone' => $meta['tone'],
                'popular' => $meta['popular'],
                'contact_only' => $meta['contact_only'],
                'price_monthly' => $monthly,
                'price_yearly' => $yearly,
                'price_yearly_full' => $yearly,
                'savings_yearly' => $meta['savings_yearly'],
                'max_employees' => $plan?->max_employees,
                'max_branches' => $plan?->max_branches,
                'highlights' => $meta['highlights'],
                'is_current' => $current?->plan?->code === $code,
            ];
        }

        return [
            'billing_cycle' => 'yearly',
            'trial_days' => 14,
            'current_plan' => $current?->plan ? [
                'code' => $current->plan->code,
                'name' => $current->plan->name,
            ] : null,
            'plans' => $items,
        ];
    }
}
