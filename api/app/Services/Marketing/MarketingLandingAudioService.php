<?php

namespace App\Services\Marketing;

use App\Models\Organization;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class MarketingLandingAudioService
{
    /**
     * @return array{audio_url: ?string, file_name: ?string}
     */
    public function show(): array
    {
        $org = TenantContext::organization();
        if (! $org) {
            return $this->emptyPayload();
        }

        return $this->payloadFor($org);
    }

    /**
     * @return array{audio_url: ?string, file_name: ?string}
     */
    public function showForOrganization(int $orgId): array
    {
        $org = Organization::query()->find($orgId);
        if (! $org) {
            return $this->emptyPayload();
        }

        return $this->payloadFor($org);
    }

    /**
     * @return array{audio_url: ?string, file_name: ?string}
     */
    public function upload(UploadedFile $file): array
    {
        $org = $this->current();
        $orgId = (int) $org->id;
        $path = $file->store('marketing-landing/'.$orgId, 'public');
        $name = $file->getClientOriginalName() ?: basename($path);

        $this->deleteFile($this->storedPath($org));
        $this->writeMarketing($org, [
            'guide_audio_path' => $path,
            'guide_audio_name' => $name,
        ]);

        return $this->payloadFor($org->fresh());
    }

    /**
     * @return array{audio_url: ?string, file_name: ?string}
     */
    public function clear(): array
    {
        $org = $this->current();
        $this->deleteFile($this->storedPath($org));
        $this->writeMarketing($org, [
            'guide_audio_path' => null,
            'guide_audio_name' => null,
        ]);

        return $this->emptyPayload();
    }

    /**
     * @return array{audio_url: ?string, file_name: ?string}
     */
    protected function payloadFor(?Organization $org): array
    {
        if (! $org) {
            return $this->emptyPayload();
        }

        $path = $this->storedPath($org);
        if (! $path) {
            return $this->emptyPayload();
        }

        $name = is_array($org->settings)
            ? ($org->settings['marketing']['guide_audio_name'] ?? null)
            : null;

        return [
            'audio_url' => $this->publicUrl($path),
            'file_name' => is_string($name) && $name !== '' ? $name : basename($path),
        ];
    }

    /**
     * @return array{audio_url: null, file_name: null}
     */
    protected function emptyPayload(): array
    {
        return [
            'audio_url' => null,
            'file_name' => null,
        ];
    }

    protected function storedPath(Organization $org): ?string
    {
        $settings = is_array($org->settings) ? $org->settings : [];
        $path = $settings['marketing']['guide_audio_path'] ?? null;

        return is_string($path) && $path !== '' ? $path : null;
    }

    /**
     * @param  array{guide_audio_path: ?string, guide_audio_name: ?string}  $audio
     */
    protected function writeMarketing(Organization $org, array $audio): void
    {
        $settings = $org->settings ?? [];
        $marketing = is_array($settings['marketing'] ?? null) ? $settings['marketing'] : [];
        $settings['marketing'] = array_merge($marketing, $audio);
        $org->settings = $settings;
        $org->save();
        TenantContext::set($org->fresh());
    }

    protected function publicUrl(string $path): string
    {
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        $base = request()?->getSchemeAndHttpHost()
            ?: rtrim((string) config('app.url'), '/');

        return $base.'/storage/'.$path;
    }

    protected function deleteFile(?string $path): void
    {
        if (! $path) {
            return;
        }
        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    protected function current(): Organization
    {
        $org = TenantContext::organization();
        if (! $org) {
            abort(403, 'Thiếu tổ chức.');
        }

        return $org;
    }
}
