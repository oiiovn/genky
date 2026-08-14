<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_entries', function (Blueprint $table) {
            $table->unsignedBigInteger('paid_amount')->default(0)->after('net');
        });

        Schema::create('payroll_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payroll_entry_id')->nullable()->constrained('payroll_entries')->nullOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->unsignedBigInteger('amount');
            $table->string('method', 32)->default('cash');
            $table->string('content', 500)->nullable();
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'year', 'month']);
            $table->index(['organization_id', 'employee_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_payments');

        Schema::table('payroll_entries', function (Blueprint $table) {
            $table->dropColumn('paid_amount');
        });
    }
};
