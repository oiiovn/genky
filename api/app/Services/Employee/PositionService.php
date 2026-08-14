<?php

namespace App\Services\Employee;

use App\Models\Organization;
use App\Models\Position;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class PositionService
{
    public const DEFAULTS = [
        'Quản lý',
        'Thu ngân',
        'Phục vụ',
        'Bếp chính',
        'Phụ bếp',
        'Pha chế',
        'CTV',
    ];

    public function seedDefaults(?Organization $organization = null): void
    {
        $organization ??= TenantContext::organization();

        if (! $organization) {
            return;
        }

        foreach (self::DEFAULTS as $index => $name) {
            Position::query()->firstOrCreate(
                [
                    'organization_id' => $organization->id,
                    'name' => $name,
                ],
                [
                    'is_active' => true,
                    'sort_order' => $index + 1,
                ]
            );
        }
    }

    /**
     * @return Collection<int, Position>
     */
    public function list(bool $activeOnly = false): Collection
    {
        $query = Position::query()->orderBy('sort_order')->orderBy('name');

        if ($activeOnly) {
            $query->where('is_active', true);
        }

        return $query->get();
    }

    public function create(array $data): Position
    {
        $organization = TenantContext::organization();

        return Position::query()->create([
            'organization_id' => $organization->id,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);
    }

    public function update(Position $position, array $data): Position
    {
        $position->fill(collect($data)->only([
            'name',
            'description',
            'is_active',
            'sort_order',
        ])->all());
        $position->save();

        return $position->fresh();
    }

    public function delete(Position $position): void
    {
        $position->delete();
    }

    public function payload(Position $position): array
    {
        return [
            'id' => $position->id,
            'name' => $position->name,
            'description' => $position->description,
            'is_active' => $position->is_active,
            'sort_order' => $position->sort_order,
        ];
    }
}
