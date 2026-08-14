<?php

namespace App\Services\Feature;

use Exception;
use Symfony\Component\HttpFoundation\Response;

class FeatureNotEnabledException extends Exception
{
    public function __construct(
        public readonly string $featureCode,
        string $message = '',
    ) {
        parent::__construct(
            $message !== ''
                ? $message
                : "Tính năng \"{$featureCode}\" chưa được kích hoạt cho tổ chức/chi nhánh hiện tại."
        );
    }

    public function render(): Response
    {
        return response()->json([
            'code' => 'FEATURE_NOT_ENABLED',
            'feature' => $this->featureCode,
            'message' => $this->getMessage(),
        ], 403);
    }
}
