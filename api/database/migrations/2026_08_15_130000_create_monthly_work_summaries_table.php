<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monthly_work_summaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->unsignedBigInteger('branch_id')->default(0);
            $table->unsignedSmallInteger('work_days')->default(0);
            $table->unsignedInteger('work_minutes')->default(0);
            $table->unsignedInteger('ot_minutes')->default(0);
            $table->unsignedSmallInteger('leave_days')->default(0);
            $table->unsignedSmallInteger('other_leave_days')->default(0);
            $table->unsignedSmallInteger('payroll_leave_days')->default(0);
            $table->unsignedSmallInteger('payroll_paid_leave_days')->default(0);
            $table->unsignedSmallInteger('payroll_unpaid_days')->default(0);
            $table->unsignedInteger('payroll_worked_minutes')->default(0);
            $table->unsignedInteger('payroll_paid_leave_minutes')->default(0);
            $table->unsignedInteger('payroll_unpaid_leave_minutes')->default(0);
            $table->unsignedInteger('payroll_assignment_minutes')->default(0);
            $table->unsignedInteger('payroll_total_minutes')->default(0);
            $table->json('shifts')->nullable();
            $table->timestamp('computed_at')->nullable();
            $table->timestamps();

            $table->unique(
                ['organization_id', 'employee_id', 'year', 'month', 'branch_id'],
                'monthly_work_summaries_unique'
            );
            $table->index(['organization_id', 'year', 'month', 'branch_id'], 'monthly_work_summaries_month');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monthly_work_summaries');
    }
};
