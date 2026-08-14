<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->string('status', 32)->default('pending');
            $table->unsignedInteger('total_minutes')->default(0);
            $table->unsignedBigInteger('income')->default(0);
            $table->unsignedBigInteger('deductions')->default(0);
            $table->unsignedBigInteger('net')->default(0);
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('paid_at')->nullable();
            $table->string('note', 500)->nullable();
            $table->timestamps();

            $table->unique(
                ['organization_id', 'employee_id', 'year', 'month'],
                'payroll_entries_unique'
            );
            $table->index(['organization_id', 'year', 'month', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_entries');
    }
};
