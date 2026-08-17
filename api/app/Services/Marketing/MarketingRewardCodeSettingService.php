<?php

namespace App\Services\Marketing;

use App\Models\MarketingRewardCodeSetting;
use App\Support\Tenancy\TenantContext;
use Illuminate\Validation\ValidationException;

class MarketingRewardCodeSettingService
{
    /**
     * @return array<string, mixed>
     */
    public function show(): array
    {
        return $this->payload($this->ensureDefaults());
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function update(array $data): array
    {
        $settings = $this->ensureDefaults();
        $type = strtoupper((string) ($data['expiry_type'] ?? $settings->expiry_type));
        if (! in_array($type, ['DAYS', 'AFTER_DAYS', 'DATE', 'FIXED_DATE', 'NEVER'], true)) {
            $type = 'DAYS';
        }

        $settings->fill([
            'prefix' => strtoupper(trim((string) ($data['prefix'] ?? $settings->prefix))),
            'length' => max(1, (int) ($data['length'] ?? $settings->length)),
            'use_letters' => array_key_exists('use_letters', $data)
                ? (bool) $data['use_letters']
                : $settings->use_letters,
            'use_numbers' => array_key_exists('use_numbers', $data)
                ? (bool) $data['use_numbers']
                : $settings->use_numbers,
            'exclude_zero' => array_key_exists('exclude_zero', $data)
                ? (bool) $data['exclude_zero']
                : $settings->exclude_zero,
            'exclude_o' => array_key_exists('exclude_o', $data)
                ? (bool) $data['exclude_o']
                : $settings->exclude_o,
            'exclude_i' => array_key_exists('exclude_i', $data)
                ? (bool) $data['exclude_i']
                : $settings->exclude_i,
            'exclude_one' => array_key_exists('exclude_one', $data)
                ? (bool) $data['exclude_one']
                : $settings->exclude_one,
            'expiry_type' => $type === 'AFTER_DAYS' ? 'DAYS' : ($type === 'FIXED_DATE' ? 'DATE' : $type),
            'expiry_days' => isset($data['expiry_days']) ? (int) $data['expiry_days'] : $settings->expiry_days,
            'expiry_date' => $data['expiry_date'] ?? $settings->expiry_date,
            'reward_before_review' => array_key_exists('reward_before_review', $data)
                ? (bool) $data['reward_before_review']
                : $settings->reward_before_review,
        ]);
        $settings->save();

        return $this->payload($settings->fresh() ?? $settings);
    }

    public function ensureDefaults(?int $organizationId = null): MarketingRewardCodeSetting
    {
        $orgId = $organizationId ?: (int) TenantContext::id();
        if (! $orgId) {
            throw ValidationException::withMessages([
                'code_config' => 'Thiếu tổ chức để cấu hình mã quà.',
            ]);
        }

        $settings = MarketingRewardCodeSetting::query()
            ->where('organization_id', $orgId)
            ->first();

        if ($settings) {
            return $settings;
        }

        return MarketingRewardCodeSetting::query()->create([
            'organization_id' => $orgId,
            'prefix' => 'GEN',
            'pattern' => 'GEN-XXXX',
            'length' => 4,
            'use_letters' => true,
            'use_numbers' => true,
            'exclude_zero' => true,
            'exclude_o' => true,
            'exclude_i' => true,
            'exclude_one' => true,
            'expiry_type' => 'DAYS',
            'expiry_days' => 7,
            'expiry_date' => null,
            'reward_before_review' => false,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(MarketingRewardCodeSetting $settings): array
    {
        return [
            'prefix' => $settings->prefix,
            'length' => (int) $settings->length,
            'use_letters' => (bool) $settings->use_letters,
            'use_numbers' => (bool) $settings->use_numbers,
            'exclude_zero' => (bool) $settings->exclude_zero,
            'exclude_o' => (bool) $settings->exclude_o,
            'exclude_i' => (bool) $settings->exclude_i,
            'exclude_one' => (bool) $settings->exclude_one,
            'expiry_type' => $settings->expiry_type,
            'expiry_days' => $settings->expiry_days,
            'expiry_date' => optional($settings->expiry_date)?->format('Y-m-d'),
            'reward_before_review' => (bool) $settings->reward_before_review,
        ];
    }
}
