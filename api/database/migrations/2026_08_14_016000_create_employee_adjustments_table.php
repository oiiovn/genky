<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('type', 16);
            $table->string('category', 32);
            $table->string('reason', 500);
            $table->unsignedBigInteger('amount')->default(0);
            $table->date('occurred_on');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['organization_id', 'occurred_on']);
            $table->index(['employee_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_adjustments');
    }
};
