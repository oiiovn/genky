<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('slug', 64);
            $table->string('name');
            $table->string('description')->nullable();
            $table->string('icon', 32)->default('user');
            $table->string('color', 64)->default('text-slate-600');
            $table->string('bg', 64)->default('bg-slate-100');
            $table->boolean('is_system')->default(false);
            $table->boolean('is_default')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['organization_id', 'slug']);
            $table->index(['organization_id', 'sort_order']);
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
            $table->string('resource', 64);
            $table->string('action', 32);
            $table->boolean('allowed')->default(true);
            $table->timestamps();

            $table->unique(['role_id', 'resource', 'action']);
        });

        Schema::create('role_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['role_id', 'user_id']);
            $table->index(['organization_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('roles');
    }
};
