<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('tax_code', 32)->nullable()->after('address');
            $table->string('company_type', 64)->nullable()->after('tax_code');
            $table->string('company_size', 64)->nullable()->after('company_type');
            $table->string('email')->nullable()->after('company_size');
            $table->string('website')->nullable()->after('email');
            $table->string('fax', 30)->nullable()->after('website');
            $table->string('hotline', 30)->nullable()->after('fax');
            $table->string('representative')->nullable()->after('hotline');
            $table->string('representative_title', 64)->nullable()->after('representative');
            $table->date('established_at')->nullable()->after('representative_title');
            $table->string('industry', 64)->nullable()->after('established_at');
            $table->text('intro')->nullable()->after('industry');
            $table->string('logo_path')->nullable()->after('intro');
        });

        Schema::create('organization_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('path');
            $table->string('mime', 128)->nullable();
            $table->unsignedInteger('size_bytes')->default(0);
            $table->timestamps();

            $table->index('organization_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_documents');

        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn([
                'tax_code',
                'company_type',
                'company_size',
                'email',
                'website',
                'fax',
                'hotline',
                'representative',
                'representative_title',
                'established_at',
                'industry',
                'intro',
                'logo_path',
            ]);
        });
    }
};
