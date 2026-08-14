<?php

use App\Http\Controllers\Api\AccountSecurityController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AttendanceQrController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\EmployeeInvitationController;
use App\Http\Controllers\Api\FeatureController;
use App\Http\Controllers\Api\GeneralSettingsController;
use App\Http\Controllers\Api\InterfaceSettingsController;
use App\Http\Controllers\Api\OrganizationController;
use App\Http\Controllers\Api\PayrollController;
use App\Http\Controllers\Api\PlanController;
use App\Http\Controllers\Api\PositionController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\ShiftAssignmentController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\TimesheetController;
use App\Http\Controllers\Api\LeaveController;
use App\Http\Controllers\Api\AdjustmentController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\UserPreferencesController;
use App\Http\Middleware\LogActivity;
use App\Http\Middleware\SetTenantFromUser;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('refresh', [AuthController::class, 'refresh']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('logout-others', [AuthController::class, 'logoutOthers']);
        Route::post('logout-all', [AuthController::class, 'logoutAll']);
        Route::put('password', [AuthController::class, 'changePassword']);
    });
});

Route::get('invitations/{token}', [EmployeeInvitationController::class, 'show']);
Route::post('invitations/{token}/accept', [EmployeeInvitationController::class, 'accept']);

Route::middleware(['auth:sanctum', SetTenantFromUser::class, LogActivity::class])->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::put('me', [AuthController::class, 'updateProfile']);
    Route::patch('me', [AuthController::class, 'updateProfile']);
    Route::post('me/avatar', [AccountSecurityController::class, 'uploadAvatar']);
    Route::get('me/avatar', [AccountSecurityController::class, 'avatar']);
    Route::get('me/sessions', [AccountSecurityController::class, 'sessions']);
    Route::get('me/login-history', [AccountSecurityController::class, 'history']);
    Route::get('me/preferences', [UserPreferencesController::class, 'show']);
    Route::put('me/preferences', [UserPreferencesController::class, 'update']);
    Route::patch('me/preferences', [UserPreferencesController::class, 'update']);
    Route::post('me/preferences/sidebar/toggle', [UserPreferencesController::class, 'toggleSidebar']);
    Route::get('dashboard', [DashboardController::class, 'overview']);

    Route::get('organization', [OrganizationController::class, 'show']);
    Route::put('organization', [OrganizationController::class, 'update']);
    Route::patch('organization', [OrganizationController::class, 'update']);
    Route::post('organization/logo', [OrganizationController::class, 'uploadLogo']);
    Route::get('organization/logo', [OrganizationController::class, 'logo']);
    Route::get('organization/documents', [OrganizationController::class, 'documents']);
    Route::post('organization/documents', [OrganizationController::class, 'storeDocument']);
    Route::get('organization/documents/{document}/download', [OrganizationController::class, 'downloadDocument']);
    Route::delete('organization/documents/{document}', [OrganizationController::class, 'destroyDocument']);

    Route::get('settings/interface', [InterfaceSettingsController::class, 'show']);
    Route::put('settings/interface', [InterfaceSettingsController::class, 'update']);
    Route::patch('settings/interface', [InterfaceSettingsController::class, 'update']);
    Route::post('settings/interface/reset', [InterfaceSettingsController::class, 'reset']);

    Route::get('settings/general', [GeneralSettingsController::class, 'show']);
    Route::put('settings/general', [GeneralSettingsController::class, 'update']);
    Route::patch('settings/general', [GeneralSettingsController::class, 'update']);
    Route::post('settings/general/backup', [GeneralSettingsController::class, 'backup']);

    Route::get('activity-logs/export', [ActivityLogController::class, 'export']);
    Route::get('activity-logs', [ActivityLogController::class, 'index']);

    Route::get('onboarding/status', [OrganizationController::class, 'setupStatus']);
    Route::post('onboarding/organization', [OrganizationController::class, 'setupOrganization']);
    Route::post('onboarding/branch', [BranchController::class, 'store']);

    Route::get('features', [FeatureController::class, 'index']);
    Route::get('plans', [PlanController::class, 'index']);
    Route::post('features/organization', [FeatureController::class, 'setOrganizationFeature']);
    Route::post('features/branches/{branch}', [FeatureController::class, 'setBranchFeature']);

    Route::get('branches', [BranchController::class, 'index']);
    Route::post('branches', [BranchController::class, 'store']);
    Route::get('branches/{branch}', [BranchController::class, 'show']);
    Route::put('branches/{branch}', [BranchController::class, 'update']);
    Route::patch('branches/{branch}', [BranchController::class, 'update']);
    Route::delete('branches/{branch}', [BranchController::class, 'destroy']);

    // Roles & permissions (RBAC matrix UI)
    Route::get('roles/catalog', [RoleController::class, 'catalog']);
    Route::get('roles', [RoleController::class, 'index']);
    Route::post('roles', [RoleController::class, 'store']);
    Route::get('roles/{role}', [RoleController::class, 'show']);
    Route::put('roles/{role}', [RoleController::class, 'update']);
    Route::patch('roles/{role}', [RoleController::class, 'update']);
    Route::delete('roles/{role}', [RoleController::class, 'destroy']);
    Route::put('roles/{role}/permissions', [RoleController::class, 'updatePermissions']);
    Route::get('roles/{role}/members', [RoleController::class, 'members']);
    Route::post('roles/{role}/members', [RoleController::class, 'attachMember']);
    Route::delete('roles/{role}/members/{user}', [RoleController::class, 'detachMember']);

    // Feature: employees — tách với permission (RBAC) kiểm tra trong service
    Route::middleware(['feature:employees'])->group(function () {
        Route::get('positions', [PositionController::class, 'index']);
        Route::post('positions', [PositionController::class, 'store']);
        Route::put('positions/{position}', [PositionController::class, 'update']);
        Route::patch('positions/{position}', [PositionController::class, 'update']);
        Route::delete('positions/{position}', [PositionController::class, 'destroy']);

        Route::get('employees', [EmployeeController::class, 'index']);
        Route::post('employees', [EmployeeController::class, 'store']);
        Route::get('employees/{employee}', [EmployeeController::class, 'show']);
        Route::put('employees/{employee}', [EmployeeController::class, 'update']);
        Route::patch('employees/{employee}', [EmployeeController::class, 'update']);
        Route::delete('employees/{employee}', [EmployeeController::class, 'destroy']);
        Route::post('employees/{employee}/assign-branch', [EmployeeController::class, 'assignBranch']);
        Route::delete('employees/{employee}/branches/{branch}', [EmployeeController::class, 'removeBranch']);
        Route::post('employees/{employee}/invite', [EmployeeController::class, 'invite']);
    });

    // Feature: shifts
    Route::middleware(['feature:shifts'])->group(function () {
        Route::get('shifts/summary', [ShiftController::class, 'summary']);
        Route::get('shifts/export', [ShiftController::class, 'export']);
        Route::post('shifts/import', [ShiftController::class, 'import']);

        Route::get('shifts', [ShiftController::class, 'index']);
        Route::post('shifts', [ShiftController::class, 'store']);
        Route::get('shifts/{shift}', [ShiftController::class, 'show']);
        Route::put('shifts/{shift}', [ShiftController::class, 'update']);
        Route::patch('shifts/{shift}', [ShiftController::class, 'update']);
        Route::delete('shifts/{shift}', [ShiftController::class, 'destroy']);

        Route::get('shift-assignments', [ShiftAssignmentController::class, 'index']);
        Route::post('shift-assignments', [ShiftAssignmentController::class, 'store']);
        Route::delete('shift-assignments/{assignment}', [ShiftAssignmentController::class, 'destroy']);
    });

    // Feature: attendance
    Route::middleware(['feature:attendance'])->group(function () {
        Route::get('attendances/dashboard', [AttendanceController::class, 'dashboard']);
        Route::get('attendances/shifts/today', [AttendanceController::class, 'shiftsToday']);
        Route::get('attendances/export', [AttendanceController::class, 'export']);
        Route::post('attendances/check-in', [AttendanceController::class, 'checkIn']);
        Route::post('attendances/check-out', [AttendanceController::class, 'checkOut']);
        Route::post('attendances/bulk', [AttendanceController::class, 'bulk']);
        Route::delete('attendances/synthetic', [AttendanceController::class, 'destroySynthetic']);

        Route::get('attendances/qr/settings', [AttendanceQrController::class, 'settings']);
        Route::put('attendances/qr/settings', [AttendanceQrController::class, 'updateSettings']);
        Route::patch('attendances/qr/settings', [AttendanceQrController::class, 'updateSettings']);
        Route::get('attendances/qr/current', [AttendanceQrController::class, 'current']);
        Route::get('attendances/qr/recent', [AttendanceQrController::class, 'recent']);
        Route::post('attendances/qr/scan', [AttendanceQrController::class, 'scan']);

        Route::get('attendances', [AttendanceController::class, 'index']);
        Route::get('attendances/{attendance}', [AttendanceController::class, 'show']);
        Route::put('attendances/{attendance}', [AttendanceController::class, 'update']);
        Route::patch('attendances/{attendance}', [AttendanceController::class, 'update']);
        Route::delete('attendances/{attendance}', [AttendanceController::class, 'destroy']);
        Route::get('attendances/{attendance}/adjustments', [AttendanceController::class, 'adjustments']);
    });

    // Feature: timesheet
    Route::middleware(['feature:timesheet'])->group(function () {
        Route::get('timesheets/dashboard', [TimesheetController::class, 'dashboard']);
        Route::get('timesheets/export', [TimesheetController::class, 'export']);
        Route::post('timesheets/generate', [TimesheetController::class, 'generate']);
        Route::post('timesheets/approve', [TimesheetController::class, 'approve']);
        Route::get('timesheets', [TimesheetController::class, 'index']);
    });

    // Feature: payroll
    Route::middleware(['feature:payroll'])->group(function () {
        Route::get('payrolls/dashboard', [PayrollController::class, 'dashboard']);
        Route::get('payrolls/export', [PayrollController::class, 'export']);
        Route::get('payrolls/history', [PayrollController::class, 'history']);
        Route::get('payrolls/history/{year}/{month}', [PayrollController::class, 'historyDetail']);
        Route::get('payrolls/payments', [PayrollController::class, 'paymentHistory']);
        Route::post('payrolls/generate', [PayrollController::class, 'generate']);
        Route::post('payrolls/pay', [PayrollController::class, 'pay']);
        Route::post('payrolls/mark-paid', [PayrollController::class, 'markPaid']);
        Route::get('payrolls', [PayrollController::class, 'index']);
    });

    Route::get('leaves', [LeaveController::class, 'index']);
    Route::post('leaves', [LeaveController::class, 'store']);
    Route::post('leaves/{leave}/cancel', [LeaveController::class, 'cancel']);
    Route::post('leaves/{leave}/review', [LeaveController::class, 'review']);

    Route::get('adjustments', [AdjustmentController::class, 'index']);
    Route::post('adjustments', [AdjustmentController::class, 'store']);
    Route::put('adjustments/{adjustment}', [AdjustmentController::class, 'update']);
    Route::patch('adjustments/{adjustment}', [AdjustmentController::class, 'update']);
    Route::delete('adjustments/{adjustment}', [AdjustmentController::class, 'destroy']);
});
