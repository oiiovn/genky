<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Organization\StoreOrganizationDocumentRequest;
use App\Http\Requests\Organization\UpdateOrganizationRequest;
use App\Http\Requests\Organization\UploadOrganizationLogoRequest;
use App\Services\Organization\OrganizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class OrganizationController extends Controller
{
    public function __construct(private readonly OrganizationService $organizations)
    {
    }

    public function show(): JsonResponse
    {
        return response()->json([
            'organization' => $this->organizations->show(),
        ]);
    }

    public function update(UpdateOrganizationRequest $request): JsonResponse
    {
        return response()->json([
            'organization' => $this->organizations->update($request->validated()),
        ]);
    }

    public function setupStatus(Request $request): JsonResponse
    {
        return response()->json(
            $this->organizations->setupStatus($request->user())
        );
    }

    public function setupOrganization(UpdateOrganizationRequest $request): JsonResponse
    {
        return response()->json(
            $this->organizations->completeOrganizationSetup($request->validated())
        );
    }

    public function uploadLogo(UploadOrganizationLogoRequest $request): JsonResponse
    {
        return response()->json([
            'organization' => $this->organizations->updateLogo($request->file('logo')),
        ]);
    }

    public function logo()
    {
        return $this->organizations->logoFile();
    }

    public function documents(): JsonResponse
    {
        return response()->json([
            'data' => $this->organizations->documents(),
        ]);
    }

    public function storeDocument(StoreOrganizationDocumentRequest $request): JsonResponse
    {
        return response()->json([
            'document' => $this->organizations->storeDocument(
                $request->file('file'),
                $request->input('name'),
            ),
        ], 201);
    }

    public function downloadDocument(int $document)
    {
        $doc = $this->organizations->findDocumentOrFail($document);

        return Storage::disk('local')->download($doc->path, $doc->name);
    }

    public function destroyDocument(int $document): JsonResponse
    {
        $this->organizations->deleteDocument($document);

        return response()->json(['deleted' => true]);
    }
}
