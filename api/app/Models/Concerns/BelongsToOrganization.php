<?php

namespace App\Models\Concerns;

use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Gắn model vào tenant hiện tại — dữ liệu tách tuyệt đối theo organization_id.
 */
trait BelongsToOrganization
{
    public static function bootBelongsToOrganization(): void
    {
        static::addGlobalScope('organization', function (Builder $builder) {
            $organizationId = TenantContext::id();

            if ($organizationId) {
                $builder->where(
                    $builder->getModel()->getTable().'.organization_id',
                    $organizationId
                );

                return;
            }

            // Không có tenant context → không trả dữ liệu (tránh lộ cross-tenant)
            $builder->whereRaw('0 = 1');
        });

        static::creating(function (Model $model) {
            if (! $model->getAttribute('organization_id') && TenantContext::id()) {
                $model->setAttribute('organization_id', TenantContext::id());
            }
        });
    }

    public function organization()
    {
        return $this->belongsTo(\App\Models\Organization::class);
    }
}
