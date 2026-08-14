<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar_path')->nullable()->after('phone');
        });

        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->string('ip_address', 45)->nullable()->after('abilities');
            $table->text('user_agent')->nullable()->after('ip_address');
        });

        Schema::table('refresh_tokens', function (Blueprint $table) {
            $table->foreignId('access_token_id')
                ->nullable()
                ->after('organization_id')
                ->constrained('personal_access_tokens')
                ->nullOnDelete();
            $table->timestamp('last_used_at')->nullable()->after('user_agent');
        });

        Schema::create('login_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->boolean('succeeded')->default(true);
            $table->string('failure_reason')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_histories');

        Schema::table('refresh_tokens', function (Blueprint $table) {
            $table->dropConstrainedForeignId('access_token_id');
            $table->dropColumn('last_used_at');
        });

        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->dropColumn(['ip_address', 'user_agent']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('avatar_path');
        });
    }
};
