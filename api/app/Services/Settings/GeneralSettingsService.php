<?php

namespace App\Services\Settings;

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

class GeneralSettingsService
{
    public const DEFAULTS = [
        'work_hours_per_day' => 8,
        'week_start' => 'monday',
        'date_format' => 'd/m/Y',
        'currency' => 'VND',
        'language' => 'vi',
    ];

    public const WEEK_STARTS = ['monday', 'sunday'];

    public const DATE_FORMATS = ['d/m/Y', 'Y-m-d', 'm/d/Y'];

    public const CURRENCIES = ['VND', 'USD'];

    public const LANGUAGES = ['vi', 'en'];

    public function overview(): array
    {
        $organization = $this->current();

        return [
            'can_manage' => $this->canManage(),
            'general' => $this->fromOrganization($organization),
            'company' => $this->companyPayload($organization),
            'backup' => $this->backupPayload($organization),
            'system' => $this->systemStatus(),
            'users' => $this->userStats($organization),
            'version' => $this->versionPayload(),
        ];
    }

    public function fromOrganization(Organization $organization): array
    {
        $stored = $organization->settings['general'] ?? [];

        return $this->normalize(is_array($stored) ? $stored : []);
    }

    public function update(array $data): array
    {
        $this->assertCanManage();

        $organization = $this->current();
        $payload = $this->normalize(array_merge($this->fromOrganization($organization), $data));

        $settings = $organization->settings ?? [];
        $settings['general'] = $payload;
        $organization->settings = $settings;
        $organization->locale = $payload['language'];
        $organization->save();

        TenantContext::set($organization->fresh());

        return $payload;
    }

