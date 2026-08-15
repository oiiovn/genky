<?php

namespace App\Http\Controllers\Api\Marketing;

use App\Http\Controllers\Controller;
use App\Http\Requests\Marketing\ReorderMarketingChannelsRequest;
use App\Http\Requests\Marketing\StoreMarketingChannelRequest;
use App\Http\Requests\Marketing\UpdateMarketingChannelRequest;
use App\Models\MarketingChannel;
use App\Services\Marketing\MarketingChannelService;
use App\Support\Authorization\EffectivePermission;
use App\Support\Marketing\MarketingPermissionMap;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;

class MarketingChannelController extends Controller
{
    public function __construct(
        private readonly MarketingChannelService $channels,
    ) {
    }

    public function index(): JsonResponse
    {
        $this->assertCanViewChannels();

        return response()->json([
            'data' => $this->channels->list(),
        ]);
    }

    public function store(StoreMarketingChannelRequest $request): JsonResponse
    {
        $this->assertCanManageChannels();

        $channel = $this->channels->create($request->validated());

        return response()->json([
            'data' => $this->channels->payload($channel),
            'message' => 'Đã thêm kênh.',
        ], 201);
    }

    public function update(
        UpdateMarketingChannelRequest $request,
        int $id,
    ): JsonResponse {
        $this->assertCanManageChannels();

        $channel = MarketingChannel::query()->findOrFail($id);
        $channel = $this->channels->update($channel, $request->validated());

        return response()->json([
            'data' => $this->channels->payload($channel),
            'message' => 'Đã cập nhật kênh.',
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->assertCanManageChannels();

        $channel = MarketingChannel::query()->findOrFail($id);
        $this->channels->delete($channel);

        return response()->json([
            'message' => 'Đã xoá kênh.',
        ]);
    }

    public function reorder(ReorderMarketingChannelsRequest $request): JsonResponse
    {
        $this->assertCanManageChannels();

        $rows = $this->channels->reorder($request->validated('ids'));

        return response()->json([
            'data' => $rows,
            'message' => 'Đã cập nhật thứ tự kênh.',
        ]);
    }

    public function seedDefaults(): JsonResponse
    {
        $this->assertCanManageChannels();

        $rows = $this->channels->seedDefaultsIfEmpty();

        return response()->json([
            'data' => $rows,
            'message' => count($rows) > 0
                ? 'Đã có danh sách kênh.'
                : 'Không có kênh.',
        ]);
    }

    protected function assertCanViewChannels(): void
    {
        $perm = EffectivePermission::for();
        if (
            $perm->can(MarketingPermissionMap::SETTINGS, 'view')
            || $perm->can(MarketingPermissionMap::REVIEW, 'view')
        ) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền xem kênh bán hàng.');
    }

    protected function assertCanManageChannels(): void
    {
        $perm = EffectivePermission::for();
        if (
            $perm->can(MarketingPermissionMap::SETTINGS, 'update')
            || $perm->can(MarketingPermissionMap::REVIEW, 'update')
        ) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền sửa kênh bán hàng.');
    }
}
