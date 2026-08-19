<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketing_flash_sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 200);
            $table->string('banner', 16)->default('88');
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->json('slots')->nullable();
            $table->unsignedInteger('quota')->default(0);
            $table->unsignedInteger('sold_count')->default(0);
            $table->unsignedBigInteger('revenue')->default(0);
            $table->timestamp('ended_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['organization_id', 'starts_at', 'ends_at']);
            $table->index(['organization_id', 'branch_id']);
        });

        Schema::create('marketing_flash_sale_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('flash_sale_id')
                ->constrained('marketing_flash_sales')
                ->cascadeOnDelete();
            $table->string('name', 160);
            $table->string('emoji', 16)->nullable();
            $table->string('tone', 80)->nullable();
            $table->unsignedInteger('price')->default(0);
            $table->unsignedInteger('original_price')->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['flash_sale_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_flash_sale_products');
        Schema::dropIfExists('marketing_flash_sales');
    }
};
