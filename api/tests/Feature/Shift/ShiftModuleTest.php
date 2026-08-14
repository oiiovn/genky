<?php

namespace Tests\Feature\Shift;

use App\Models\Shift;
use App\Models\ShiftAssignment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class ShiftModuleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, branch_id: int, org_id: int}
     */
    protected function seedOwnerWithBranch(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-shift@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH Shift',
        ])->json();

        $token = $register['access_token'];

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH Shift',
            'phone' => '0901111111',
            'address' => 'Gò Vấp',
        ]);

        $this->app['auth']->forgetGuards();
        $branch = $this->withToken($token)->postJson('/api/onboarding/branch', [
            'name' => 'Lê Đức Thọ',
            'address' => '123 Lê Đức Thọ',
            'check_in_radius_meters' => 100,
        ])->json('branch');

        $this->app['auth']->forgetGuards();

        return [
            'token' => $token,
            'branch_id' => $branch['id'],
            'org_id' => $register['organization']['id'],
        ];
    }

    public function test_seeds_default_shifts_and_lists(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $this->withToken($ctx['token'])
            ->getJson('/api/shifts')
            ->assertOk()
            ->assertJsonPath('meta.total', 4);

        $this->withToken($ctx['token'])
            ->getJson('/api/shifts/summary')
            ->assertOk()
            ->assertJsonPath('data.total', 4)
            ->assertJsonPath('data.active', 4);
    }

    public function test_owner_can_crud_shift(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $created = $this->withToken($ctx['token'])->postJson('/api/shifts', [
            'name' => 'Ca gãy 1',
            'code' => 'CG1',
            'start_time' => '07:00',
            'end_time' => '11:00',
            'break_time' => 0,
            'color' => '#10B981',
            'description' => 'Ca bán thời gian',
            'branch_id' => $ctx['branch_id'],
        ])->assertCreated()
            ->assertJsonPath('data.code', 'CG1')
            ->assertJsonPath('data.duration_minutes', 240)
            ->json('data');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->putJson('/api/shifts/'.$created['id'], [
                'status' => 'inactive',
                'break_time' => 15,
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'inactive')
            ->assertJsonPath('data.break_minutes', 15);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->putJson('/api/shifts/'.$created['id'], [
                'code' => 'ct',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('code')
            ->assertJsonPath('errors.code.0', 'Mã ca đã tồn tại trong tổ chức.');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->deleteJson('/api/shifts/'.$created['id'])
            ->assertOk();

        $this->assertDatabaseMissing('shifts', ['id' => $created['id']]);
    }

    public function test_deleted_default_shift_is_not_recreated_when_listing(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $shiftId = Shift::query()
            ->withoutGlobalScopes()
            ->where('organization_id', $ctx['org_id'])
            ->where('code', 'CS')
            ->valueOrFail('id');

        $this->withToken($ctx['token'])
            ->putJson('/api/shifts/'.$shiftId, ['status' => 'inactive'])
            ->assertOk()
            ->assertJsonPath('data.status', 'inactive');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->deleteJson('/api/shifts/'.$shiftId)
            ->assertOk();

        $this->assertDatabaseMissing('shifts', ['id' => $shiftId]);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/shifts')
            ->assertOk()
            ->assertJsonPath('meta.total', 3);

        $this->assertDatabaseMissing('shifts', [
            'organization_id' => $ctx['org_id'],
            'code' => 'CS',
        ]);
    }

    public function test_assign_and_unassign_employee(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Văn An',
            'email' => 'an-shift@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->assertCreated()->json('data');

        $this->app['auth']->forgetGuards();

        $shiftId = $this->withToken($ctx['token'])
            ->getJson('/api/shifts?search=Ca sáng')
            ->assertOk()
            ->json('data.0.id');

        $this->app['auth']->forgetGuards();

        $assignment = $this->withToken($ctx['token'])->postJson('/api/shift-assignments', [
            'employee_id' => $employee['id'],
            'shift_id' => $shiftId,
            'branch_id' => $ctx['branch_id'],
            'date' => now()->toDateString(),
        ])->assertCreated()
            ->assertJsonPath('data.employee.id', $employee['id'])
            ->json('data');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/shift-assignments?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/shifts/'.$shiftId)
            ->assertOk()
            ->assertJsonPath('data.employee_count', 1);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->deleteJson('/api/shift-assignments/'.$assignment['id'])
            ->assertOk();

        $this->assertDatabaseHas('shift_assignments', [
            'id' => $assignment['id'],
            'status' => ShiftAssignment::STATUS_CANCELLED,
        ]);
    }

    public function test_import_and_export_csv(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $csv = "name,code,start_time,end_time,break_time,color,description,status\n";
        $csv .= "Ca gãy 2,CG2,16:00,20:00,0,#06B6D4,Ca gãy chiều,active\n";

        $file = UploadedFile::fake()->createWithContent('shifts.csv', $csv);

        $this->withToken($ctx['token'])
            ->post('/api/shifts/import', [
                'file' => $file,
                'branch_id' => $ctx['branch_id'],
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('count', 1);

        $this->assertDatabaseHas('shifts', ['code' => 'CG2']);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->get('/api/shifts/export')
            ->assertOk()
            ->assertHeader('content-disposition');
    }

    public function test_tenant_isolation(): void
    {
        $a = $this->seedOwnerWithBranch();

        $this->app['auth']->forgetGuards();

        $bRegister = $this->postJson('/api/auth/register', [
            'name' => 'Other',
            'email' => 'other-shift@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'Other Org',
        ])->json();

        $this->app['auth']->forgetGuards();
        $this->withToken($bRegister['access_token'])->postJson('/api/onboarding/organization', [
            'name' => 'Other Org',
            'phone' => '0902222222',
            'address' => 'Q12',
        ]);
        $this->app['auth']->forgetGuards();
        $this->withToken($bRegister['access_token'])->postJson('/api/onboarding/branch', [
            'name' => 'CN 2',
            'address' => 'Addr',
        ]);

        $shiftId = Shift::query()->withoutGlobalScopes()
            ->where('organization_id', $a['org_id'])
            ->where('code', 'CS')
            ->value('id');

        $this->app['auth']->forgetGuards();
        $this->withToken($bRegister['access_token'])
            ->getJson('/api/shifts/'.$shiftId)
            ->assertNotFound();
    }
}
