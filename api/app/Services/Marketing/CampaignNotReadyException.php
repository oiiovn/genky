<?php

namespace App\Services\Marketing;

use Exception;
use Symfony\Component\HttpFoundation\Response;

class CampaignNotReadyException extends Exception
{
    /**
     * @param  list<string>  $missing
     * @param  array<string, bool>  $checklist
     */
    public function __construct(
        public readonly array $missing,
        public readonly array $checklist = [],
        string $message = '',
    ) {
        parent::__construct(
            $message !== ''
                ? $message
                : 'Chiến dịch chưa sẵn sàng để kích hoạt.'
        );
    }

    public function render(): Response
    {
        return response()->json([
            'code' => 'CAMPAIGN_NOT_READY',
            'message' => $this->getMessage(),
            'missing' => $this->missing,
            'checklist' => $this->checklist,
        ], 422);
    }
}
