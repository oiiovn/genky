<?php

namespace App\Services\Auth;

use App\Models\Employee;
use App\Models\LoginHistory;
use App\Models\RefreshToken;
use App\Models\User;
use App\Support\Auth\DeviceParser;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\PersonalAccessToken;

class AccountSecurityService
{
    public function sessions(User $user): array
    {
        $currentId = $user->currentAccessToken()?->id;

        $rows = RefreshToken::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->orderByDesc('id')
            ->get();

        return $rows->map(function (RefreshToken $row) use ($currentId) {
            $parsed = DeviceParser::parse($row->user_agent);
            $at = $row->last_used_at ?? $row->created_at;
            $current = $currentId && (int) $row->access_token_id === (int) $currentId;

            return [
                'id' => $row->id,
                'name' => $parsed['name'],
                'detail' => $current ? $parsed['detail'].' · Phiên hiện tại' : $parsed['detail'],
                'kind' => $parsed['kind'],
                'location' => DeviceParser::location($row->ip_address),
                'time' => DeviceParser::timeLabel($at),
                'current' => $current,
            ];
        })->values()->all();
    }

    public function history(User $user, int $limit = 10): array
    {
        $limit = max(1, min(100, $limit));

        $query = LoginHistory::query()
            ->where('user_id', $user->id)
            ->latest();

        $total = (clone $query)->count();
        $rows = $query->limit($limit)->get();

        return [
            'data' => $rows->map(function (LoginHistory $row) {
                $parsed = DeviceParser::parse($row->user_agent);

                return [
                    'id' => $row->id,
                    'time' => DeviceParser::historyTime($row->created_at),
                    'device' => $parsed['name'],
                    'location' => DeviceParser::location($row->ip_address),
                    'ok' => $row->succeeded,
                ];
            })->values()->all(),
            'meta' => [
                'total' => $total,
                'limit' => $limit,
            ],
        ];
    }

    public function recordLogin(User $user, bool $succeeded, ?string $reason = null): void
    {
        LoginHistory::query()->create([
            'user_id' => $user->id,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'succeeded' => $succeeded,
            'failure_reason' => $succeeded ? null : $reason,
        ]);
    }

    public function updateAvatar(User $user, UploadedFile $file): User
    {
        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $path = $file->store('user-avatars/'.$user->id, 'public');
        $user->forceFill(['avatar_path' => $path])->save();
        $user = $user->fresh();

        $avatarUrl = $user->avatarUrl();
        if ($avatarUrl) {
            Employee::query()
                ->where('user_id', $user->id)
                ->update(['avatar' => $avatarUrl]);
        }

        return $user;
    }

    public function avatarFile(User $user): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        if (! $user->avatar_path || ! Storage::disk('public')->exists($user->avatar_path)) {
            abort(404, 'Chưa có ảnh đại diện.');
        }

        return Storage::disk('public')->response($user->avatar_path);
    }

    public function currentAccessTokenId(User $user): ?int
    {
        $token = $user->currentAccessToken();

        return $token instanceof PersonalAccessToken ? $token->id : null;
    }
}
