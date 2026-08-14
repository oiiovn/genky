<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->foreignId('leave_request_id')
                ->nullable()
                ->after('created_by')
                ->constrained('leave_requests')
                ->nullOnDelete();
            $table->string('leave_type', 32)->nullable()->after('leave_request_id');

            $table->index(['employee_id', 'status', 'work_date']);
        });
    }

    public function down(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->dropIndex(['employee_id', 'status', 'work_date']);
            $table->dropConstrainedForeignId('leave_request_id');
            $table->dropColumn('leave_type');
        });
    }
};
