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
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

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
        $organization ??= TenantContext::organization();

        if (! $organization) {
            return false;
        }

        $feature = Feature::query()->where('code', $featureCode)->where('is_active', true)->first();

        if (! $feature) {
            return false;
        }

        $branch ??= $this->resolveCurrentBranch($organization);

        if ($branch && (int) $branch->organization_id === (int) $organization->id) {
            $branchOverride = BranchFeature::query()
                ->where('branch_id', $branch->id)
                ->where('feature_id', $feature->id)
                ->first();

            if ($branchOverride) {
                return (bool) $branchOverride->enabled;
            }
        }

        $orgOverride = OrganizationFeature::query()
            ->where('organization_id', $organization->id)
            ->where('feature_id', $feature->id)
            ->first();

        if ($orgOverride) {
            return (bool) $orgOverride->enabled;
        }

        return $this->planHasFeature($organization, $feature->id);
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

        $features = Feature::query()->where('is_active', true)->orderBy('sort_order')->get();
        $map = [];

        foreach ($features as $feature) {
            $map[$feature->code] = $this->enabled($feature->code, $organization, $branch);
        }

        return $map;
    }

    public function catalogForOrganization(?Organization $organization = null, ?Branch $branch = null): array
    {
        $organization ??= TenantContext::organization();
        $branch ??= $this->resolveCurrentBranch($organization);
        $subscription = $this->activeSubscription($organization);
        $map = $this->mapForOrganization($organization, $branch);

        return [
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
            'features' => Feature::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get()
                ->map(fn (Feature $f) => [
                    'code' => $f->code,
                    'name' => $f->name,
                    'module_group' => $f->module_group,
                    'enabled' => $map[$f->code] ?? false,
                    'source' => $this->resolveSource($organization, $branch, $f),
                ])
                ->values()
                ->all(),
        ];
    }

    public function assignDefaultSubscription(Organization $organization, string $planCode = Plan::FREE): Subscription
    {
        if (! Plan::query()->where('code', $planCode)->exists()) {
            (new \Database\Seeders\FeaturePlanSeeder)->run();
        }

        $plan = Plan::query()->where('code', $planCode)->firstOrFail();

        return Subscription::query()->updateOrCreate(
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
    }

    public function setOrganizationFeature(
        Organization $organization,
        string $featureCode,
        bool $enabled,
        string $source = 'override',
        ?string $note = null,
    ): OrganizationFeature {
        $feature = Feature::query()->where('code', $featureCode)->firstOrFail();

        return OrganizationFeature::query()->updateOrCreate(
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
    }

    public function setBranchFeature(
        Branch $branch,
        string $featureCode,
        bool $enabled,
        ?string $note = null,
    ): BranchFeature {
        $feature = Feature::query()->where('code', $featureCode)->firstOrFail();

        return BranchFeature::query()->updateOrCreate(
            [
                'branch_id' => $branch->id,
                'feature_id' => $feature->id,
            ],
            [
                'enabled' => $enabled,
                'note' => $note,
            ]
        );
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

    protected function planHasFeature(Organization $organization, int $featureId): bool
    {
        $subscription = $this->activeSubscription($organization);

        if (! $subscription) {
            return false;
        }

        $row = $subscription->plan
            ?->features()
            ->where('features.id', $featureId)
            ->first();

        return $row ? (bool) $row->pivot->enabled : false;
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

        $user = auth()->user();

        if ($user?->current_branch_id) {
            $branch = Branch::query()->find($user->current_branch_id);
            if ($branch && (int) $branch->organization_id === (int) $organization->id) {
                return $branch;
            }
        }

        $headerBranchId = request()?->header('X-Branch-Id');

        if ($headerBranchId) {
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

    protected function resolveSource(?Organization $organization, ?Branch $branch, Feature $feature): string
    {
        if (! $organization) {
            return 'none';
        }

        if ($branch) {
            $branchOverride = BranchFeature::query()
                ->where('branch_id', $branch->id)
                ->where('feature_id', $feature->id)
                ->exists();

            if ($branchOverride) {
                return 'branch';
            }
        }

        $orgOverride = OrganizationFeature::query()
            ->where('organization_id', $organization->id)
            ->where('feature_id', $feature->id)
            ->first();

        if ($orgOverride) {
            return $orgOverride->source ?: 'organization';
        }

        return 'plan';
    }
}
