<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\Plan;
use App\Services\Feature\FeatureEntitlementService;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(FeaturePlanSeeder::class);

        $service = app(FeatureEntitlementService::class);

        Organization::query()->each(function (Organization $organization) use ($service) {
            if (! $organization->subscriptions()->where('status', 'active')->exists()) {
                $service->assignDefaultSubscription($organization, Plan::FREE);
            }
        });
    }
}
