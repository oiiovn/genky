<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('marketing_flash_sale_products', function (Blueprint $table) {
            $table->string('image', 500)->nullable()->after('name');
            $table->string('slot_start', 5)->nullable()->after('tone');
            $table->string('slot_end', 5)->nullable()->after('slot_start');
        });
    }

    public function down(): void
    {
        Schema::table('marketing_flash_sale_products', function (Blueprint $table) {
            $table->dropColumn(['image', 'slot_start', 'slot_end']);
        });
    }
};
