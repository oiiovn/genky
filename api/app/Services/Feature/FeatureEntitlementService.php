<?php

namespace App\Services\Feature;

use App\Models\Branch;
use App\Models\BranchFeature;
use App\Models\Feature;
use App\Models\FeatureFlag;
use App\Models\Organization;
use App\Models\OrganizationFeature;
use App\Models\Plan;
use App\Models\Subscription;
use App\Support\Access\AccessCache;
use App\Support\Tenancy\TenantContext;

class FeatureEntitlementService
{
    /**
     * Resolve feature: Branch override → Org override → Plan default → false
     */
    public function enabled(
        string $featureCode,
        ?Organization $organization = null,
        ?Branch $branch = null,
    ): bool {
        $map = $this->mapForOrganization($organization, $branch);

        return (bool) ($map[$featureCode] ?? false);
    }

    public function assertEnabled(string $featureCode, ?Branch $branch = null): void
    {
        if (! $this->enabled($featureCode, null, $branch)) {
            throw new FeatureNotEnabledException($featureCode);
        }
    }

    /**
     * @return array<string, bool>
     */
    public function mapForOrganization(?Organization $organization = null, ?Branch $branch = null): array
    {
        $organization ??= TenantContext::organization();

        if (! $organization) {
            return [];
        }

        $branch ??= $this->resolveCurrentBranch($organization);

        return $this->snapshot($organization, $branch)['map'];
    }

    public function catalogForOrganization(?Organization $organization = null, ?Branch $branch = null): array
    {
        $organization ??= TenantContext::organization();
        $branch ??= $this->resolveCurrentBranch($organization);

        if (! $organization) {
            return [
                'plan' => null,
                'subscription' => null,
                'branch_id' => $branch?->id,
                'features' => [],
            ];
        }

        return $this->snapshot($organization, $branch)['catalog'];
    }

    public function assignDefaultSubscription(Organization $organization, string $planCode = Plan::FREE): Subscription
    {
        if (! Plan::query()->where('code', $planCode)->exists()) {
            (new \Database\Seeders\FeaturePlanSeeder)->run();
        }

        $plan = Plan::query()->where('code', $planCode)->firstOrFail();

        $subscription = Subscription::query()->updateOrCreate(
            [
                'organization_id' => $organization->id,
                'status' => Subscription::STATUS_ACTIVE,
            ],
            [
                'plan_id' => $plan->id,
                'starts_at' => now(),
                'ends_at' => null,
            ]
        );

        AccessCache::bumpFeatures((int) $organization->id);

        return $subscription;
    }

    public function setOrganizationFeature(
        Organization $organization,
        string $featureCode,
        bool $enabled,
        string $source = 'override',
        ?string $note = null,
    ): OrganizationFeature {
        $feature = Feature::query()->where('code', $featureCode)->firstOrFail();

        $row = OrganizationFeature::query()->updateOrCreate(
            [
                'organization_id' => $organization->id,
                'feature_id' => $feature->id,
            ],
            [
                'enabled' => $enabled,
                'source' => $source,
                'note' => $note,
            ]
        );

        AccessCache::bumpFeatures((int) $organization->id);

        return $row;
    }

    public function setBranchFeature(
        Branch $branch,
        string $featureCode,
        bool $enabled,
        ?string $note = null,
    ): BranchFeature {
        $feature = Feature::query()->where('code', $featureCode)->firstOrFail();

        $row = BranchFeature::query()->updateOrCreate(
            [
                'branch_id' => $branch->id,
                'feature_id' => $feature->id,
            ],
            [
                'enabled' => $enabled,
                'note' => $note,
            ]
        );

        AccessCache::bumpFeatures((int) $branch->organization_id);

        return $row;
    }

    public function flagEnabled(string $flagKey, ?Organization $organization = null): bool
    {
        $organization ??= TenantContext::organization();
        $flag = FeatureFlag::query()->where('key', $flagKey)->first();

        if (! $flag) {
            return false;
        }

        if ($flag->enabled_globally) {
            return true;
        }

        if (! $organization) {
            return false;
        }

        $pivot = $flag->organizations()
            ->where('organizations.id', $organization->id)
            ->first();

        return $pivot ? (bool) $pivot->pivot->enabled : false;
    }

