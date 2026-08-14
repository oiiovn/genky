<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('user_name')->nullable();
            $table->string('role_label')->nullable();
            $table->string('action', 32);
            $table->string('action_label');
            $table->string('object')->nullable();
            $table->string('result', 16)->default('success');
            $table->text('error')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'created_at']);
            $table->index(['organization_id', 'action']);
            $table->index(['organization_id', 'user_id']);
            $table->index(['organization_id', 'result']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
