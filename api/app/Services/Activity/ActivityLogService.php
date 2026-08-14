<?php

namespace App\Services\Activity;

use App\Models\ActivityLog;
use App\Models\User;
use App\Support\Activity\ActivityActionMap;
use App\Support\Auth\DeviceParser;
use App\Support\Authorization\EffectivePermission;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class ActivityLogService
{
    public function list(array $filters): array
    {
        $this->assertCanView();

        $perPage = max(1, min(50, (int) ($filters['per_page'] ?? 10)));
        $query = $this->filteredQuery($filters);
        /** @var LengthAwarePaginator $page */
        $page = $query->paginate($perPage);

        return [
            'data' => collect($page->items())->map(fn (ActivityLog $row) => $this->payload($row))->values()->all(),
            'users' => $this->users(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'from' => $page->firstItem(),
                'to' => $page->lastItem(),
            ],
        ];
    }

    public function export(array $filters): StreamedResponse
    {
        $this->assertCanView();

        $rows = $this->filteredQuery($filters)->limit(5000)->get();
        $filename = 'nhat-ky-he-thong-'.now('Asia/Ho_Chi_Minh')->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
            fputcsv($out, ['Thời gian', 'Người dùng', 'Vai trò', 'Hành động', 'Đối tượng', 'Kết quả', 'Lỗi', 'IP', 'Thiết bị']);
            foreach ($rows as $row) {
                $parsed = DeviceParser::parse($row->user_agent);
                fputcsv($out, [
                    $row->created_at?->timezone('Asia/Ho_Chi_Minh')->format('d/m/Y H:i:s'),
                    $row->user_name,
                    $row->role_label,
                    $row->action_label,
                    $row->object,
                    $row->result === ActivityLog::RESULT_SUCCESS ? 'Thành công' : 'Thất bại',
                    $row->error,
                    $row->ip_address,
                    $parsed['name'],
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function recordFromRequest(Request $request, Response $response): void
    {
        try {
            if (! $this->shouldRecord($request, $response)) {
                return;
            }

            $described = ActivityActionMap::describe($request);
            if (! $described) {
                return;
            }

            $status = $response->getStatusCode();
            $ok = $status >= 200 && $status < 400;

            $this->write([
                'user' => $request->user(),
                'action' => $described['action'],
                'action_label' => $described['action_label'],
                'object' => $described['object'],
                'result' => $ok ? ActivityLog::RESULT_SUCCESS : ActivityLog::RESULT_FAIL,
                'error' => $ok ? null : $this->errorFromResponse($response),
            ]);
        } catch (Throwable) {
            // Nhật ký không được làm hỏng request chính.
        }
    }

    public function recordFromException(Request $request, Throwable $e): void
    {
        try {
            if ($e instanceof \Illuminate\Auth\AuthenticationException) {
                return;
            }
            if ($e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException) {
                return;
            }

            $fake = new Response('', 500);
            if ($e instanceof \Illuminate\Validation\ValidationException) {
                $fake = new Response('', 422);
            } elseif ($e instanceof AuthorizationException) {
                $fake = new Response('', 403);
            } elseif ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                $fake = new Response('', $e->getStatusCode());
            }

            if (! $this->shouldRecord($request, $fake)) {
                return;
            }

            $described = ActivityActionMap::describe($request);
            if (! $described) {
                return;
            }

            $error = $e->getMessage();
            if ($e instanceof \Illuminate\Validation\ValidationException) {
                $error = collect($e->errors())->flatten()->first() ?: $error;
            }

            $this->write([
                'user' => $request->user(),
                'action' => $described['action'],
                'action_label' => $described['action_label'],
                'object' => $described['object'],
                'result' => ActivityLog::RESULT_FAIL,
                'error' => $error ?: 'Thao tác thất bại',
            ]);
        } catch (Throwable) {
            //
        }
    }

    public function recordAuth(User $user, string $action, bool $ok, ?string $error = null, ?string $object = null): void
    {
        $labels = [
            ActivityLog::ACTION_LOGIN => 'Đăng nhập hệ thống',
            ActivityLog::ACTION_LOGOUT => 'Đăng xuất hệ thống',
            ActivityLog::ACTION_UPDATE => 'Cập nhật tài khoản',
        ];

        $this->write([
            'user' => $user,
            'organization_id' => $user->current_organization_id,
            'action' => $action,
            'action_label' => $labels[$action] ?? 'Tài khoản',
            'object' => $object ?? 'Tài khoản',
            'result' => $ok ? ActivityLog::RESULT_SUCCESS : ActivityLog::RESULT_FAIL,
            'error' => $ok ? null : $error,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function write(array $data): void
    {
        try {
            /** @var User|null $user */
            $user = $data['user'] ?? auth()->user();
            $orgId = $data['organization_id'] ?? TenantContext::id() ?? $user?->current_organization_id;

            if (! $orgId || ! $user) {
                return;
            }

            ActivityLog::withoutGlobalScopes()->create([
                'organization_id' => $orgId,
                'user_id' => $user->id,
                'user_name' => $user->name,
                'role_label' => $this->roleLabelFor($user),
                'action' => $data['action'],
                'action_label' => $data['action_label'],
                'object' => $data['object'] ?? 'Hệ thống',
                'result' => $data['result'] ?? ActivityLog::RESULT_SUCCESS,
                'error' => $data['error'] ?? null,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);
        } catch (Throwable) {
            //
        }
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    protected function filteredQuery(array $filters)
    {
        $query = ActivityLog::query()
            ->with('user')
            ->orderByDesc('id');

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function ($inner) use ($search) {
                $inner->where('user_name', 'like', '%'.$search.'%')
                    ->orWhere('action_label', 'like', '%'.$search.'%')
                    ->orWhere('object', 'like', '%'.$search.'%');
            });
        }

        if (! empty($filters['user_id'])) {
            $query->where('user_id', (int) $filters['user_id']);
        }

        if (! empty($filters['action'])) {
            $query->where('action', $filters['action']);
        }

        if (! empty($filters['result'])) {
            $query->where('result', $filters['result']);
        }

        $tz = 'Asia/Ho_Chi_Minh';
        if (! empty($filters['from'])) {
            $query->where(
                'created_at',
                '>=',
                Carbon::parse($filters['from'], $tz)->startOfDay()
            );
        }
        if (! empty($filters['to'])) {
            $query->where(
                'created_at',
                '<=',
                Carbon::parse($filters['to'], $tz)->endOfDay()
            );
        }

        return $query;
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    protected function users(): array
    {
        return ActivityLog::query()
            ->select('user_id', 'user_name')
            ->whereNotNull('user_id')
            ->distinct()
            ->orderBy('user_name')
            ->get()
            ->unique('user_id')
            ->map(fn (ActivityLog $row) => [
                'id' => (int) $row->user_id,
                'name' => (string) $row->user_name,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(ActivityLog $row): array
    {
        $parsed = DeviceParser::parse($row->user_agent);
        $user = $row->user;
        $avatar = $user?->avatarUrl();
        $device = $parsed['kind'] === 'phone' ? 'phone' : 'desktop';

        return [
            'id' => $row->id,
            'time' => $row->created_at?->timezone('Asia/Ho_Chi_Minh')->format('d/m/Y H:i:s'),
            'user_id' => $row->user_id,
            'user_name' => $row->user_name ?: 'Người dùng đã xoá',
            'role' => $row->role_label ?: 'Thành viên',
            'avatar' => $avatar,
            'action' => $row->action,
            'action_label' => $row->action_label,
            'object' => $row->object,
            'result' => $row->result,
            'error' => $row->error,
            'ip' => DeviceParser::location($row->ip_address),
            'device' => $device,
        ];
    }

    protected function shouldRecord(Request $request, Response $response): bool
    {
        $method = strtoupper($request->method());
        if (! in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return false;
        }

        if (! $request->user()) {
            return false;
        }

        $orgId = TenantContext::id() ?? $request->user()->current_organization_id;
        if (! $orgId) {
            return false;
        }

        $status = $response->getStatusCode();
        if (in_array($status, [401, 404, 405, 429], true)) {
            return false;
        }

        $path = trim((string) preg_replace('#^api/#', '', $request->path()), '/');

        foreach ([
            'activity-logs',
            'auth/',
            'me/sessions',
            'me/login-history',
            'me/preferences/sidebar',
            'dashboard',
            'features',
            'plans',
        ] as $skip) {
            if ($path === rtrim($skip, '/') || str_starts_with($path, $skip)) {
                return false;
            }
        }

        return true;
    }

    protected function errorFromResponse(Response $response): ?string
    {
        $json = json_decode((string) $response->getContent(), true);
        if (! is_array($json)) {
            return 'Thao tác thất bại';
        }
        if (! empty($json['message']) && is_string($json['message'])) {
            return $json['message'];
        }
        if (! empty($json['errors']) && is_array($json['errors'])) {
            $first = reset($json['errors']);
            if (is_array($first) && isset($first[0])) {
                return (string) $first[0];
            }
        }

        return 'Thao tác thất bại';
    }

    protected function roleLabelFor(User $user): string
    {
        try {
            return EffectivePermission::for($user)->roleLabel();
        } catch (Throwable) {
            return match ($user->roleIn(TenantContext::organization())) {
                'owner' => 'Chủ cửa hàng',
                'admin' => 'Quản trị viên',
                'manager' => 'Quản lý',
                'hr' => 'Nhân sự',
                'employee' => 'Nhân viên',
                default => 'Thành viên',
            };
        }
    }

    protected function assertCanView(): void
    {
        EffectivePermission::for()->assertCan(
            'settings',
            'view',
            'Bạn không có quyền xem nhật ký hệ thống.',
        );
    }
}
