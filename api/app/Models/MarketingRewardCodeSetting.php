<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;

class MarketingRewardCodeSetting extends Model
{
    use BelongsToOrganization;

    protected $table = 'marketing_reward_code_settings';

    protected $fillable = [
        'organization_id',
        'prefix',
        'pattern',
        'length',
        'use_letters',
        'use_numbers',
        'exclude_zero',
        'exclude_o',
        'exclude_i',
        'exclude_one',
        'expiry_type',
        'expiry_days',
        'expiry_date',
    ];

    protected function casts(): array
    {
        return [
            'length' => 'integer',
            'use_letters' => 'boolean',
            'use_numbers' => 'boolean',
            'exclude_zero' => 'boolean',
            'exclude_o' => 'boolean',
            'exclude_i' => 'boolean',
            'exclude_one' => 'boolean',
            'expiry_days' => 'integer',
            'expiry_date' => 'date',
        ];
    }
}
