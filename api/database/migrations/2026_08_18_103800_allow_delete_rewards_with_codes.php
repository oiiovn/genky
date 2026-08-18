<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->nullableRewardId('marketing_reward_codes');
        $this->nullableRewardId('marketing_reward_redemptions');
    }

    public function down(): void
    {
        $this->restoreRewardId('marketing_reward_codes');
        $this->restoreRewardId('marketing_reward_redemptions');
    }

    protected function nullableRewardId(string $table): void
    {
        Schema::table($table, function (Blueprint $blueprint) {
            $blueprint->dropForeign(['reward_id']);
        });

        Schema::table($table, function (Blueprint $blueprint) {
            $blueprint->unsignedBigInteger('reward_id')->nullable()->change();
        });

        Schema::table($table, function (Blueprint $blueprint) {
            $blueprint->foreign('reward_id')
                ->references('id')
                ->on('marketing_rewards')
                ->nullOnDelete();
        });
    }

    protected function restoreRewardId(string $table): void
    {
        Schema::table($table, function (Blueprint $blueprint) {
            $blueprint->dropForeign(['reward_id']);
        });

        Schema::table($table, function (Blueprint $blueprint) {
            $blueprint->unsignedBigInteger('reward_id')->nullable(false)->change();
        });

        Schema::table($table, function (Blueprint $blueprint) {
            $blueprint->foreign('reward_id')
                ->references('id')
                ->on('marketing_rewards')
                ->restrictOnDelete();
        });
    }
};
