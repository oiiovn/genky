<?php

namespace App\Services\Settings;

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

class InterfaceSettingsService
{
    public const DEFAULTS = [
        'theme_preset' => 'purple',
        'primary_color' => '#111827',
        'secondary_color' => '#F3F4F6',
        'display_mode' => 'light',
        'sidebar_style' => 'expanded',
        'rounded_corners' => true,
        'animations_enabled' => true,
    ];

    public const THEME_PRESETS = ['purple', 'blue', 'green', 'orange', 'pink', 'slate'];

    public function show(): array
    {
        return $this->fromOrganization($this->current());
    }

    public function fromOrganization(Organization $organization): array
    {
        $stored = $organization->settings['interface'] ?? [];

        return $this->normalize(is_array($stored) ? $stored : []);
    }

    public function update(array $data): array
    {
        $this->assertCanManage();

        $organization = $this->current();
        $payload = $this->normalize(array_merge($this->fromOrganization($organization), $data));

        $settings = $organization->settings ?? [];
        $settings['interface'] = $payload;
        $organization->settings = $settings;
        $organization->save();

        TenantContext::set($organization->fresh());

        return $payload;
    }

    public function reset(): array
    {
        return $this->update(self::DEFAULTS);
    }

    public function normalize(array $data): array
    {
        $preset = in_array($data['theme_preset'] ?? null, self::THEME_PRESETS, true)
            ? $data['theme_preset']
            : self::DEFAULTS['theme_preset'];

        $primary = $this->hex(
            $data['primary_color'] ?? self::DEFAULTS['primary_color'],
            self::DEFAULTS['primary_color'],
        );
        $secondary = $this->hex(
            $data['secondary_color'] ?? self::DEFAULTS['secondary_color'],
            self::DEFAULTS['secondary_color'],
        );

        if ($preset === 'purple' && $primary === '#6366F1') {
            $primary = self::DEFAULTS['primary_color'];
            $secondary = self::DEFAULTS['secondary_color'];
        }

        return [
            'theme_preset' => $preset,
            'primary_color' => $primary,
            'secondary_color' => $secondary,
            'display_mode' => ($data['display_mode'] ?? '') === 'dark' ? 'dark' : 'light',
            'sidebar_style' => ($data['sidebar_style'] ?? '') === 'collapsed' ? 'collapsed' : 'expanded',
            'rounded_corners' => $this->bool($data['rounded_corners'] ?? self::DEFAULTS['rounded_corners']),
            'animations_enabled' => $this->bool($data['animations_enabled'] ?? self::DEFAULTS['animations_enabled']),
        ];
    }

    protected function current(): Organization
    {
        $organization = TenantContext::organization();

        if (! $organization) {
            throw ValidationException::withMessages([
                'organization' => ['Không xác định được tổ chức hiện tại.'],
            ]);
        }

        return $organization;
    }

    protected function assertCanManage(): void
    {
        /** @var User|null $user */
        $user = auth()->user();
        $role = $user?->roleIn($this->current());

        if (! in_array($role, [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
        ], true)) {
            throw new AuthorizationException('Bạn không có quyền cập nhật giao diện.');
        }
    }

    protected function hex(mixed $value, string $fallback): string
    {
        $raw = strtoupper(trim((string) $value));

        if (preg_match('/^#[0-9A-F]{6}$/', $raw) !== 1) {
            return $fallback;
        }

        return $raw;
    }

    protected function bool(mixed $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }
}
