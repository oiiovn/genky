<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shift_id')->nullable()->constrained()->nullOnDelete();
            $table->date('work_date');
            $table->dateTime('check_in_at')->nullable();
            $table->dateTime('check_out_at')->nullable();
            $table->unsignedSmallInteger('break_minutes')->default(0);
            $table->unsignedInteger('total_minutes')->nullable();
            $table->string('status', 32)->default('working'); // working | checked_out | absent | leave
            $table->string('location_label')->nullable();
            $table->decimal('check_in_latitude', 10, 7)->nullable();
            $table->decimal('check_in_longitude', 10, 7)->nullable();
            $table->decimal('check_out_latitude', 10, 7)->nullable();
            $table->decimal('check_out_longitude', 10, 7)->nullable();
            $table->string('device')->nullable();
            $table->string('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['employee_id', 'work_date', 'branch_id'], 'attendance_emp_day_branch');
            $table->index(['organization_id', 'work_date']);
            $table->index(['branch_id', 'work_date']);
            $table->index(['shift_id', 'work_date']);
            $table->index(['status']);
        });

        Schema::create('attendance_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attendance_log_id')->constrained()->cascadeOnDelete();
            $table->foreignId('adjusted_by')->constrained('users')->cascadeOnDelete();
            $table->string('field', 64);
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->string('reason')->nullable();
            $table->timestamps();

            $table->index(['attendance_log_id']);
        });

        Schema::create('attendance_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('import_type', 32)->default('csv');
            $table->string('file_path')->nullable();
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('success_rows')->default(0);
            $table->unsignedInteger('error_rows')->default(0);
            $table->foreignId('imported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_imports');
        Schema::dropIfExists('attendance_adjustments');
        Schema::dropIfExists('attendance_logs');
    }
};
