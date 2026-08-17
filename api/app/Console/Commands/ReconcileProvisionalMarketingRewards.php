<?php

namespace App\Console\Commands;

use App\Services\Marketing\PublicReviewRewardService;
use Illuminate\Console\Command;

class ReconcileProvisionalMarketingRewards extends Command
{
    protected $signature = 'marketing:reconcile-provisional-rewards';

    protected $description = 'Sau 48 giờ: giữ thưởng nếu đã có đánh giá, huỷ nếu chưa có.';

    public function handle(PublicReviewRewardService $rewards): int
    {
        $result = $rewards->reconcileProvisional();
        $this->info('Giữ '.$result['kept'].' · Huỷ '.$result['cancelled']);

        return self::SUCCESS;
    }
}
