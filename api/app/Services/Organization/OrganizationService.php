<?php

namespace App\Services\Organization;

use App\Models\Organization;
use App\Models\OrganizationDocument;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class OrganizationService
{
    public const PROFILE_FIELDS = [
        'name',
        'phone',
        'address',
        'timezone',
        'locale',
        'tax_code',
        'company_type',
        'company_size',
        'email',
        'website',
        'fax',
        'hotline',
        'representative',
        'representative_title',
        'established_at',
        'industry',
        'intro',
    ];
    public function current(): Organization
    {
        $organization = TenantContext::organization();

        if (! $organization) {
            throw ValidationException::withMessages([
                'organization' => ['Không xác định được tổ chức hiện tại.'],
            ]);
        }

        return $organization;
    }

    public function show(): array
    {
        $organization = $this->current()->loadCount('branches')->load('documents');

        return $this->payload($organization, includeDocuments: true);
    }

    public function updateLogo(UploadedFile $file): array
    {
        $this->assertCanManage();

        $organization = $this->current();
        $this->deleteLogoFile($organization);

        $path = $file->store('org-logos/'.$organization->id, 'public');
        $organization->forceFill(['logo_path' => $path])->save();
        TenantContext::set($organization->fresh());

        return $this->payload($organization->fresh()->loadCount('branches'));
    }

    public function logoFile(): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $organization = $this->current();

        if (! $organization->logo_path || ! Storage::disk('public')->exists($organization->logo_path)) {
            abort(404, 'Chưa có logo.');
        }

        return Storage::disk('public')->response($organization->logo_path);
    }

    public function documents(): array
    {
        return $this->current()
            ->documents()
            ->latest()
            ->get()
            ->map(fn (OrganizationDocument $doc) => $doc->toApi())
            ->all();
    }

    public function storeDocument(UploadedFile $file, ?string $name = null): array
    {
        $this->assertCanManage();

        $organization = $this->current();
        $path = $file->store('org-docs/'.$organization->id, 'local');

        $doc = OrganizationDocument::query()->create([
            'organization_id' => $organization->id,
            'name' => $name ?: ($file->getClientOriginalName() ?: 'Tài liệu'),
            'path' => $path,
            'mime' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize() ?: 0,
        ]);

        return $doc->toApi();
    }

    public function findDocumentOrFail(int $id): OrganizationDocument
    {
        return OrganizationDocument::query()->findOrFail($id);
    }

    public function deleteDocument(int $id): void
    {
        $this->assertCanManage();

        $doc = $this->findDocumentOrFail($id);
        Storage::disk('local')->delete($doc->path);
        $doc->delete();
    }

    protected function deleteLogoFile(Organization $organization): void
    {
        if ($organization->logo_path) {
            Storage::disk('public')->delete($organization->logo_path);
        }
    }

    public function payload(Organization $organization, bool $includeDocuments = false): array
    {
        $data = [
            'id' => $organization->id,
            'name' => $organization->name,
            'slug' => $organization->slug,
            'phone' => $organization->phone,
            'address' => $organization->address,
            'tax_code' => $organization->tax_code,
            'company_type' => $organization->company_type,
            'company_size' => $organization->company_size,
            'email' => $organization->email,
            'website' => $organization->website,
            'fax' => $organization->fax,
            'hotline' => $organization->hotline,
            'representative' => $organization->representative,
            'representative_title' => $organization->representative_title,
            'established_at' => $organization->established_at?->format('Y-m-d'),
            'industry' => $organization->industry,
            'intro' => $organization->intro,
            'logo_url' => $organization->logoUrl(),
            'owner_id' => $organization->owner_id,
            'timezone' => $organization->timezone,
            'locale' => $organization->locale,
            'setup_completed_at' => $organization->setup_completed_at?->toIso8601String(),
            'branches_count' => $organization->branches_count
                ?? $organization->branches()->count(),
        ];

        if ($includeDocuments) {
            $docs = $organization->relationLoaded('documents')
                ? $organization->documents
                : $organization->documents()->latest()->get();
            $data['documents'] = $docs
                ->map(fn (OrganizationDocument $doc) => $doc->toApi())
                ->values()
                ->all();
        }

        return $data;
    }

    public function update(array $data): array
    {
        $this->assertCanManage();

        $organization = $this->current();

        if (isset($data['name']) && $data['name'] !== $organization->name) {
            $organization->slug = Organization::makeSlug($data['name']);
        }

        $organization->fill(collect($data)->only(self::PROFILE_FIELDS)->all());
        $organization->save();

        TenantContext::set($organization->fresh());

        return $this->payload($organization->loadCount('branches'));
    }

    public function setupStatus(User $user): array
    {
        $organization = $this->current();
        $branchesCount = $organization->branches()->count();
        $hasProfile = $organization->hasOrganizationProfile();
        $completed = $organization->isSetupCompleted() || ($hasProfile && $branchesCount > 0);

        return [
            'organization_id' => $organization->id,
            'has_organization_profile' => $hasProfile,
            'has_branch' => $branchesCount > 0,
            'branches_count' => $branchesCount,
            'setup_completed' => $completed,
            'next_step' => match (true) {
                ! $hasProfile => 'organization',
                $branchesCount === 0 => 'branch',
                default => 'dashboard',
            },
            'organization' => $this->payload($organization),
            'role' => $user->roleIn($organization),
        ];
    }

    public function completeOrganizationSetup(array $data): array
    {
        $this->assertCanManage();

        $payload = $this->update($data);

        return [
            ...$payload,
            'next_step' => 'branch',
        ];
    }

    protected function assertCanManage(): void
    {
        /** @var User|null $user */
        $user = auth()->user();
        $organization = $this->current();
        $role = $user?->roleIn($organization);

        if (! in_array($role, [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
        ], true)) {
            throw new AuthorizationException('Bạn không có quyền quản lý tổ chức.');
        }
    }
}