    /**
     * @return array{map: array<string, bool>, catalog: array<string, mixed>}
     */
    protected function snapshot(Organization $organization, ?Branch $branch): array
    {
        $orgId = (int) $organization->id;
        $branchId = (int) ($branch?->id ?? 0);

        return AccessCache::rememberRequest(
            "featsnap:{$orgId}:{$branchId}",
            fn () => AccessCache::rememberFeatureSnapshot(
                $orgId,
                $branchId,
                fn () => $this->computeSnapshot($organization, $branch)
            )
        );
    }

    /**
     * @return array{map: array<string, bool>, catalog: array<string, mixed>}
     */
    protected function computeSnapshot(Organization $organization, ?Branch $branch): array
    {
        $features = Feature::query()->where('is_active', true)->orderBy('sort_order')->get();
        $featureIds = $features->pluck('id');

        $branchOverrides = collect();
        if ($branch && (int) $branch->organization_id === (int) $organization->id) {
            $branchOverrides = BranchFeature::query()
                ->where('branch_id', $branch->id)
                ->whereIn('feature_id', $featureIds)
                ->get()
                ->keyBy('feature_id');
        }

        $orgOverrides = OrganizationFeature::query()
            ->where('organization_id', $organization->id)
            ->whereIn('feature_id', $featureIds)
            ->get()
            ->keyBy('feature_id');

        $subscription = $this->activeSubscription($organization);
        $planFeatureIds = [];
        if ($subscription?->plan) {
            $planFeatureIds = $subscription->plan->features
                ->filter(fn (Feature $feature) => (bool) $feature->pivot->enabled)
                ->pluck('id')
                ->all();
        }

        $map = [];
        $rows = [];
        foreach ($features as $feature) {
            if ($branchOverrides->has($feature->id)) {
                $enabled = (bool) $branchOverrides[$feature->id]->enabled;
                $source = 'branch';
            } elseif ($orgOverrides->has($feature->id)) {
                $enabled = (bool) $orgOverrides[$feature->id]->enabled;
                $source = $orgOverrides[$feature->id]->source ?: 'organization';
            } else {
                $enabled = in_array($feature->id, $planFeatureIds, true);
                $source = 'plan';
            }

            $map[$feature->code] = $enabled;
            $rows[] = [
                'code' => $feature->code,
                'name' => $feature->name,
                'module_group' => $feature->module_group,
                'enabled' => $enabled,
                'source' => $source,
            ];
        }

        return [
            'map' => $map,
            'catalog' => [
                'plan' => $subscription?->plan ? [
                    'id' => $subscription->plan->id,
                    'code' => $subscription->plan->code,
                    'name' => $subscription->plan->name,
                ] : null,
                'subscription' => $subscription ? [
                    'status' => $subscription->status,
                    'starts_at' => $subscription->starts_at?->toIso8601String(),
                    'ends_at' => $subscription->ends_at?->toIso8601String(),
                ] : null,
                'branch_id' => $branch?->id,
                'features' => $rows,
            ],
        ];
    }

    protected function activeSubscription(?Organization $organization): ?Subscription
    {
        if (! $organization) {
            return null;
        }

        return Subscription::query()
            ->with('plan.features')
            ->where('organization_id', $organization->id)
            ->whereIn('status', [Subscription::STATUS_ACTIVE, Subscription::STATUS_TRIALING])
            ->latest('id')
            ->first();
    }

    protected function resolveCurrentBranch(?Organization $organization): ?Branch
    {
        if (! $organization) {
            return null;
        }

        $headerBranchId = (string) (request()?->header('X-Branch-Id') ?? '');

        return AccessCache::rememberRequest(
            'branch:'.$organization->id.':'.(auth()->id() ?? 0).':'.$headerBranchId,
            fn () => $this->findCurrentBranch($organization, $headerBranchId)
        );
    }

    protected function findCurrentBranch(Organization $organization, string $headerBranchId): ?Branch
    {
        $user = auth()->user();

        if ($user?->current_branch_id) {
            $branch = Branch::query()->find($user->current_branch_id);
            if ($branch && (int) $branch->organization_id === (int) $organization->id) {
                return $branch;
            }
        }

        if ($headerBranchId !== '') {
            $branch = Branch::query()->find((int) $headerBranchId);
            if ($branch && (int) $branch->organization_id === (int) $organization->id) {
                return $branch;
            }
        }

        return Branch::query()
            ->where('organization_id', $organization->id)
            ->orderByDesc('is_headquarters')
            ->orderBy('id')
            ->first();
    }

}
