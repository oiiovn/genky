<?php

namespace App\Support\Tenancy;

use App\Models\Organization;
use App\Models\User;

class TenantContext
{
    protected static ?Organization $organization = null;

    public static function set(?Organization $organization): void
    {
        static::$organization = $organization;

        if ($organization) {
            app()->instance('currentOrganizationId', $organization->id);
            app()->instance('currentOrganization', $organization);
        } else {
            app()->forgetInstance('currentOrganizationId');
            app()->forgetInstance('currentOrganization');
        }
    }

    public static function id(): ?int
    {
        return static::$organization?->id ?? (app()->bound('currentOrganizationId')
            ? app('currentOrganizationId')
            : null);
    }

    public static function organization(): ?Organization
    {
        return static::$organization;
    }

    public static function clear(): void
    {
        static::set(null);
    }

    public static function fromUser(User $user): void
    {
        $org = $user->currentOrganization
            ?? $user->organizations()->orderByPivot('is_default', 'desc')->first();

        static::set($org);
    }
}
