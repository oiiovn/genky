<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('code', 32);
            $table->time('start_time');
            $table->time('end_time');
            $table->unsignedSmallInteger('break_minutes')->default(0);
            $table->string('color', 16)->default('#3BB2F6');
            $table->string('icon', 32)->nullable();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('capacity')->nullable();
            $table->string('status', 32)->default('active'); // active | inactive
            $table->timestamps();

            $table->unique(['organization_id', 'code']);
            $table->index(['organization_id', 'status']);
            $table->index(['organization_id', 'branch_id']);
        });

        Schema::create('shift_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shift_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->string('status', 32)->default('assigned'); // assigned | cancelled | completed
            $table->string('note')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'shift_id', 'branch_id', 'date'], 'shift_assign_unique');
            $table->index(['organization_id', 'date']);
            $table->index(['branch_id', 'date']);
            $table->index(['shift_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shift_assignments');
        Schema::dropIfExists('shifts');
    }
};
