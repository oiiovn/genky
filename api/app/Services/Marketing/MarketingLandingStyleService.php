<?php

namespace App\Services\Marketing;

use App\Models\Organization;
use App\Support\Tenancy\TenantContext;

class MarketingLandingStyleService
{
    /**
     * @return array{style: array<string, mixed>, landing: array<string, mixed>}
     */
    public function show(): array
    {
        $org = TenantContext::organization();

        return $this->payloadFor($org);
    }

    /**
     * @return array{style: array<string, mixed>, landing: array<string, mixed>}
     */
    public function showForOrganization(int $orgId): array
    {
        return $this->payloadFor(Organization::query()->find($orgId));
    }

    /**
     * @param  array{style?: array<string, mixed>, landing?: array<string, mixed>}  $data
     * @return array{style: array<string, mixed>, landing: array<string, mixed>}
     */
    public function update(array $data): array
    {
        $org = $this->current();
        $settings = is_array($org->settings) ? $org->settings : [];
        $marketing = is_array($settings['marketing'] ?? null) ? $settings['marketing'] : [];
        $marketing['style'] = $this->sanitizeStyle($data['style'] ?? []);
        $marketing['landing'] = $this->sanitizeLanding($data['landing'] ?? []);
        $settings['marketing'] = $marketing;
        $org->settings = $settings;
        $org->save();

        TenantContext::set($org->fresh());

        return $this->payloadFor($org->fresh());
    }

    /**
     * @return array{style: array<string, mixed>, landing: array<string, mixed>}
     */
    protected function payloadFor(?Organization $org): array
    {
        if (! $org) {
            return ['style' => [], 'landing' => []];
        }

        $marketing = is_array($org->settings) ? ($org->settings['marketing'] ?? []) : [];
        $style = is_array($marketing['style'] ?? null) ? $marketing['style'] : [];
        $landing = is_array($marketing['landing'] ?? null) ? $marketing['landing'] : [];

        if (! empty($landing['buyNowUrl']) && empty($landing['shopeeFoodUrl'])) {
            $landing['shopeeFoodUrl'] = $landing['buyNowUrl'];
        }

        return [
            'style' => $this->sanitizeStyle($style),
            'landing' => $this->sanitizeLanding($landing),
        ];
    }

    /**
     * @param  array<string, mixed>  $style
     * @return array<string, mixed>
     */
    protected function sanitizeStyle(array $style): array
    {
        $out = [];
        foreach (['primary', 'secondary', 'background', 'text'] as $key) {
            if (isset($style[$key]) && is_string($style[$key])) {
                $out[$key] = mb_substr($style[$key], 0, 32);
            }
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $landing
     * @return array<string, mixed>
     */
    protected function sanitizeLanding(array $landing): array
    {
        $keys = [
            'shopName', 'tagline', 'storeInfoLabel', 'thankYou', 'headline',
            'headlineAccent', 'step1', 'step2', 'step3', 'badge', 'expiry',
            'formTitle', 'formHint', 'orderPlaceholder', 'confirmLabel',
            'orderHelp', 'orderGuide', 'giftsTitle', 'notesTitle', 'notes',
            'footerTitle', 'footerText', 'fontFamily', 'guideAudioLabel',
            'winTitle', 'winMessage', 'buyNowLabel', 'buyNowUrl',
            'shopeeFoodUrl', 'grabFoodUrl',
        ];
        $out = [];
        foreach ($keys as $key) {
            if (! array_key_exists($key, $landing)) {
                continue;
            }
            $value = $landing[$key];
            if (is_string($value)) {
                $out[$key] = mb_substr($value, 0, 2000);
            }
        }
        if (isset($landing['buttonRadius']) && is_numeric($landing['buttonRadius'])) {
            $out['buttonRadius'] = max(8, min(28, (int) $landing['buttonRadius']));
        }

        return $out;
    }

    protected function current(): Organization
    {
        $org = TenantContext::organization();
        if (! $org) {
            abort(403, 'Thiếu tổ chức.');
        }

        return $org;
    }
}
