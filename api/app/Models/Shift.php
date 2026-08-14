<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shift extends Model
{
    use BelongsToOrganization;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    protected $fillable = [
        'organization_id',
        'branch_id',
        'name',
        'code',
        'start_time',
        'end_time',
        'break_minutes',
        'color',
        'icon',
        'description',
        'capacity',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'break_minutes' => 'integer',
            'capacity' => 'integer',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(ShiftAssignment::class);
    }

    public function durationMinutes(): int
    {
        $start = $this->minutesOfDay((string) $this->start_time);
        $end = $this->minutesOfDay((string) $this->end_time);

        if ($end <= $start) {
            return (24 * 60 - $start) + $end;
        }

        return $end - $start;
    }

    public function crossesMidnight(): bool
    {
        $start = $this->minutesOfDay((string) $this->start_time);
        $end = $this->minutesOfDay((string) $this->end_time);

        return $end <= $start;
    }

    public function isOngoingAt(?\DateTimeInterface $now = null): bool
    {
        if ($this->status !== self::STATUS_ACTIVE) {
            return false;
        }

        $now ??= now();
        $current = ((int) $now->format('H')) * 60 + (int) $now->format('i');
        $start = $this->minutesOfDay((string) $this->start_time);
        $end = $this->minutesOfDay((string) $this->end_time);

        if ($end <= $start) {
            return $current >= $start || $current < $end;
        }

        return $current >= $start && $current < $end;
    }

    protected function minutesOfDay(string $time): int
    {
        $parts = explode(':', substr($time, 0, 8));

        return ((int) ($parts[0] ?? 0)) * 60 + ((int) ($parts[1] ?? 0));
    }
}
