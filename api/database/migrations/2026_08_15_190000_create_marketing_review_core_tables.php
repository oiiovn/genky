<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marketing Review — core tables (campaign + branches + channels + reviews).
 *
 * tenant_id trong spec nghiệp vụ = organization_id trong Genky.
 * Channel không hard-code: dùng marketing_channels làm master.
 * Review status: PENDING | VERIFIED | REJECTED (không dùng REWARD_ISSUED — reward là entity riêng).
 * Review images: ocr_data JSON ví dụ { order_code, rating, reviewed_at }.
 * Rewards: value tính bằng VND (vd 25000 = 25.000đ).
 * Campaign ↔ rewards: nhiều món / campaign (rule random|quota thêm sau, không nhét vào bảng này).
 * Reward codes: entity riêng (ISSUED|REDEEMED|EXPIRED|CANCELLED) — không gộp status vào review.
 * Một review chỉ 1 mã: unique(review_id) trên marketing_reward_codes.
 * Redemptions: audit trail bắt buộc khi đổi mã — không chỉ update status code mà bỏ qua bảng này.
 * QR: destination_type ORDER_VERIFY|LANDING_PAGE|CUSTOM_URL (vd ORDER_VERIFY → /review/verify).
 * Reward code settings: 1 config / org (vd prefix=GEN, pattern=GEN-XXXX, length=4, expiry 7 days).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketing_channels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('code', 64);
            $table->string('color', 32)->nullable();
            $table->string('icon', 64)->nullable();
            $table->boolean('enabled')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['organization_id', 'code']);
            $table->index(['organization_id', 'enabled', 'sort_order']);
        });

        /*
         | Mặc định khi org trống: ShopeeFood + GrabFood.
         | Các kênh khác do chủ quán tự thêm qua API.
         | ShopeeFood code=SHOPEEFOOD  color=#FF4E00
         | GrabFood   code=GRABFOOD    color=#00B14F
         */

        Schema::create('marketing_review_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name', 200);
            $table->text('description')->nullable();
            $table->string('status', 32)->default('draft');
            $table->timestamp('start_at')->nullable();
            $table->timestamp('end_at')->nullable();
            $table->unsignedTinyInteger('min_rating')->default(5);
            $table->unsignedInteger('max_reward_per_order')->nullable();
            $table->unsignedInteger('max_reward_per_customer')->nullable();
            $table->boolean('auto_verify')->default(false);
            $table->boolean('auto_issue_reward')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['organization_id', 'status']);
            $table->index(['organization_id', 'start_at', 'end_at']);
        });

        Schema::create('marketing_campaign_branches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')
                ->constrained('marketing_review_campaigns')
                ->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();

            $table->unique(['campaign_id', 'branch_id']);
        });

        Schema::create('marketing_campaign_channels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')
                ->constrained('marketing_review_campaigns')
                ->cascadeOnDelete();
            $table->foreignId('channel_id')
                ->constrained('marketing_channels')
                ->cascadeOnDelete();
            $table->boolean('enabled')->default(true);

            $table->unique(['campaign_id', 'channel_id']);
        });

        Schema::create('marketing_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_id')
                ->constrained('marketing_review_campaigns')
                ->cascadeOnDelete();

            $table->string('order_code', 120);
            $table->string('customer_name', 160)->nullable();
            $table->string('customer_phone', 40)->nullable();

            $table->foreignId('channel_id')
                ->constrained('marketing_channels')
                ->restrictOnDelete();
            $table->foreignId('branch_id')
                ->constrained()
                ->restrictOnDelete();

            $table->unsignedTinyInteger('rating');
            $table->text('review_content')->nullable();

            $table->timestamp('reviewed_at')->nullable();

            $table->string('source', 64)->nullable();
            $table->string('source_reference', 255)->nullable();

            $table->string('status', 32)->default('PENDING');

            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();

            $table->text('rejection_reason')->nullable();

            $table->timestamps();

            $table->index(['organization_id', 'status']);
            $table->index(['organization_id', 'campaign_id']);
            $table->index(['organization_id', 'order_code']);
            // Cùng order_code được phép ở nhiều campaign; cấm trùng trong 1 campaign/tenant.
            $table->unique(
                ['organization_id', 'campaign_id', 'order_code'],
                'marketing_reviews_org_campaign_order_unique'
            );
            $table->index(['organization_id', 'channel_id']);
            $table->index(['organization_id', 'branch_id']);
            $table->index(['status', 'reviewed_at']);
        });

        Schema::create('marketing_review_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_id')
                ->constrained('marketing_reviews')
                ->cascadeOnDelete();
            $table->string('file_path', 500);
            $table->string('file_url', 1000)->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('ocr_status', 32)->nullable();
            $table->json('ocr_data')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['review_id', 'sort_order']);
            $table->index(['review_id', 'ocr_status']);
        });

        Schema::create('marketing_rewards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name', 200);
            $table->text('description')->nullable();
            $table->string('image', 1000)->nullable();
            $table->string('sku', 64)->nullable();
            $table->unsignedInteger('value')->default(0);
            $table->boolean('enabled')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['organization_id', 'sku']);
            $table->index(['organization_id', 'enabled', 'sort_order']);
        });

        /*
         | Ví dụ dữ liệu (seed theo org khi tạo):
         | Bánh tráng trộn  value=25000
         | Trứng cút lắc    value=20000
         | Nước ngọt        value=15000
         */

        Schema::create('marketing_campaign_rewards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')
                ->constrained('marketing_review_campaigns')
                ->cascadeOnDelete();
            $table->foreignId('reward_id')
                ->constrained('marketing_rewards')
                ->cascadeOnDelete();
            $table->unsignedInteger('quantity')->nullable();
            $table->boolean('enabled')->default(true);

            $table->unique(['campaign_id', 'reward_id']);
        });

        Schema::create('marketing_reward_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_id')
                ->constrained('marketing_review_campaigns')
                ->cascadeOnDelete();
            $table->foreignId('review_id')
                ->nullable()
                ->constrained('marketing_reviews')
                ->nullOnDelete();
            $table->foreignId('reward_id')
                ->constrained('marketing_rewards')
                ->restrictOnDelete();

            $table->string('code', 64);

            $table->string('status', 32)->default('ISSUED');

            $table->timestamp('issued_at')->nullable();
            $table->timestamp('expires_at')->nullable();

            $table->timestamp('redeemed_at')->nullable();
            $table->foreignId('redeemed_branch_id')
                ->nullable()
                ->constrained('branches')
                ->nullOnDelete();
            $table->foreignId('redeemed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->unique(['organization_id', 'code']);
            // Một review chỉ nhận một reward code (NULL được phép nhiều lần nếu mã không gắn review).
            $table->unique('review_id', 'marketing_reward_codes_review_id_unique');
            $table->index(['organization_id', 'status']);
            $table->index(['organization_id', 'campaign_id']);
            $table->index(['reward_id']);
            $table->index(['status', 'expires_at']);
        });

        Schema::create('marketing_reward_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reward_code_id')
                ->constrained('marketing_reward_codes')
                ->restrictOnDelete();

            $table->string('order_code', 120)->nullable();
            $table->foreignId('review_id')
                ->nullable()
                ->constrained('marketing_reviews')
                ->nullOnDelete();
            $table->foreignId('reward_id')
                ->constrained('marketing_rewards')
                ->restrictOnDelete();

            $table->foreignId('branch_id')
                ->constrained()
                ->restrictOnDelete();
            $table->foreignId('employee_id')
                ->nullable()
                ->constrained('employees')
                ->nullOnDelete();

            $table->timestamp('redeemed_at');

            $table->string('device_id', 120)->nullable();
            $table->string('ip_address', 45)->nullable();

            $table->text('note')->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index(['organization_id', 'redeemed_at']);
            $table->index(['organization_id', 'branch_id']);
            $table->index(['reward_code_id']);
            $table->index(['review_id']);
            $table->index(['reward_id']);
            $table->index(['employee_id']);
        });

        Schema::create('marketing_qr_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_id')
                ->constrained('marketing_review_campaigns')
                ->cascadeOnDelete();

            $table->string('name', 200);

            $table->foreignId('branch_id')
                ->nullable()
                ->constrained()
                ->nullOnDelete();
            $table->foreignId('channel_id')
                ->nullable()
                ->constrained('marketing_channels')
                ->nullOnDelete();

            $table->string('token', 64);

            $table->string('destination_type', 32)->default('ORDER_VERIFY');
            $table->string('destination_url', 1000)->nullable();

            $table->boolean('enabled')->default(true);

            $table->timestamps();

            $table->unique(['organization_id', 'token']);
            $table->index(['organization_id', 'campaign_id']);
            $table->index(['organization_id', 'enabled']);
            $table->index(['branch_id']);
            $table->index(['channel_id']);
        });

        Schema::create('marketing_reward_code_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();

            $table->string('prefix', 32)->default('GEN');
            $table->string('pattern', 64)->nullable();

            $table->unsignedTinyInteger('length')->default(4);

            $table->boolean('use_letters')->default(true);
            $table->boolean('use_numbers')->default(true);

            $table->boolean('exclude_zero')->default(false);
            $table->boolean('exclude_o')->default(false);
            $table->boolean('exclude_i')->default(false);
            $table->boolean('exclude_one')->default(false);

            $table->string('expiry_type', 32)->default('DAYS');
            $table->unsignedInteger('expiry_days')->nullable();
            $table->date('expiry_date')->nullable();

            $table->timestamps();

            $table->unique('organization_id');
        });

        /*
         | Ví dụ:
         | prefix=GEN, pattern=GEN-XXXX, length=4
         | use_letters + use_numbers (A-Z + 0-9)
         | expiry_type=DAYS, expiry_days=7
         */

        Schema::create('marketing_reward_claim_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reward_code_id')
                ->constrained('marketing_reward_codes')
                ->cascadeOnDelete();
            $table->foreignId('review_id')
                ->nullable()
                ->constrained('marketing_reviews')
                ->nullOnDelete();
            // Token ngẫu nhiên, ngắn hạn, one-time — không chứa mã quà / order.
            $table->string('token', 64);
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique('token');
            $table->index(['organization_id', 'expires_at']);
            $table->index(['reward_code_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_reward_claim_sessions');
        Schema::dropIfExists('marketing_reward_code_settings');
        Schema::dropIfExists('marketing_qr_codes');
        Schema::dropIfExists('marketing_reward_redemptions');
        Schema::dropIfExists('marketing_reward_codes');
        Schema::dropIfExists('marketing_campaign_rewards');
        Schema::dropIfExists('marketing_rewards');
        Schema::dropIfExists('marketing_review_images');
        Schema::dropIfExists('marketing_reviews');
        Schema::dropIfExists('marketing_campaign_channels');
        Schema::dropIfExists('marketing_campaign_branches');
        Schema::dropIfExists('marketing_review_campaigns');
        Schema::dropIfExists('marketing_channels');
    }
};
