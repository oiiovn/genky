<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketing_rewards', function (Blueprint $table) {
            $table->unsignedInteger('display_value')->default(0)->after('value');
        });

        DB::table('marketing_rewards')
            ->where('display_value', 0)
            ->update(['display_value' => DB::raw('value')]);
    }

    public function down(): void
    {
        Schema::table('marketing_rewards', function (Blueprint $table) {
            $table->dropColumn('display_value');
        });
    }
};
