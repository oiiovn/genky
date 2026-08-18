<?php

namespace App\Services\Marketing;

use App\Models\MarketingCampaignReward;
use App\Models\MarketingReward;
use App\Models\MarketingRewardCode;
use App\Models\MarketingRewardRedemption;
use App\Models\MarketingReviewCampaign;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class MarketingRewardService
{
    /**
     * @return list<array<string, mixed>>
     */
    public function list(): array
    {
        return MarketingReward::query()
            ->ordered()
            ->get()
            ->map(fn (MarketingReward $r) => $this->payload($r))
            ->all();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): MarketingReward
    {
        $name = trim((string) $data['name']);
        if ($name === '') {
            throw ValidationException::withMessages([
                'name' => 'Tên món không được trống.',
            ]);
        }

        $sortOrder = isset($data['sort_order'])
            ? (int) $data['sort_order']
            : ((int) MarketingReward::query()->max('sort_order') + 1);

        $value = max(0, (int) ($data['value'] ?? 0));
        $displayValue = array_key_exists('display_value', $data)
            ? max(0, (int) $data['display_value'])
            : $value;

        $reward = MarketingReward::query()->create([
            'name' => $name,
            'description' => isset($data['description'])
                ? trim((string) $data['description']) ?: null
                : null,
            'image' => null,
            'sku' => $this->uniqueSkuFromName($name),
            'value' => $value,
            'display_value' => $displayValue,
            'enabled' => array_key_exists('enabled', $data)
                ? (bool) $data['enabled']
                : true,
            'sort_order' => max(0, $sortOrder),
        ]);

        if ($reward->enabled) {
            $this->attachToActiveCampaigns($reward);
        }

        return $reward;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(MarketingReward $reward, array $data): MarketingReward
    {
        if (array_key_exists('name', $data) && $data['name'] !== null) {
            $name = trim((string) $data['name']);
            if ($name === '') {
                throw ValidationException::withMessages([
                    'name' => 'Tên món không được trống.',
                ]);
            }
            $reward->name = $name;
        }
        if (array_key_exists('description', $data)) {
            $desc = $data['description'];
            $reward->description = $desc === null || $desc === ''
                ? null
                : trim((string) $desc);
        }
        if (array_key_exists('value', $data) && $data['value'] !== null) {
            $reward->value = max(0, (int) $data['value']);
        }
        if (array_key_exists('display_value', $data) && $data['display_value'] !== null) {
            $reward->display_value = max(0, (int) $data['display_value']);
        }
        if (array_key_exists('enabled', $data)) {
            $reward->enabled = (bool) $data['enabled'];
        }
        if (array_key_exists('sort_order', $data) && $data['sort_order'] !== null) {
            $reward->sort_order = max(0, (int) $data['sort_order']);
        }

        $reward->save();

        if ($reward->enabled) {
            $this->attachToActiveCampaigns($reward);
        } else {
            $this->disableCampaignLinks($reward);
        }

        return $reward->fresh();
    }

    public function delete(MarketingReward $reward): void
    {
        DB::transaction(function () use ($reward) {
            MarketingRewardCode::query()
                ->where('reward_id', $reward->id)
                ->update(['reward_id' => null]);
            MarketingRewardRedemption::query()
                ->where('reward_id', $reward->id)
                ->update(['reward_id' => null]);
            MarketingCampaignReward::query()
                ->where('reward_id', $reward->id)
                ->delete();
            $this->deleteImageFile($reward->image);
            $reward->delete();
        });
    }

    /**
     * @param  list<int>  $ids
     * @return list<array<string, mixed>>
     */
    public function reorder(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if ($ids === []) {
            throw ValidationException::withMessages([
                'ids' => 'Danh sách id món không được trống.',
            ]);
        }

        $existing = MarketingReward::query()
            ->whereIn('id', $ids)
            ->pluck('id')
            ->all();

        if (count($existing) !== count($ids)) {
            throw ValidationException::withMessages([
                'ids' => 'Có id món không hợp lệ hoặc không thuộc tổ chức.',
            ]);
        }

        DB::transaction(function () use ($ids) {
            foreach ($ids as $index => $id) {
                MarketingReward::query()
                    ->whereKey($id)
                    ->update(['sort_order' => $index + 1]);
            }
        });

        return $this->list();
    }

    public function uploadImage(MarketingReward $reward, UploadedFile $file): MarketingReward
    {
        $orgId = (int) (TenantContext::id() ?: $reward->organization_id);
        $path = $file->store('marketing-rewards/'.$orgId, 'public');
        $this->deleteImageFile($reward->image);
        $reward->image = $path;
        $reward->save();

        return $reward->fresh();
    }

    public function clearImage(MarketingReward $reward): MarketingReward
    {
        $this->deleteImageFile($reward->image);
        $reward->image = null;
        $reward->save();

        return $reward->fresh();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function seedDefaultsIfEmpty(): array
    {
        if (MarketingReward::query()->exists()) {
            return $this->list();
        }

        $defaults = [
            ['name' => 'Bánh tráng trộn', 'value' => 25000],
            ['name' => 'Trứng cút lắc', 'value' => 20000],
            ['name' => 'Nước ngọt', 'value' => 15000],
        ];

        DB::transaction(function () use ($defaults) {
            foreach ($defaults as $i => $row) {
                $reward = MarketingReward::query()->create([
                    'name' => $row['name'],
                    'description' => null,
                    'image' => null,
                    'sku' => $this->uniqueSkuFromName($row['name']),
                    'value' => $row['value'],
                    'display_value' => $row['display_value'] ?? $row['value'],
                    'enabled' => true,
                    'sort_order' => $i + 1,
                ]);
                $this->attachToActiveCampaigns($reward);
            }
        });

        return $this->list();
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(MarketingReward $reward): array
    {
        return [
            'id' => $reward->id,
            'name' => $reward->name,
            'description' => $reward->description,
            'image' => $reward->image,
            'image_url' => $reward->imageUrl(),
            'sku' => $reward->sku,
            'value' => (int) $reward->value,
            'display_value' => $reward->customerDisplayValue(),
            'enabled' => (bool) $reward->enabled,
            'sort_order' => (int) $reward->sort_order,
            'created_at' => optional($reward->created_at)?->toIso8601String(),
            'updated_at' => optional($reward->updated_at)?->toIso8601String(),
        ];
    }

    protected function attachToActiveCampaigns(MarketingReward $reward): void
    {
        $campaignIds = MarketingReviewCampaign::query()
            ->where('status', MarketingReviewCampaign::STATUS_ACTIVE)
            ->pluck('id');

        foreach ($campaignIds as $campaignId) {
            MarketingCampaignReward::query()->updateOrCreate(
                [
                    'campaign_id' => $campaignId,
                    'reward_id' => $reward->id,
                ],
                [
                    'quantity' => null,
                    'enabled' => true,
                ],
            );
        }
    }

    protected function disableCampaignLinks(MarketingReward $reward): void
    {
        MarketingCampaignReward::query()
            ->where('reward_id', $reward->id)
            ->update(['enabled' => false]);
    }

    protected function deleteImageFile(?string $path): void
    {
        if (! $path) {
            return;
        }
        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    protected function uniqueSkuFromName(string $name): string
    {
        $base = strtoupper(trim($name));
        $base = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $base) ?: $base;
        $base = preg_replace('/[^A-Z0-9]+/', '_', $base) ?? '';
        $base = trim($base, '_');
        if ($base === '') {
            $base = 'REWARD';
        }
        $base = substr($base, 0, 40);

        $candidate = $base;
        $i = 2;
        while (MarketingReward::query()->where('sku', $candidate)->exists()) {
            $suffix = '_'.$i;
            $candidate = substr($base, 0, max(1, 64 - strlen($suffix))).$suffix;
            $i++;
        }

        return $candidate;
    }
}
