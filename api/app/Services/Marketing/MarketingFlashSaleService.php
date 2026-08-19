<?php

namespace App\Services\Marketing;

use App\Models\Branch;
use App\Models\MarketingFlashSale;
use App\Models\MarketingFlashSaleProduct;
use App\Support\AppTimezone;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class MarketingFlashSaleService
{
    public const PRODUCT_TONES = [
        'from-amber-200 to-orange-300',
        'from-rose-200 to-pink-300',
        'from-yellow-100 to-amber-200',
        'from-orange-200 to-red-300',
        'from-emerald-200 to-teal-300',
        'from-sky-200 to-indigo-300',
        'from-lime-200 to-green-300',
        'from-fuchsia-200 to-purple-300',
    ];

    /**
     * @param  array<string, mixed>  $filters
     * @return array{stats: array<string, mixed>, data: list<array<string, mixed>>}
     */
    public function list(array $filters): array
    {
        $now = now(AppTimezone::ZONE);
        $base = $this->filteredQuery($filters, ignoreStatus: true);
        $stats = $this->statsFromQuery(clone $base, $now);

        $rows = $this->applyStatus($base, $filters['status'] ?? null, $now)
            ->with(['branch', 'products'])
            ->orderByDesc('starts_at')
            ->orderByDesc('id')
            ->get();

        return [
            'stats' => $stats,
            'data' => $rows->map(fn (MarketingFlashSale $row) => $this->payload($row, $now))->all(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function history(): array
    {
        $now = now(AppTimezone::ZONE);

        return MarketingFlashSale::query()
            ->with(['branch', 'products'])
            ->where(function ($q) use ($now) {
                $q->whereNotNull('ended_at')->orWhere('ends_at', '<', $now);
            })
            ->orderByDesc('ends_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (MarketingFlashSale $row) => $this->payload($row, $now))
            ->all();
    }

    public function find(int $id): MarketingFlashSale
    {
        return MarketingFlashSale::query()
            ->with(['branch', 'products'])
            ->findOrFail($id);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, ?int $userId): MarketingFlashSale
    {
        $starts = $this->parseTime($data['starts_at'] ?? null, 'starts_at');
        $ends = $this->parseTime($data['ends_at'] ?? null, 'ends_at');
        $this->assertRange($starts, $ends);

        return DB::transaction(function () use ($data, $userId, $starts, $ends) {
            $sale = MarketingFlashSale::query()->create([
                'branch_id' => $this->resolveBranchId($data['branch_id'] ?? null),
                'title' => trim((string) $data['title']),
                'banner' => $this->banner($data['banner'] ?? null),
                'starts_at' => $starts,
                'ends_at' => $ends,
                'slots' => $this->normalizeSlots($data['slots'] ?? null),
                'quota' => max(0, (int) ($data['quota'] ?? 0)),
                'sold_count' => max(0, (int) ($data['sold_count'] ?? 0)),
                'revenue' => max(0, (int) ($data['revenue'] ?? 0)),
                'created_by' => $userId,
            ]);

            $this->syncProducts($sale, $data['products'] ?? []);

            return $sale->fresh(['branch', 'products']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(MarketingFlashSale $sale, array $data): MarketingFlashSale
    {
        return DB::transaction(function () use ($sale, $data) {
            if (array_key_exists('title', $data)) {
                $title = trim((string) $data['title']);
                if ($title === '') {
                    throw ValidationException::withMessages([
                        'title' => 'Nhập tên chương trình.',
                    ]);
                }
                $sale->title = $title;
            }
            if (array_key_exists('branch_id', $data)) {
                $sale->branch_id = $this->resolveBranchId($data['branch_id']);
            }
            if (array_key_exists('banner', $data)) {
                $sale->banner = $this->banner($data['banner']);
            }
            if (array_key_exists('starts_at', $data)) {
                $sale->starts_at = $this->parseTime($data['starts_at'], 'starts_at');
            }
            if (array_key_exists('ends_at', $data)) {
                $sale->ends_at = $this->parseTime($data['ends_at'], 'ends_at');
            }
            if (array_key_exists('slots', $data)) {
                $sale->slots = $this->normalizeSlots($data['slots']);
            }
            if (array_key_exists('quota', $data)) {
                $sale->quota = max(0, (int) $data['quota']);
            }
            if (array_key_exists('sold_count', $data)) {
                $sale->sold_count = max(0, (int) $data['sold_count']);
            }
            if (array_key_exists('revenue', $data)) {
                $sale->revenue = max(0, (int) $data['revenue']);
            }

            $this->assertRange($sale->starts_at, $sale->ends_at);
            $sale->save();

            if (array_key_exists('products', $data)) {
                $this->syncProducts($sale, is_array($data['products']) ? $data['products'] : []);
            }

            return $sale->fresh(['branch', 'products']);
        });
    }

    public function end(MarketingFlashSale $sale): MarketingFlashSale
    {
        if ($sale->computedStatus() === MarketingFlashSale::STATUS_ENDED) {
            return $sale->load(['branch', 'products']);
        }

        $sale->ended_at = now(AppTimezone::ZONE);
        $sale->save();

        return $sale->fresh(['branch', 'products']);
    }

    public function delete(MarketingFlashSale $sale): void
    {
        foreach ($sale->products()->get() as $product) {
            $this->deleteImageFile($product->image);
        }
        $sale->delete();
    }

    public function uploadProductImage(
        MarketingFlashSale $sale,
        MarketingFlashSaleProduct $product,
        UploadedFile $file,
    ): MarketingFlashSaleProduct {
        if ((int) $product->flash_sale_id !== (int) $sale->id) {
            throw ValidationException::withMessages([
                'image' => 'Sản phẩm không thuộc chương trình này.',
            ]);
        }

        $orgId = (int) (TenantContext::id() ?: $product->organization_id);
        $path = $file->store('marketing-flash-sales/'.$orgId, 'public');
        $this->deleteImageFile($product->image);
        $product->image = $path;
        $product->save();

        return $product->fresh();
    }

    public function clearProductImage(
        MarketingFlashSale $sale,
        MarketingFlashSaleProduct $product,
    ): MarketingFlashSaleProduct {
        if ((int) $product->flash_sale_id !== (int) $sale->id) {
            throw ValidationException::withMessages([
                'image' => 'Sản phẩm không thuộc chương trình này.',
            ]);
        }

        $this->deleteImageFile($product->image);
        $product->image = null;
        $product->save();

        return $product->fresh();
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(MarketingFlashSale $sale, ?Carbon $now = null): array
    {
        $now ??= now(AppTimezone::ZONE);
        $status = $sale->computedStatus($now);
        $products = $sale->relationLoaded('products')
            ? $sale->products
            : $sale->products()->get();

        $remainUntil = null;
        if ($status === MarketingFlashSale::STATUS_RUNNING && $sale->ends_at) {
            $remainUntil = $sale->ends_at->copy()->timezone(AppTimezone::ZONE);
        } elseif ($status === MarketingFlashSale::STATUS_UPCOMING && $sale->starts_at) {
            $remainUntil = $sale->starts_at->copy()->timezone(AppTimezone::ZONE);
        }

        $remainMs = $remainUntil
            ? max(0, ($remainUntil->getTimestamp() - $now->getTimestamp()) * 1000)
            : 0;

        $quota = max(0, (int) $sale->quota);
        $sold = max(0, (int) $sale->sold_count);
        $progress = $quota > 0
            ? min(100, (int) round($sold / $quota * 100))
            : ($status === MarketingFlashSale::STATUS_ENDED ? 100 : 0);

        $mapped = $products->map(function (MarketingFlashSaleProduct $p) use ($sale, $now) {
            $state = $this->productSlotState($sale, $p, $now);
            $remainUntil = $state['remain_until'];
            $remainMs = $remainUntil
                ? max(0, ($remainUntil->getTimestamp() - $now->getTimestamp()) * 1000)
                : 0;

            return [
                'id' => $p->id,
                'name' => $p->name,
                'emoji' => $p->emoji ?: '🍱',
                'tone' => $p->tone ?: self::PRODUCT_TONES[0],
                'image' => $p->image,
                'image_url' => $p->imageUrl(),
                'price' => (int) $p->price,
                'original' => (int) $p->original_price,
                'slot_start' => $this->hm($p->slot_start),
                'slot_end' => $this->hm($p->slot_end),
                'slot_label' => $this->productSlotLabel($p),
                'status' => $state['status'],
                'remain_ms' => $remainMs,
                'remain_until' => $remainUntil?->timezone(AppTimezone::ZONE)->toIso8601String(),
            ];
        })->values()->all();

        $active = collect($mapped)->firstWhere('status', MarketingFlashSale::STATUS_RUNNING)
            ?? collect($mapped)->firstWhere('status', MarketingFlashSale::STATUS_UPCOMING);

        if (is_array($active) && ! empty($active['remain_until'])) {
            $remainUntil = Carbon::parse((string) $active['remain_until']);
            $remainMs = max(0, ($remainUntil->getTimestamp() - $now->getTimestamp()) * 1000);
        }

        $slotsFromProducts = array_values(array_unique(array_filter(
            array_map(fn (array $p) => $p['slot_label'] ?? '', $mapped),
        )));
        $slots = $slotsFromProducts !== []
            ? $slotsFromProducts
            : $this->normalizeSlots($sale->slots);

        return [
            'id' => $sale->id,
            'title' => $sale->title,
            'branch_id' => $sale->branch_id,
            'branch' => $sale->branch?->name ?? 'Tất cả chi nhánh',
            'banner' => $this->banner($sale->banner),
            'status' => $status,
            'starts_at' => $sale->starts_at?->timezone(AppTimezone::ZONE)->toIso8601String(),
            'ends_at' => $sale->ends_at?->timezone(AppTimezone::ZONE)->toIso8601String(),
            'date_label' => $this->dateLabel($sale),
            'slots' => $slots,
            'slots_label' => $slots === [] ? '—' : implode('  |  ', $slots),
            'quota' => $quota,
            'sold' => $sold,
            'revenue' => (int) $sale->revenue,
            'progress' => $progress,
            'remain_ms' => $remainMs,
            'remain_until' => $remainUntil?->timezone(AppTimezone::ZONE)->toIso8601String(),
            'active_product_id' => is_array($active) ? ($active['id'] ?? null) : null,
            'active_product_name' => is_array($active) ? ($active['name'] ?? null) : null,
            'products' => $mapped,
            'extra_products' => max(0, count($mapped) - 3),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    protected function filteredQuery(array $filters, bool $ignoreStatus = false)
    {
        $q = MarketingFlashSale::query();

        $branchId = isset($filters['branch_id']) && $filters['branch_id'] !== ''
            ? (int) $filters['branch_id']
            : 0;
        if ($branchId > 0) {
            $q->where('branch_id', $branchId);
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $q->where('title', 'like', '%'.$search.'%');
        }

        $month = (string) ($filters['month'] ?? '');
        if (preg_match('/^(\d{4})-(\d{2})$/', $month, $m)) {
            $start = Carbon::createFromDate((int) $m[1], (int) $m[2], 1, AppTimezone::ZONE)->startOfMonth();
            $end = $start->copy()->endOfMonth();
            $q->where('starts_at', '<=', $end)->where('ends_at', '>=', $start);
        }

        if (! $ignoreStatus) {
            $q = $this->applyStatus($q, $filters['status'] ?? null, now(AppTimezone::ZONE));
        }

        return $q;
    }

    protected function applyStatus($query, mixed $status, Carbon $now)
    {
        $status = is_string($status) ? $status : 'all';
        if ($status === '' || $status === 'all') {
            return $query;
        }

        if ($status === MarketingFlashSale::STATUS_ENDED) {
            return $query->where(function ($q) use ($now) {
                $q->whereNotNull('ended_at')->orWhere('ends_at', '<', $now);
            });
        }

        if ($status === MarketingFlashSale::STATUS_UPCOMING) {
            return $query->whereNull('ended_at')
                ->where('starts_at', '>', $now);
        }

        if ($status === MarketingFlashSale::STATUS_RUNNING) {
            return $query->whereNull('ended_at')
                ->where('starts_at', '<=', $now)
                ->where('ends_at', '>=', $now);
        }

        return $query;
    }

    /**
     * @return array<string, mixed>
     */
    protected function statsFromQuery($query, Carbon $now): array
    {
        $rows = (clone $query)->get(['id', 'starts_at', 'ends_at', 'ended_at', 'created_at']);
        $running = 0;
        $upcoming = 0;
        $ended = 0;
        $upcoming24h = 0;

        foreach ($rows as $row) {
            $status = $row->computedStatus($now);
            if ($status === MarketingFlashSale::STATUS_RUNNING) {
                $running++;
            } elseif ($status === MarketingFlashSale::STATUS_UPCOMING) {
                $upcoming++;
                if ($row->starts_at && $row->starts_at->lte($now->copy()->addDay())) {
                    $upcoming24h++;
                }
            } else {
                $ended++;
            }
        }

        $monthStart = $now->copy()->startOfMonth();
        $prevStart = $monthStart->copy()->subMonth();
        $createdThis = MarketingFlashSale::query()
            ->whereBetween('created_at', [$monthStart, $now->copy()->endOfMonth()])
            ->count();
        $createdPrev = MarketingFlashSale::query()
            ->whereBetween('created_at', [$prevStart, $monthStart->copy()->subSecond()])
            ->count();

        return [
            'total' => $rows->count(),
            'running' => $running,
            'upcoming' => $upcoming,
            'ended' => $ended,
            'upcoming_in_24h' => $upcoming24h,
            'created_this_month' => $createdThis,
            'created_last_month' => $createdPrev,
            'month_delta' => $createdThis - $createdPrev,
        ];
    }

    /**
     * @param  list<mixed>|null  $products
     */
    protected function syncProducts(MarketingFlashSale $sale, ?array $products): void
    {
        $items = array_values(array_filter(
            $products ?? [],
            fn ($row) => is_array($row) && trim((string) ($row['name'] ?? '')) !== '',
        ));

        $keepIds = [];
        foreach ($items as $i => $row) {
            $name = trim((string) $row['name']);
            [$slotStart, $slotEnd] = $this->parseProductSlot($row);
            $attrs = [
                'name' => $name,
                'emoji' => isset($row['emoji']) ? (trim((string) $row['emoji']) ?: null) : '🍱',
                'tone' => isset($row['tone']) && is_string($row['tone']) && $row['tone'] !== ''
                    ? $row['tone']
                    : self::PRODUCT_TONES[$i % count(self::PRODUCT_TONES)],
                'slot_start' => $slotStart,
                'slot_end' => $slotEnd,
                'price' => max(0, (int) ($row['price'] ?? 0)),
                'original_price' => max(0, (int) ($row['original_price'] ?? $row['original'] ?? 0)),
                'sort_order' => $i,
            ];

            $id = isset($row['id']) ? (int) $row['id'] : 0;
            if ($id > 0) {
                $existing = MarketingFlashSaleProduct::query()
                    ->where('flash_sale_id', $sale->id)
                    ->where('id', $id)
                    ->first();
                if ($existing) {
                    $existing->fill($attrs)->save();
                    $keepIds[] = $existing->id;

                    continue;
                }
            }

            $created = $sale->products()->create($attrs);
            $keepIds[] = $created->id;
        }

        $removed = $sale->products()
            ->when($keepIds !== [], fn ($q) => $q->whereNotIn('id', $keepIds))
            ->get();
        foreach ($removed as $product) {
            $this->deleteImageFile($product->image);
            $product->delete();
        }

        $labels = $sale->products()->get()
            ->map(fn (MarketingFlashSaleProduct $p) => $this->productSlotLabel($p))
            ->filter()
            ->unique()
            ->values()
            ->all();
        if ($labels !== []) {
            $sale->slots = $labels;
            $sale->save();
        }
    }

    protected function resolveBranchId(mixed $id): ?int
    {
        if ($id === null || $id === '' || (int) $id <= 0) {
            return null;
        }

        $branchId = (int) $id;
        $exists = Branch::query()->whereKey($branchId)->exists();
        if (! $exists) {
            throw ValidationException::withMessages([
                'branch_id' => 'Chi nhánh không hợp lệ.',
            ]);
        }

        return $branchId;
    }

    protected function parseTime(mixed $value, string $field): Carbon
    {
        if ($value instanceof Carbon) {
            return $value->timezone(AppTimezone::ZONE);
        }

        $raw = trim((string) $value);
        if ($raw === '') {
            throw ValidationException::withMessages([
                $field => 'Thời gian không hợp lệ.',
            ]);
        }

        try {
            return Carbon::parse($raw, AppTimezone::ZONE);
        } catch (\Throwable) {
            throw ValidationException::withMessages([
                $field => 'Thời gian không hợp lệ.',
            ]);
        }
    }

    protected function assertRange(?Carbon $starts, ?Carbon $ends): void
    {
        if (! $starts || ! $ends || $ends->lte($starts)) {
            throw ValidationException::withMessages([
                'ends_at' => 'Thời điểm kết thúc phải sau lúc bắt đầu.',
            ]);
        }
    }

    protected function banner(mixed $value): string
    {
        $banner = (string) ($value ?: '88');

        return in_array($banner, MarketingFlashSale::BANNERS, true) ? $banner : '88';
    }

    /**
     * @return list<string>
     */
    protected function normalizeSlots(mixed $slots): array
    {
        if (! is_array($slots)) {
            return [];
        }

        $out = [];
        foreach ($slots as $slot) {
            $text = trim((string) $slot);
            $text = str_replace(['–', '—'], '-', $text);
            $text = preg_replace('/\s*-\s*/', '-', $text) ?? $text;
            if ($text === '') {
                continue;
            }
            if (! preg_match('/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/', $text)) {
                continue;
            }
            [$a, $b] = explode('-', $text, 2);
            $out[] = $a.' - '.$b;
        }

        return array_values(array_unique($out));
    }

    protected function slotsLabel(mixed $slots): string
    {
        $list = $this->normalizeSlots($slots);

        return $list === [] ? '—' : implode('  |  ', $list);
    }

    protected function dateLabel(MarketingFlashSale $sale): string
    {
        $start = $sale->starts_at?->timezone(AppTimezone::ZONE);
        $end = $sale->ends_at?->timezone(AppTimezone::ZONE);
        if (! $start) {
            return '—';
        }
        if (! $end || $start->isSameDay($end)) {
            return $start->format('d/m/Y');
        }

        return $start->format('d/m/Y').'  –  '.$end->format('d/m/Y');
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array{0: ?string, 1: ?string}
     */
    protected function parseProductSlot(array $row): array
    {
        $start = $this->hm($row['slot_start'] ?? null);
        $end = $this->hm($row['slot_end'] ?? null);
        if ($start && $end) {
            return [$start, $end];
        }

        $fromSlot = $this->normalizeSlots([$row['slot'] ?? '']);
        if ($fromSlot !== []) {
            [$a, $b] = explode(' - ', $fromSlot[0], 2);

            return [$this->hm($a), $this->hm($b)];
        }

        return [null, null];
    }

    protected function hm(mixed $value): ?string
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }
        if (preg_match('/^(\d{1,2}):([0-5]\d)/', $raw, $m)) {
            $h = (int) $m[1];
            if ($h > 23) {
                return null;
            }

            return sprintf('%02d:%s', $h, $m[2]);
        }

        return null;
    }

    protected function productSlotLabel(MarketingFlashSaleProduct $product): string
    {
        $start = $this->hm($product->slot_start);
        $end = $this->hm($product->slot_end);
        if (! $start || ! $end) {
            return '';
        }

        return $start.' - '.$end;
    }

    /**
     * @return array{status: string, remain_until: ?Carbon}
     */
    protected function productSlotState(
        MarketingFlashSale $sale,
        MarketingFlashSaleProduct $product,
        Carbon $now,
    ): array {
        $campaignStatus = $sale->computedStatus($now);
        $startHm = $this->hm($product->slot_start);
        $endHm = $this->hm($product->slot_end);

        if ($campaignStatus === MarketingFlashSale::STATUS_ENDED) {
            return ['status' => MarketingFlashSale::STATUS_ENDED, 'remain_until' => null];
        }

        if (! $startHm || ! $endHm) {
            if ($campaignStatus === MarketingFlashSale::STATUS_RUNNING) {
                return ['status' => MarketingFlashSale::STATUS_RUNNING, 'remain_until' => $sale->ends_at];
            }
            if ($campaignStatus === MarketingFlashSale::STATUS_UPCOMING) {
                return ['status' => MarketingFlashSale::STATUS_UPCOMING, 'remain_until' => $sale->starts_at];
            }

            return ['status' => MarketingFlashSale::STATUS_ENDED, 'remain_until' => null];
        }

        if ($campaignStatus === MarketingFlashSale::STATUS_UPCOMING && $sale->starts_at) {
            $at = $sale->starts_at->copy()->setTimeFromTimeString($startHm.':00');
            if ($at->lt($sale->starts_at)) {
                $at->addDay();
            }

            return ['status' => MarketingFlashSale::STATUS_UPCOMING, 'remain_until' => $at];
        }

        [$winStart, $winEnd] = $this->slotWindow($now, $startHm, $endHm);
        if ($sale->starts_at && $winStart->lt($sale->starts_at)) {
            $winStart = $sale->starts_at->copy();
        }
        if ($sale->ends_at && $winEnd->gt($sale->ends_at)) {
            $winEnd = $sale->ends_at->copy();
        }

        if ($now->gte($winStart) && $now->lt($winEnd)) {
            return ['status' => MarketingFlashSale::STATUS_RUNNING, 'remain_until' => $winEnd];
        }

        if ($now->lt($winStart) && $sale->ends_at && $winStart->lte($sale->ends_at)) {
            return ['status' => MarketingFlashSale::STATUS_UPCOMING, 'remain_until' => $winStart];
        }

        $nextStart = $now->copy()->addDay()->setTimeFromTimeString($startHm.':00');
        if ($sale->ends_at && $nextStart->lte($sale->ends_at)) {
            return ['status' => MarketingFlashSale::STATUS_UPCOMING, 'remain_until' => $nextStart];
        }

        return ['status' => MarketingFlashSale::STATUS_ENDED, 'remain_until' => null];
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    protected function slotWindow(Carbon $now, string $startHm, string $endHm): array
    {
        $start = $now->copy()->setTimeFromTimeString($startHm.':00');
        $end = $now->copy()->setTimeFromTimeString($endHm.':00');

        if ($end->gt($start)) {
            return [$start, $end];
        }

        if ($now->lt($end)) {
            return [$start->copy()->subDay(), $end];
        }

        return [$start, $end->copy()->addDay()];
    }

    protected function deleteImageFile(?string $path): void
    {
        if (! $path || str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return;
        }
        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }
}
