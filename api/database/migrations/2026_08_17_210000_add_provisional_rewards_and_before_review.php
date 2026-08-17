<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketing_reward_code_settings', function (Blueprint $table) {
            $table->boolean('reward_before_review')->default(false)->after('expiry_date');
        });

        Schema::table('marketing_reward_codes', function (Blueprint $table) {
            $table->string('order_code', 120)->nullable()->after('review_id');
            $table->boolean('provisional')->default(false)->after('status');
            $table->timestamp('reconcile_at')->nullable()->after('provisional');

            $table->index(['organization_id', 'order_code']);
            $table->index(['provisional', 'reconcile_at']);
        });
    }

    public function down(): void
    {
        Schema::table('marketing_reward_codes', function (Blueprint $table) {
            $table->dropIndex(['organization_id', 'order_code']);
            $table->dropIndex(['provisional', 'reconcile_at']);
            $table->dropColumn(['order_code', 'provisional', 'reconcile_at']);
        });

        Schema::table('marketing_reward_code_settings', function (Blueprint $table) {
            $table->dropColumn('reward_before_review');
        });
    }
};
