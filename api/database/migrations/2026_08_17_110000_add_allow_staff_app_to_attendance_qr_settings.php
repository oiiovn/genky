<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_qr_settings', function (Blueprint $table) {
            $table->boolean('allow_staff_app')->default(false)->after('enabled');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_qr_settings', function (Blueprint $table) {
            $table->dropColumn('allow_staff_app');
        });
    }
};
