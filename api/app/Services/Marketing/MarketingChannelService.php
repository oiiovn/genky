<?php

namespace App\Services\Marketing;

use App\Models\MarketingCampaignChannel;
use App\Models\MarketingChannel;
use App\Models\MarketingReview;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MarketingChannelService
{
    /**
     * @return list<array<string, mixed>>
     */
    public function list(): array
    {
        return MarketingChannel::query()
            ->ordered()
            ->get()
            ->map(fn (MarketingChannel $c) => $this->payload($c))
            ->all();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): MarketingChannel
    {
        $name = trim((string) $data['name']);
        $rawCode = isset($data['code']) ? trim((string) $data['code']) : '';
        $code = $rawCode !== ''
            ? $this->normalizeCode($rawCode)
            : $this->uniqueCodeFromName($name);
        $this->assertCodeUnique($code);

        $sortOrder = isset($data['sort_order'])
            ? (int) $data['sort_order']
            : ((int) MarketingChannel::query()->max('sort_order') + 1);

        return MarketingChannel::query()->create([
            'name' => $name,
            'code' => $code,
            'color' => $this->normalizeColor($data['color'] ?? null),
            'icon' => null,
            'enabled' => array_key_exists('enabled', $data)
                ? (bool) $data['enabled']
                : true,
            'sort_order' => max(0, $sortOrder),
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(MarketingChannel $channel, array $data): MarketingChannel
    {
        if (array_key_exists('code', $data) && $data['code'] !== null) {
            $code = $this->normalizeCode((string) $data['code']);
            $this->assertCodeUnique($code, $channel->id);
            $channel->code = $code;
        }

        if (array_key_exists('name', $data) && $data['name'] !== null) {
            $channel->name = trim((string) $data['name']);
        }
        if (array_key_exists('color', $data)) {
            $channel->color = $this->normalizeColor($data['color']);
        }
        // Không nhận icon từ client — luôn để trống.
        if (array_key_exists('icon', $data)) {
            $channel->icon = null;
        }
        if (array_key_exists('enabled', $data)) {
            $channel->enabled = (bool) $data['enabled'];
        }
        if (array_key_exists('sort_order', $data) && $data['sort_order'] !== null) {
            $channel->sort_order = max(0, (int) $data['sort_order']);
        }

        $channel->save();

        return $channel->fresh();
    }

    public function delete(MarketingChannel $channel): void
    {
        $inReviews = MarketingReview::query()
            ->where('channel_id', $channel->id)
            ->exists();
        if ($inReviews) {
            throw ValidationException::withMessages([
                'channel' => 'Không xoá được: kênh đã có đánh giá gắn vào.',
            ]);
        }

        $inCampaigns = MarketingCampaignChannel::query()
            ->where('channel_id', $channel->id)
            ->exists();
        if ($inCampaigns) {
            throw ValidationException::withMessages([
                'channel' => 'Không xoá được: kênh đang gắn chiến dịch. Hãy gỡ khỏi chiến dịch trước.',
            ]);
        }

        $channel->delete();
    }

    /**
     * @param  list<int>  $ids  Thứ tự mới (đầu danh sách = sort_order 1)
     * @return list<array<string, mixed>>
     */
    public function reorder(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if ($ids === []) {
            throw ValidationException::withMessages([
                'ids' => 'Danh sách id kênh không được trống.',
            ]);
        }

        $existing = MarketingChannel::query()
            ->whereIn('id', $ids)
            ->pluck('id')
            ->all();

        if (count($existing) !== count($ids)) {
            throw ValidationException::withMessages([
                'ids' => 'Có id kênh không hợp lệ hoặc không thuộc tổ chức.',
            ]);
        }

        DB::transaction(function () use ($ids) {
            foreach ($ids as $index => $id) {
                MarketingChannel::query()
                    ->whereKey($id)
                    ->update(['sort_order' => $index + 1]);
            }
        });

        return $this->list();
    }

    /**
     * Seed kênh mẫu (theo UI) nếu org chưa có kênh nào.
     *
     * @return list<array<string, mixed>>
     */
    public function seedDefaultsIfEmpty(): array
    {
        if (MarketingChannel::query()->exists()) {
            return $this->list();
        }

        $defaults = [
            ['name' => 'ShopeeFood', 'code' => 'SHOPEEFOOD', 'color' => '#FF4E00', 'enabled' => true],
            ['name' => 'GrabFood', 'code' => 'GRABFOOD', 'color' => '#00B14F', 'enabled' => true],
        ];

        DB::transaction(function () use ($defaults) {
            foreach ($defaults as $i => $row) {
                MarketingChannel::query()->create([
                    ...$row,
                    'icon' => null,
                    'sort_order' => $i + 1,
                ]);
            }
        });

        return $this->list();
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(MarketingChannel $channel): array
    {
        return [
            'id' => $channel->id,
            'name' => $channel->name,
            'code' => $channel->code,
            'color' => $channel->color,
            'icon' => $channel->icon,
            'enabled' => (bool) $channel->enabled,
            'sort_order' => (int) $channel->sort_order,
            'created_at' => optional($channel->created_at)?->toIso8601String(),
            'updated_at' => optional($channel->updated_at)?->toIso8601String(),
        ];
    }

    protected function uniqueCodeFromName(string $name): string
    {
        $base = strtoupper(trim($name));
        $base = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $base) ?: $base;
        $base = preg_replace('/[^A-Z0-9]+/', '_', $base) ?? '';
        $base = trim($base, '_');
        if ($base === '') {
            $base = 'CHANNEL';
        }
        $base = substr($base, 0, 40);

        $candidate = $base;
        $i = 2;
        while (MarketingChannel::query()->where('code', $candidate)->exists()) {
            $suffix = '_'.$i;
            $candidate = substr($base, 0, max(1, 64 - strlen($suffix))).$suffix;
            $i++;
        }

        return $candidate;
    }

    protected function normalizeCode(string $code): string
    {
        $code = strtoupper(trim($code));
        $code = preg_replace('/[^A-Z0-9_]/', '', $code) ?? '';
        if ($code === '') {
            throw ValidationException::withMessages([
                'code' => 'Mã kênh không hợp lệ.',
            ]);
        }

        return $code;
    }

    protected function normalizeColor(mixed $color): ?string
    {
        if ($color === null || $color === '') {
            return null;
        }
        $color = trim((string) $color);
        if (! preg_match('/^#?[0-9A-Fa-f]{6}$/', $color)) {
            throw ValidationException::withMessages([
                'color' => 'Màu phải dạng hex (#RRGGBB).',
            ]);
        }

        return str_starts_with($color, '#') ? strtoupper($color) : '#'.strtoupper($color);
    }

    protected function normalizeIcon(mixed $icon): ?string
    {
        if ($icon === null || $icon === '') {
            return null;
        }
        $icon = strtolower(trim((string) $icon));
        $icon = preg_replace('/[^a-z0-9\-]/', '', $icon) ?? '';

        return $icon !== '' ? $icon : null;
    }

    protected function assertCodeUnique(string $code, ?int $ignoreId = null): void
    {
        $q = MarketingChannel::query()->where('code', $code);
        if ($ignoreId) {
            $q->where('id', '!=', $ignoreId);
        }
        if ($q->exists()) {
            throw ValidationException::withMessages([
                'code' => 'Mã kênh đã tồn tại trong tổ chức.',
            ]);
        }

        // Đảm bảo tenant context có org (BelongsToOrganization creating)
        if (! TenantContext::id()) {
            throw ValidationException::withMessages([
                'organization' => 'Thiếu ngữ cảnh tổ chức.',
            ]);
        }
    }
}
