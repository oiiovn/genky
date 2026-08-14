<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('features', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique(); // employees, attendance, payroll...
            $table->string('name');
            $table->string('description')->nullable();
            $table->string('module_group')->default('core'); // hrm, inventory, pos, ai, reports
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique(); // free, starter, pro, business, enterprise
            $table->string('name');
            $table->string('description')->nullable();
            $table->unsignedInteger('price_monthly')->default(0); // VND
            $table->unsignedInteger('max_branches')->nullable();
            $table->unsignedInteger('max_employees')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('plan_features', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained()->cascadeOnDelete();
            $table->foreignId('feature_id')->constrained()->cascadeOnDelete();
            $table->boolean('enabled')->default(true);
            $table->timestamps();

            $table->unique(['plan_id', 'feature_id']);
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained()->restrictOnDelete();
            $table->string('status', 32)->default('active'); // active, trialing, past_due, canceled
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'status']);
        });

        Schema::create('organization_features', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('feature_id')->constrained()->cascadeOnDelete();
            $table->boolean('enabled');
            $table->string('source', 32)->default('override'); // override, addon, trial
            $table->string('note')->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'feature_id']);
        });

        Schema::create('branch_features', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('feature_id')->constrained()->cascadeOnDelete();
            $table->boolean('enabled');
            $table->string('note')->nullable();
            $table->timestamps();

            $table->unique(['branch_id', 'feature_id']);
        });

        Schema::create('feature_flags', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique(); // ai_assistant_v2
            $table->string('name');
            $table->foreignId('feature_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('enabled_globally')->default(false);
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('feature_flag_organization', function (Blueprint $table) {
            $table->id();
            $table->foreignId('feature_flag_id')->constrained('feature_flags')->cascadeOnDelete();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->boolean('enabled')->default(true);
            $table->timestamps();

            $table->unique(['feature_flag_id', 'organization_id'], 'ff_org_unique');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('current_branch_id')
                ->nullable()
                ->after('current_organization_id')
                ->constrained('branches')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('current_branch_id');
        });

        Schema::dropIfExists('feature_flag_organization');
        Schema::dropIfExists('feature_flags');
        Schema::dropIfExists('branch_features');
        Schema::dropIfExists('organization_features');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('plan_features');
        Schema::dropIfExists('plans');
        Schema::dropIfExists('features');
    }
};
