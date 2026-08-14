<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('positions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['organization_id', 'name']);
            $table->index(['organization_id', 'is_active']);
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('employee_code');
            $table->string('full_name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('avatar')->nullable();
            $table->string('gender', 20)->nullable(); // male, female, other
            $table->date('date_of_birth')->nullable();
            $table->string('address')->nullable();
            $table->foreignId('position_id')->nullable()->constrained('positions')->nullOnDelete();
            $table->string('employment_type', 32)->default('full_time');
            $table->string('salary_type', 32)->default('hourly'); // hourly, monthly, shift
            $table->unsignedBigInteger('salary_amount')->default(0); // VND
            $table->date('joined_at')->nullable();
            $table->date('resigned_at')->nullable();
            $table->string('status', 32)->default('active'); // active, inactive, resigned
            $table->timestamps();

            $table->unique(['organization_id', 'employee_code']);
            $table->index(['organization_id', 'status']);
            $table->index(['organization_id', 'position_id']);
            $table->index(['user_id']);
        });

        Schema::create('employee_branches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_primary')->default(false);
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamps();

            $table->unique(['employee_id', 'branch_id']);
            $table->index(['branch_id', 'is_primary']);
        });

        Schema::create('employee_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('email');
            $table->string('token', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'employee_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_invitations');
        Schema::dropIfExists('employee_branches');
        Schema::dropIfExists('employees');
        Schema::dropIfExists('positions');
    }
};
