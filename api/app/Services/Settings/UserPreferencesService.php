<?php

namespace App\Services\Settings;

use App\Models\User;

class UserPreferencesService
{
    public const DEFAULTS = [
        'sidebar_style' => 'expanded',
    ];

    public function show(User $user): array
    {
        $stored = $user->preferences;

        if (! is_array($stored) || ! array_key_exists('sidebar_style', $stored)) {
            return ['sidebar_style' => null];
        }

        return $this->normalize($stored);
    }

    public function update(User $user, array $data): array
    {
        $payload = $this->normalize(array_merge($this->show($user), $data));
        $user->forceFill(['preferences' => $payload])->save();

        return $payload;
    }

    public function toggleSidebar(User $user): array
    {
        $current = $this->show($user);
        $current['sidebar_style'] = $current['sidebar_style'] === 'collapsed'
            ? 'expanded'
            : 'collapsed';

        $user->forceFill(['preferences' => $current])->save();

        return $current;
    }

    public function normalize(array $data): array
    {
        return [
            'sidebar_style' => ($data['sidebar_style'] ?? '') === 'collapsed'
                ? 'collapsed'
                : 'expanded',
        ];
    }
}
