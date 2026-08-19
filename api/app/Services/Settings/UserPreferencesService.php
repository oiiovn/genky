<?php

namespace App\Services\Settings;

use App\Models\User;

class UserPreferencesService
{
    public const DEFAULTS = [
        'sidebar_style' => 'expanded',
    ];

    public const PAYROLL_TABLE_COLUMNS = [
        'employee',
        'position',
        'totalHours',
        'leaveDays',
        'totalIncome',
        'deduction',
        'netIncome',
        'paid',
        'remaining',
        'status',
    ];

    public function show(User $user): array
    {
        $stored = is_array($user->preferences) ? $user->preferences : [];
        $out = [
            'sidebar_style' => array_key_exists('sidebar_style', $stored)
                ? $this->normalizeSidebar($stored['sidebar_style'])
                : null,
        ];

        if (array_key_exists('payroll_table_columns', $stored)) {
            $out['payroll_table_columns'] = $this->normalizePayrollColumns(
                $stored['payroll_table_columns']
            );
        }

        return $out;
    }

    public function update(User $user, array $data): array
    {
        $stored = is_array($user->preferences) ? $user->preferences : [];

        if (array_key_exists('sidebar_style', $data) && $data['sidebar_style'] !== null) {
            $stored['sidebar_style'] = $this->normalizeSidebar($data['sidebar_style']);
        }

        if (array_key_exists('payroll_table_columns', $data)) {
            $stored['payroll_table_columns'] = $this->normalizePayrollColumns(
                $data['payroll_table_columns']
            );
        }

        $user->forceFill(['preferences' => $stored])->save();

        return $this->show($user);
    }

    public function toggleSidebar(User $user): array
    {
        $stored = is_array($user->preferences) ? $user->preferences : [];
        $current = $this->normalizeSidebar($stored['sidebar_style'] ?? 'expanded');
        $stored['sidebar_style'] = $current === 'collapsed' ? 'expanded' : 'collapsed';
        $user->forceFill(['preferences' => $stored])->save();

        return $this->show($user);
    }

    public function normalize(array $data): array
    {
        $out = [
            'sidebar_style' => $this->normalizeSidebar($data['sidebar_style'] ?? 'expanded'),
        ];
        if (array_key_exists('payroll_table_columns', $data)) {
            $out['payroll_table_columns'] = $this->normalizePayrollColumns(
                $data['payroll_table_columns']
            );
        }

        return $out;
    }

    protected function normalizeSidebar(mixed $value): string
    {
        return $value === 'collapsed' ? 'collapsed' : 'expanded';
    }

    /**
     * @param  mixed  $raw
     * @return list<string>
     */
    protected function normalizePayrollColumns(mixed $raw): array
    {
        $allowed = self::PAYROLL_TABLE_COLUMNS;
        $fromList = is_array($raw) ? $raw : [];
        $unique = [];
        foreach ($fromList as $key) {
            if (! is_string($key) || ! in_array($key, $allowed, true)) {
                continue;
            }
            if (! in_array($key, $unique, true)) {
                $unique[] = $key;
            }
        }
        if (! in_array('employee', $unique, true)) {
            array_unshift($unique, 'employee');
        }

        return $unique !== [] ? array_values($unique) : $allowed;
    }
}
