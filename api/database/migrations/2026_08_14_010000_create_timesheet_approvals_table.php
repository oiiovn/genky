<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timesheet_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->string('status', 32)->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->string('note', 500)->nullable();
            $table->timestamps();

            $table->unique(
                ['organization_id', 'employee_id', 'year', 'month'],
                'timesheet_approvals_unique'
            );
            $table->index(['organization_id', 'year', 'month', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timesheet_approvals');
    }
};
