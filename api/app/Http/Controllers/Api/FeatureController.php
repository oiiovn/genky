<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\OrganizationUser;
use App\Services\Feature\FeatureEntitlementService;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeatureController extends Controller
{
    public function __construct(private readonly FeatureEntitlementService $features)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $branch = null;
        if ($request->filled('branch_id')) {
            $branch = Branch::query()->findOrFail((int) $request->input('branch_id'));
        }

        return response()->json(
            $this->features->catalogForOrganization(null, $branch)
        );
    }

    public function setOrganizationFeature(Request $request): JsonResponse
    {
        $this->assertOwnerOrAdmin();

        $data = $request->validate([
            'feature' => ['required', 'string'],
            'enabled' => ['required', 'boolean'],
            'source' => ['nullable', 'string', 'max:32'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $row = $this->features->setOrganizationFeature(
            TenantContext::organization(),
            $data['feature'],
            (bool) $data['enabled'],
            $data['source'] ?? 'override',
            $data['note'] ?? null,
        );

        return response()->json([
            'data' => [
                'feature' => $data['feature'],
                'enabled' => $row->enabled,
                'source' => $row->source,
            ],
        ]);
    }

    public function setBranchFeature(Request $request, int $branch): JsonResponse
    {
        $this->assertOwnerOrAdmin();

        $model = Branch::query()->findOrFail($branch);

        $data = $request->validate([
            'feature' => ['required', 'string'],
            'enabled' => ['required', 'boolean'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $row = $this->features->setBranchFeature(
            $model,
            $data['feature'],
            (bool) $data['enabled'],
            $data['note'] ?? null,
        );

        return response()->json([
            'data' => [
                'branch_id' => $model->id,
                'feature' => $data['feature'],
                'enabled' => $row->enabled,
            ],
        ]);
    }

    protected function assertOwnerOrAdmin(): void
    {
        $role = auth()->user()?->roleIn(TenantContext::organization());

        if (! in_array($role, [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
        ], true)) {
            throw new AuthorizationException('Chỉ Owner/Admin được cấu hình tính năng.');
        }
    }
}
