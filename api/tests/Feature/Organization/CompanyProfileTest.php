<?php

namespace Tests\Feature\Organization;

use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CompanyProfileTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, org_id: int}
     */
    protected function seedOwner(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-company@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH Company',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH Company',
            'phone' => '0901111111',
            'address' => 'Gò Vấp',
        ]);
        $this->app['auth']->forgetGuards();

        return [
            'token' => $token,
            'org_id' => $register['organization']['id'],
        ];
    }

    public function test_owner_can_update_full_company_profile(): void
    {
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])
            ->putJson('/api/organization', [
                'name' => 'FRESH - Bánh tráng trộn',
                'phone' => '0901234567',
                'address' => '123 Lê Văn Quới',
                'tax_code' => '0312345678',
                'company_type' => 'Công ty TNHH',
                'company_size' => '10 - 50 nhân viên',
                'email' => 'hello@fresh.test',
                'website' => 'https://fresh.test',
                'fax' => '028123456',
                'hotline' => '19001234',
                'representative' => 'Vũ',
                'representative_title' => 'Chủ sở hữu',
                'established_at' => '2020-05-20',
                'industry' => 'F&B / Nhà hàng',
                'intro' => 'Quán bánh tráng trộn.',
            ])
            ->assertOk()
            ->assertJsonPath('organization.name', 'FRESH - Bánh tráng trộn')
            ->assertJsonPath('organization.tax_code', '0312345678')
            ->assertJsonPath('organization.email', 'hello@fresh.test')
            ->assertJsonPath('organization.representative', 'Vũ')
            ->assertJsonPath('organization.established_at', '2020-05-20');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/organization')
            ->assertOk()
            ->assertJsonPath('organization.tax_code', '0312345678')
            ->assertJsonPath('organization.website', 'https://fresh.test')
            ->assertJsonPath('organization.documents', []);
    }

    public function test_owner_can_upload_logo(): void
    {
        Storage::fake('public');
        $ctx = $this->seedOwner();
        $file = UploadedFile::fake()->image('logo.png', 200, 200);

        $res = $this->withToken($ctx['token'])
            ->post('/api/organization/logo', ['logo' => $file])
            ->assertOk();

        $this->assertNotEmpty($res->json('organization.logo_url'));

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->get('/api/organization/logo')
            ->assertOk();
    }

    public function test_owner_can_manage_legal_documents(): void
    {
        Storage::fake('local');
        $ctx = $this->seedOwner();
        $file = UploadedFile::fake()->create('giay-phep.pdf', 120, 'application/pdf');

        $created = $this->withToken($ctx['token'])
            ->post('/api/organization/documents', [
                'file' => $file,
                'name' => 'Giấy phép kinh doanh.pdf',
            ])
            ->assertCreated()
            ->assertJsonPath('document.name', 'Giấy phép kinh doanh.pdf')
            ->json('document');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/organization/documents')
            ->assertOk()
            ->assertJsonPath('data.0.id', $created['id']);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->get('/api/organization/documents/'.$created['id'].'/download')
            ->assertOk();

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->deleteJson('/api/organization/documents/'.$created['id'])
            ->assertOk()
            ->assertJsonPath('deleted', true);
    }

    public function test_employee_cannot_update_company_or_upload(): void
    {
        Storage::fake('public');
        $ctx = $this->seedOwner();

        $staff = User::factory()->create([
            'email' => 'staff-company@fresh.test',
            'password' => 'Password1!',
        ]);
        OrganizationUser::query()->create([
            'organization_id' => $ctx['org_id'],
            'user_id' => $staff->id,
            'role' => OrganizationUser::ROLE_EMPLOYEE,
            'is_default' => true,
        ]);
        $staff->forceFill(['current_organization_id' => $ctx['org_id']])->save();

        $login = $this->postJson('/api/auth/login', [
            'login' => 'staff-company@fresh.test',
            'password' => 'Password1!',
        ])->json();

        $this->app['auth']->forgetGuards();

        $this->withToken($login['access_token'])
            ->getJson('/api/organization')
            ->assertOk();

        $this->app['auth']->forgetGuards();

        $this->withToken($login['access_token'])
            ->putJson('/api/organization', [
                'name' => 'Hack',
                'phone' => '0900000000',
                'address' => 'Nowhere',
            ])
            ->assertForbidden();
    }

    public function test_tenant_cannot_see_other_org_documents(): void
    {
        Storage::fake('local');
        $a = $this->seedOwner();
        $file = UploadedFile::fake()->create('a.pdf', 20, 'application/pdf');

        $doc = $this->withToken($a['token'])
            ->post('/api/organization/documents', ['file' => $file])
            ->json('document');

        $this->app['auth']->forgetGuards();

        $b = $this->postJson('/api/auth/register', [
            'name' => 'Nguyễn A',
            'email' => 'other-company@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'ABC Coffee',
        ])->json();

        $this->app['auth']->forgetGuards();

        $this->withToken($b['access_token'])
            ->getJson('/api/organization/documents/'.$doc['id'].'/download')
            ->assertNotFound();
    }
}
