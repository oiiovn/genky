<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_qr_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->boolean('enabled')->default(true);
            $table->unsignedSmallInteger('rotate_seconds')->default(30);
            $table->string('valid_from', 5)->default('00:00');
            $table->string('valid_to', 5)->default('23:59');
            $table->boolean('allow_check_in')->default(true);
            $table->boolean('allow_check_out')->default(true);
            $table->timestamps();

            $table->unique(['organization_id', 'branch_id']);
            $table->index(['organization_id', 'enabled']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_qr_settings');
    }
};