    public function backup(): array
    {
        $this->assertCanManage();

        $organization = $this->current();
        $snapshot = json_encode([
            'exported_at' => now()->toIso8601String(),
            'organization' => $this->companyPayload($organization),
            'general' => $this->fromOrganization($organization),
            'interface' => $organization->settings['interface'] ?? null,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $path = 'org-backups/'.$organization->id.'/'.now()->format('Ymd_His').'.json';
        Storage::disk('local')->put($path, $snapshot ?: '{}');
        $size = Storage::disk('local')->size($path);

        $settings = $organization->settings ?? [];
        $settings['backup'] = [
            'last_at' => now()->toIso8601String(),
            'size_bytes' => $size,
            'path' => $path,
        ];
        $organization->settings = $settings;
        $organization->save();

        TenantContext::set($organization->fresh());

        return $this->backupPayload($organization->fresh());
    }

    public function normalize(array $data): array
    {
        $hours = (int) ($data['work_hours_per_day'] ?? self::DEFAULTS['work_hours_per_day']);
        if ($hours < 4 || $hours > 12) {
            $hours = self::DEFAULTS['work_hours_per_day'];
        }

        return [
            'work_hours_per_day' => $hours,
            'week_start' => in_array($data['week_start'] ?? null, self::WEEK_STARTS, true)
                ? $data['week_start']
                : self::DEFAULTS['week_start'],
            'date_format' => in_array($data['date_format'] ?? null, self::DATE_FORMATS, true)
                ? $data['date_format']
                : self::DEFAULTS['date_format'],
            'currency' => in_array($data['currency'] ?? null, self::CURRENCIES, true)
                ? $data['currency']
                : self::DEFAULTS['currency'],
            'language' => in_array($data['language'] ?? null, self::LANGUAGES, true)
                ? $data['language']
                : self::DEFAULTS['language'],
        ];
    }

    protected function companyPayload(Organization $organization): array
    {
        return [
            'name' => $organization->name,
            'tax_code' => $organization->tax_code,
            'address' => $organization->address,
            'phone' => $organization->phone,
            'email' => $organization->email,
            'website' => $organization->website,
            'logo_url' => $organization->logoUrl(),
            'has_logo' => filled($organization->logo_path),
        ];
    }

    protected function backupPayload(Organization $organization): array
    {
        $stored = $organization->settings['backup'] ?? [];
        $at = is_array($stored) ? ($stored['last_at'] ?? null) : null;
        $size = is_array($stored) ? (int) ($stored['size_bytes'] ?? 0) : 0;

        $label = null;
        if (is_string($at) && $at !== '') {
            $label = Carbon::parse($at)
                ->timezone('Asia/Ho_Chi_Minh')
                ->format('d/m/Y · H:i');
        }

        return [
            'last_at' => $at,
            'last_label' => $label,
            'size_bytes' => $size,
            'size_label' => $size > 0 ? $this->sizeLabel($size) : null,
        ];
    }

    protected function userStats(Organization $organization): array
    {
        $userIds = OrganizationUser::query()
            ->where('organization_id', $organization->id)
            ->pluck('user_id');

        $total = $userIds->count();
        $unverified = $total === 0
            ? 0
            : User::query()
                ->whereIn('id', $userIds)
                ->whereNull('email_verified_at')
                ->count();

        return [
            'total' => $total,
            'active' => $total,
            'locked' => 0,
            'unverified' => $unverified,
        ];
    }

    protected function systemStatus(): array
    {
        $dbOk = false;
        try {
            DB::connection()->getPdo();
            $dbOk = true;
        } catch (Throwable) {
            $dbOk = false;
        }

        $memory = $this->memoryUsage();
        $disk = $this->diskUsage();

        return [
            'server' => ['label' => 'Hoạt động', 'ok' => true],
            'database' => ['label' => $dbOk ? 'Hoạt động' : 'Lỗi', 'ok' => $dbOk],
            'memory' => [
                'label' => $memory['percent'].'%',
                'percent' => $memory['percent'],
                'ok' => $memory['percent'] < 85,
            ],
            'disk' => [
                'label' => $disk['percent'].'%',
                'percent' => $disk['percent'],
                'ok' => $disk['percent'] < 85,
            ],
        ];
    }

    protected function versionPayload(): array
    {
        $released = (string) config('genky.released_at', '2026-08-01');
        $releasedLabel = Carbon::parse($released)
            ->timezone('Asia/Ho_Chi_Minh')
            ->format('d/m/Y');
        $product = (string) config('genky.product', 'HRM Pro');
        $version = (string) config('genky.version', '2.1.0');

        return [
            'product' => $product,
            'version' => $version,
            'label' => $product.' v'.$version,
            'latest' => true,
            'released_label' => $releasedLabel,
            'developer' => (string) config('genky.developer', 'Genky'),
        ];
    }

    /**
     * @return array{percent: int}
     */
    protected function memoryUsage(): array
    {
        $limit = $this->memoryLimitBytes();
        $used = memory_get_usage(true);
        if ($limit <= 0) {
            return ['percent' => 0];
        }

        return ['percent' => max(0, min(100, (int) round($used / $limit * 100)))];
    }

    /**
     * @return array{percent: int}
     */
    protected function diskUsage(): array
    {
        $path = base_path();
        $total = @disk_total_space($path);
        $free = @disk_free_space($path);
        if (! is_numeric($total) || $total <= 0 || ! is_numeric($free)) {
            return ['percent' => 0];
        }

        $used = max(0, (float) $total - (float) $free);

        return ['percent' => max(0, min(100, (int) round($used / (float) $total * 100)))];
    }

    protected function memoryLimitBytes(): int
    {
        $raw = trim((string) ini_get('memory_limit'));
        if ($raw === '' || $raw === '-1') {
            return 0;
        }

        $unit = strtoupper(substr($raw, -1));
        $value = (int) $raw;

        return match ($unit) {
            'G' => $value * 1024 * 1024 * 1024,
            'M' => $value * 1024 * 1024,
            'K' => $value * 1024,
            default => (int) $raw,
        };
    }

    protected function sizeLabel(int $bytes): string
    {
        if ($bytes < 1024) {
            return $bytes.' B';
        }
        if ($bytes < 1048576) {
            return rtrim(rtrim(number_format($bytes / 1024, 1, '.', ''), '0'), '.').' KB';
        }

        return rtrim(rtrim(number_format($bytes / 1048576, 1, '.', ''), '0'), '.').' MB';
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

    protected function canManage(): bool
    {
        /** @var User|null $user */
        $user = auth()->user();
        $role = $user?->roleIn($this->current());

        return in_array($role, [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
        ], true);
    }

    protected function assertCanManage(): void
    {
        if (! $this->canManage()) {
            throw new AuthorizationException('Bạn không có quyền cập nhật cài đặt chung.');
        }
    }
}
