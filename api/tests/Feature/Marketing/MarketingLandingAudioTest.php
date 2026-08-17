<?php

namespace Tests\Feature\Marketing;

use App\Models\Organization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MarketingLandingAudioTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, org_id: int}
     */
    protected function seedOwner(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-audio@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH AUDIO',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH AUDIO',
            'phone' => '0901111111',
            'address' => 'Gò Vấp',
        ]);
        $this->app['auth']->forgetGuards();

        $orgId = (int) Organization::query()->orderByDesc('id')->value('id');

        return ['token' => $token, 'org_id' => $orgId];
    }

    public function test_owner_can_upload_and_public_can_fetch_guide_audio(): void
    {
        Storage::fake('public');
        $ctx = $this->seedOwner();
        $file = UploadedFile::fake()->create('huong-dan.mp3', 120, 'audio/mpeg');

        $uploaded = $this->withToken($ctx['token'])
            ->post('/api/marketing/landing/guide-audio', ['audio' => $file], [
                'Accept' => 'application/json',
            ])
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($uploaded['audio_url']);
        $this->assertSame('huong-dan.mp3', $uploaded['file_name']);

        $this->withToken($ctx['token'])
            ->getJson('/api/marketing/landing/guide-audio')
            ->assertOk()
            ->assertJsonPath('data.file_name', 'huong-dan.mp3');

        $this->getJson('/api/public/review-reward/guide-audio?org_id='.$ctx['org_id'])
            ->assertOk()
            ->assertJsonPath('data.file_name', 'huong-dan.mp3');

        $this->withToken($ctx['token'])
            ->deleteJson('/api/marketing/landing/guide-audio')
            ->assertOk()
            ->assertJsonPath('data.audio_url', null);

        $this->getJson('/api/public/review-reward/guide-audio?org_id='.$ctx['org_id'])
            ->assertOk()
            ->assertJsonPath('data.audio_url', null);
    }
}
