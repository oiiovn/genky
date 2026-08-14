<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;

class OrganizationDocument extends Model
{
    use BelongsToOrganization;
    protected $fillable = [
        'organization_id',
        'name',
        'path',
        'mime',
        'size_bytes',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
        ];
    }

    public function sizeLabel(): string
    {
        $bytes = (int) $this->size_bytes;
        if ($bytes <= 0) {
            return '—';
        }
        if ($bytes < 1024 * 1024) {
            return round($bytes / 1024).' KB';
        }

        return number_format($bytes / (1024 * 1024), 1).' MB';
    }

    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'size_label' => $this->sizeLabel(),
            'mime' => $this->mime,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
