<?php

namespace App\Http\Controllers\Api\Marketing;

use App\Http\Controllers\Controller;
use App\Http\Requests\Marketing\IndexMarketingFlashSaleRequest;
use App\Http\Requests\Marketing\StoreMarketingFlashSaleRequest;
use App\Http\Requests\Marketing\UpdateMarketingFlashSaleRequest;
use App\Http\Requests\Marketing\UploadMarketingRewardImageRequest;
use App\Models\MarketingFlashSale;
use App\Models\MarketingFlashSaleProduct;
use App\Services\Marketing\MarketingFlashSaleService;
use App\Support\Authorization\EffectivePermission;
use App\Support\Marketing\MarketingPermissionMap;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;

class MarketingFlashSaleController extends Controller
{
    public function __construct(
        private readonly MarketingFlashSaleService $flashSales,
    ) {}

    public function index(IndexMarketingFlashSaleRequest $request): JsonResponse
    {
        $this->assertCanView();

        $result = $this->flashSales->list($request->validated());

        return response()->json([
            'stats' => $result['stats'],
            'data' => $result['data'],
        ]);
    }

    public function history(): JsonResponse
    {
        $this->assertCanView();

        return response()->json([
            'data' => $this->flashSales->history(),
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $this->assertCanView();

        $sale = $this->flashSales->find($id);

        return response()->json([
            'data' => $this->flashSales->payload($sale),
        ]);
    }

    public function store(StoreMarketingFlashSaleRequest $request): JsonResponse
    {
        $this->assertCanManage();

        $sale = $this->flashSales->create(
            $request->validated(),
            auth()->id() ? (int) auth()->id() : null,
        );

        return response()->json([
            'data' => $this->flashSales->payload($sale),
            'message' => 'Đã tạo chương trình FlashSale.',
        ], 201);
    }

    public function update(UpdateMarketingFlashSaleRequest $request, int $id): JsonResponse
    {
        $this->assertCanManage();

        $sale = MarketingFlashSale::query()->findOrFail($id);
        $sale = $this->flashSales->update($sale, $request->validated());

        return response()->json([
            'data' => $this->flashSales->payload($sale),
            'message' => 'Đã cập nhật chương trình.',
        ]);
    }

    public function end(int $id): JsonResponse
    {
        $this->assertCanManage();

        $sale = MarketingFlashSale::query()->findOrFail($id);
        $sale = $this->flashSales->end($sale);

        return response()->json([
            'data' => $this->flashSales->payload($sale),
            'message' => 'Đã kết thúc chương trình.',
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->assertCanManage();

        $sale = MarketingFlashSale::query()->findOrFail($id);
        $this->flashSales->delete($sale);

        return response()->json([
            'message' => 'Đã xoá chương trình.',
        ]);
    }

    public function uploadProductImage(
        UploadMarketingRewardImageRequest $request,
        int $id,
        int $productId,
    ): JsonResponse {
        $this->assertCanManage();

        $sale = MarketingFlashSale::query()->findOrFail($id);
        $product = MarketingFlashSaleProduct::query()
            ->where('flash_sale_id', $sale->id)
            ->findOrFail($productId);
        $file = $request->file('image');
        if (! $file instanceof UploadedFile) {
            abort(422, 'Vui lòng chọn ảnh món.');
        }
        $product = $this->flashSales->uploadProductImage(
            $sale,
            $product,
            $file,
        );

        return response()->json([
            'data' => $this->flashSales->payload($sale->fresh(['branch', 'products'])),
            'product' => [
                'id' => $product->id,
                'image' => $product->image,
                'image_url' => $product->imageUrl(),
            ],
            'message' => 'Đã tải ảnh sản phẩm.',
        ]);
    }

    public function clearProductImage(int $id, int $productId): JsonResponse
    {
        $this->assertCanManage();

        $sale = MarketingFlashSale::query()->findOrFail($id);
        $product = MarketingFlashSaleProduct::query()
            ->where('flash_sale_id', $sale->id)
            ->findOrFail($productId);
        $this->flashSales->clearProductImage($sale, $product);

        return response()->json([
            'data' => $this->flashSales->payload($sale->fresh(['branch', 'products'])),
            'message' => 'Đã xoá ảnh sản phẩm.',
        ]);
    }

    protected function assertCanView(): void
    {
        $perm = EffectivePermission::for();
        if (
            $perm->can(MarketingPermissionMap::CAMPAIGN, 'view')
            || $perm->can(MarketingPermissionMap::SETTINGS, 'view')
            || $perm->can(MarketingPermissionMap::REVIEW, 'view')
        ) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền xem FlashSale.');
    }

    protected function assertCanManage(): void
    {
        $perm = EffectivePermission::for();
        if (
            $perm->can(MarketingPermissionMap::CAMPAIGN, 'create')
            || $perm->can(MarketingPermissionMap::CAMPAIGN, 'update')
            || $perm->can(MarketingPermissionMap::SETTINGS, 'update')
            || $perm->can(MarketingPermissionMap::REVIEW, 'update')
        ) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền quản lý FlashSale.');
    }
}
