<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('phone')->nullable()->after('slug');
            $table->string('address')->nullable()->after('phone');
            $table->timestamp('setup_completed_at')->nullable()->after('settings');
        });

        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->unsignedInteger('check_in_radius_meters')->default(100);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_headquarters')->default(false);
            $table->timestamps();

            $table->index(['organization_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branches');

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn(['phone', 'address', 'setup_completed_at']);
        });
    }
};
