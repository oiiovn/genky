<?php

namespace App\Services\Marketing;

use App\Models\MarketingCampaignBranch;
use App\Models\MarketingCampaignChannel;
use App\Models\MarketingReview;
use App\Models\MarketingReviewCampaign;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MarketingReviewService
{
    public function __construct(
        private readonly MarketingRewardCodeService $rewardCodes,
        private readonly MarketingReviewCampaignService $campaigns,
    ) {
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, ?int $submittedBy = null): MarketingReview
    {
        $result = $this->createMany($data, $submittedBy);
        $first = $result['created'][0] ?? $result['updated'][0] ?? null;
        if (! $first) {
            $msg = $result['failed'][0]['message'] ?? 'Không lưu được đánh giá.';
            throw ValidationException::withMessages(['paste' => $msg]);
        }

        return $first;
    }

    /**
     * Tạo mới / cập nhật review từ paste (nhiều mã đơn) / form.
     * Mã mới → create PENDING. Mã cũ (cùng campaign) → update.
     *
     * @param  array<string, mixed>  $data
     * @return array{
     *   created: list<MarketingReview>,
     *   updated: list<MarketingReview>,
     *   failed: list<array{order_code: ?string, message: string}>
     * }
     */
    public function createMany(array $data, ?int $submittedBy = null): array
    {
        $data['source'] = $data['source'] ?? 'manual_paste';
        $defaultRating = (int) ($data['rating'] ?? 5);

        if (empty($data['campaign_id'])) {
            $active = $this->campaigns->ensureDefaultActiveCampaign();
            $data['campaign_id'] = $active->id;
        }

        $campaign = MarketingReviewCampaign::query()->find($data['campaign_id']);
        if (! $campaign) {
            throw ValidationException::withMessages([
                'campaign_id' => 'Chiến dịch không tồn tại.',
            ]);
        }

        $this->assertCampaignActive($campaign);
        $this->assertChannelBelongsToCampaign($campaign, (int) $data['channel_id']);
        $this->assertBranchBelongsToCampaign($campaign, (int) $data['branch_id']);

        $items = $this->resolveCreateItems($data, $defaultRating);
        if ($items === []) {
            throw ValidationException::withMessages([
                'paste' => 'Không tìm thấy mã đơn. Hãy dán nội dung có mã đơn.',
            ]);
        }

        $created = [];
        $updated = [];
        $failed = [];
        $seen = [];

        foreach ($items as $item) {
            $code = (string) $item['order_code'];
            $norm = mb_strtolower(trim($code));
            if (isset($seen[$norm])) {
                $failed[] = [
                    'order_code' => $code,
                    'message' => 'Trùng mã đơn trong lần dán.',
                ];
                continue;
            }
            $seen[$norm] = true;

            try {
                $this->assertRatingMeetsMinimum($campaign, (int) $item['rating']);
                $reviewedAt = $this->assertReviewDateValid(
                    $campaign,
                    (string) ($item['reviewed_at'] ?? now()->format('Y-m-d H:i:s')),
                );

                $existing = $this->findByOrderCode($campaign, $code);
                if ($existing) {
                    $updated[] = $this->updateFromPaste(
                        $existing,
                        $data,
                        $item,
                        $reviewedAt,
                        $submittedBy,
                    );
                } else {
                    $created[] = $this->insertFromPaste(
                        $campaign,
                        $data,
                        $item,
                        $reviewedAt,
                        $submittedBy,
                    );
                }
            } catch (ValidationException $e) {
                $failed[] = [
                    'order_code' => $code,
                    'message' => collect($e->errors())->flatten()->first() ?? 'Không lưu được.',
                ];
            } catch (QueryException $e) {
                if ($this->isDuplicateOrderCodeViolation($e)) {
                    $existing = $this->findByOrderCode($campaign, $code);
                    if ($existing) {
                        try {
                            $reviewedAt = $this->assertReviewDateValid(
                                $campaign,
                                (string) ($item['reviewed_at'] ?? now()->format('Y-m-d H:i:s')),
                            );
                            $updated[] = $this->updateFromPaste(
                                $existing,
                                $data,
                                $item,
                                $reviewedAt,
                                $submittedBy,
                            );
                            continue;
                        } catch (ValidationException $ve) {
                            $failed[] = [
                                'order_code' => $code,
                                'message' => collect($ve->errors())->flatten()->first() ?? 'Không cập nhật được.',
                            ];
                            continue;
                        }
                    }
                }

                $failed[] = [
                    'order_code' => $code,
                    'message' => 'Lỗi lưu mã đơn.',
                ];
            }
        }

        if ($created === [] && $updated === [] && $failed !== []) {
            throw ValidationException::withMessages([
                'paste' => $failed[0]['message'] ?? 'Không lưu được đánh giá nào.',
            ]);
        }

        return compact('created', 'updated', 'failed');
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array{order_code: string, reviewed_at: ?string, rating: int, snippet?: ?string}  $item
     */
    protected function insertFromPaste(
        MarketingReviewCampaign $campaign,
        array $data,
        array $item,
        Carbon $reviewedAt,
        ?int $submittedBy,
    ): MarketingReview {
        return DB::transaction(function () use ($data, $campaign, $item, $reviewedAt, $submittedBy) {
            return MarketingReview::query()->create([
                'organization_id' => $campaign->organization_id,
                'campaign_id' => $campaign->id,
                'order_code' => $item['order_code'],
                'customer_name' => $data['customer_name'] ?? null,
                'customer_phone' => $data['customer_phone'] ?? null,
                'channel_id' => $data['channel_id'],
                'branch_id' => $data['branch_id'],
                'rating' => $item['rating'],
                'review_content' => $data['review_content']
                    ?? ($item['snippet'] ?? null)
                    ?? ($data['paste'] ?? null),
                'reviewed_at' => $reviewedAt,
                'source' => $data['source'] ?? null,
                'source_reference' => $data['source_reference'] ?? null,
                'status' => MarketingReview::STATUS_PENDING,
                'submitted_by' => $submittedBy,
            ]);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array{order_code: string, reviewed_at: ?string, rating: int, snippet?: ?string}  $item
     */
    protected function updateFromPaste(
        MarketingReview $review,
        array $data,
        array $item,
        Carbon $reviewedAt,
        ?int $submittedBy,
    ): MarketingReview {
        return DB::transaction(function () use ($review, $data, $item, $reviewedAt, $submittedBy) {
            $locked = MarketingReview::query()
                ->whereKey($review->id)
                ->lockForUpdate()
                ->firstOrFail();

            $attrs = [
                'channel_id' => $data['channel_id'],
                'branch_id' => $data['branch_id'],
                'rating' => $item['rating'],
                'reviewed_at' => $reviewedAt,
                'source' => $data['source'] ?? $locked->source,
                'source_reference' => $data['source_reference'] ?? $locked->source_reference,
            ];

            if (array_key_exists('customer_name', $data) && $data['customer_name'] !== null) {
                $attrs['customer_name'] = $data['customer_name'];
            }
            if (array_key_exists('customer_phone', $data) && $data['customer_phone'] !== null) {
                $attrs['customer_phone'] = $data['customer_phone'];
            }

            $content = $data['review_content'] ?? ($item['snippet'] ?? null);
            if ($content !== null && $content !== '') {
                $attrs['review_content'] = $content;
            }

            // REJECTED → cho dán lại thành PENDING; VERIFIED giữ nguyên trạng thái
            if ($locked->status === MarketingReview::STATUS_REJECTED) {
                $attrs['status'] = MarketingReview::STATUS_PENDING;
                $attrs['rejection_reason'] = null;
                $attrs['verified_by'] = null;
                $attrs['verified_at'] = null;
            }

            if ($submittedBy !== null) {
                $attrs['submitted_by'] = $submittedBy;
            }

            $locked->fill($attrs);
            $locked->save();

            return $locked->fresh();
        });
    }

    protected function findByOrderCode(
        MarketingReviewCampaign $campaign,
        string $orderCode,
    ): ?MarketingReview {
        $candidates = array_values(array_unique(array_filter([
            $orderCode,
            ltrim($orderCode, '#'),
            str_starts_with($orderCode, '#') ? $orderCode : '#'.$orderCode,
        ])));

        return MarketingReview::query()
            ->where('organization_id', $campaign->organization_id)
            ->where('campaign_id', $campaign->id)
            ->whereIn('order_code', $candidates)
            ->first();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array{order_code: string, reviewed_at: ?string, rating: int, snippet?: string}>
     */
    public function resolveCreateItems(array $data, int $defaultRating = 5): array
    {
        $paste = isset($data['paste']) ? trim((string) $data['paste']) : '';
        $manualCode = isset($data['order_code']) ? trim((string) $data['order_code']) : '';
        $manualAt = isset($data['reviewed_at']) ? trim((string) $data['reviewed_at']) : '';

        if ($paste !== '') {
            $many = $this->parsePasteMany($paste);
            if (count($many) > 1) {
                return array_map(function (array $row) use ($defaultRating) {
                    return [
                        'order_code' => $row['order_code'],
                        'reviewed_at' => $row['reviewed_at'],
                        'rating' => $row['rating'] ?? $defaultRating,
                        'snippet' => $row['snippet'] ?? null,
                    ];
                }, $many);
            }
            if (count($many) === 1) {
                $row = $many[0];

                return [[
                    'order_code' => $manualCode !== '' ? $manualCode : $row['order_code'],
                    'reviewed_at' => $manualAt !== '' ? $manualAt : $row['reviewed_at'],
                    'rating' => $row['rating'] ?? $defaultRating,
                    'snippet' => $row['snippet'] ?? null,
                ]];
            }
        }

        if ($manualCode !== '') {
            return [[
                'order_code' => $manualCode,
                'reviewed_at' => $manualAt !== '' ? $manualAt : now()->format('Y-m-d H:i:s'),
                'rating' => $defaultRating,
            ]];
        }

        return [];
    }

    /**
     * Parse nội dung dán (OCR / text) → order_code + reviewed_at + rating.
     *
     * @return array{order_code: ?string, reviewed_at: ?string, rating: ?int}
     */
    public function parsePaste(string $text): array
    {
        $many = $this->parsePasteMany($text);
        if ($many === []) {
            return [
                'order_code' => null,
                'reviewed_at' => null,
                'rating' => null,
            ];
        }

        return [
            'order_code' => $many[0]['order_code'],
            'reviewed_at' => $many[0]['reviewed_at'],
            'rating' => $many[0]['rating'],
        ];
    }

    /**
     * Tách nhiều đánh giá từ 1 lần dán (JSON array / nhiều block / nhiều mã đơn).
     *
     * @return list<array{order_code: string, reviewed_at: ?string, rating: ?int, snippet: ?string}>
     */
    public function parsePasteMany(string $text): array
    {
        $text = trim($text);
        if ($text === '') {
            return [];
        }

        $asJson = json_decode($text, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($asJson)) {
            if ($this->isListArray($asJson)) {
                $out = [];
                foreach ($asJson as $row) {
                    if (! is_array($row)) {
                        continue;
                    }
                    $code = isset($row['order_code']) ? trim((string) $row['order_code']) : '';
                    if ($code === '') {
                        continue;
                    }
                    $out[] = [
                        'order_code' => $this->normalizeOrderCode($code),
                        'reviewed_at' => isset($row['reviewed_at'])
                            ? $this->normalizeReviewedAt(trim((string) $row['reviewed_at']))
                            : null,
                        'rating' => isset($row['rating']) ? (int) $row['rating'] : null,
                        'snippet' => null,
                    ];
                }

                return $this->uniqueByOrderCode($out);
            }

            if (isset($asJson['reviews']) && is_array($asJson['reviews'])) {
                return $this->parsePasteMany(json_encode($asJson['reviews'], JSON_UNESCAPED_UNICODE));
            }

            if (isset($asJson['order_code'])) {
                return [[
                    'order_code' => $this->normalizeOrderCode(trim((string) $asJson['order_code'])),
                    'reviewed_at' => isset($asJson['reviewed_at'])
                        ? $this->normalizeReviewedAt(trim((string) $asJson['reviewed_at']))
                        : null,
                    'rating' => isset($asJson['rating']) ? (int) $asJson['rating'] : null,
                    'snippet' => null,
                ]];
            }
        }

        $chunks = preg_split("/\n\s*\n+|^\s*[-–—]{3,}\s*$/mu", $text) ?: [$text];
        $fromChunks = [];
        foreach ($chunks as $chunk) {
            $chunk = trim((string) $chunk);
            if ($chunk === '') {
                continue;
            }
            $codes = $this->extractOrderCodes($chunk);
            if (count($codes) !== 1) {
                continue;
            }
            $fromChunks[] = [
                'order_code' => $codes[0]['code'],
                'reviewed_at' => $this->extractReviewedAtNear($chunk, 0, strlen($chunk)),
                'rating' => $this->extractRating($chunk),
                'snippet' => mb_substr($chunk, 0, 500),
            ];
        }
        if (count($fromChunks) > 1) {
            return $this->uniqueByOrderCode($fromChunks);
        }

        $codes = $this->extractOrderCodes($text);
        if ($codes === []) {
            return [];
        }

        $out = [];
        $len = strlen($text);
        foreach ($codes as $i => $hit) {
            $start = $hit['offset'];
            $codeEnd = $start + $hit['length'];
            $end = isset($codes[$i + 1]) ? $codes[$i + 1]['offset'] : $len;
            // Cửa sổ: từ mã đơn → mã kế (tránh lấy ngày của review trước)
            $window = substr($text, $start, max(1, $end - $start));
            $out[] = [
                'order_code' => $hit['code'],
                'reviewed_at' => $this->extractReviewedAtNear($text, $codeEnd, $end)
                    ?? $this->extractReviewedAtNear($window, 0, strlen($window)),
                'rating' => $this->extractRating($window),
                'snippet' => mb_substr($window, 0, 500),
            ];
        }

        return $this->uniqueByOrderCode($out);
    }

    /**
     * @return list<array{code: string, offset: int, length: int}>
     */
    private function extractOrderCodes(string $text): array
    {
        $hits = [];
        if (preg_match_all('/#?\d{4,}[-–]\d{6,}/u', $text, $m, PREG_OFFSET_CAPTURE)) {
            foreach ($m[0] as [$raw, $offset]) {
                $hits[] = [
                    'code' => $this->normalizeOrderCode($raw),
                    'offset' => (int) $offset,
                    'length' => strlen($raw),
                ];
            }
        }
        if ($hits === [] && preg_match_all('/#\d[\d\-–]{5,}/u', $text, $m, PREG_OFFSET_CAPTURE)) {
            foreach ($m[0] as [$raw, $offset]) {
                $hits[] = [
                    'code' => $this->normalizeOrderCode($raw),
                    'offset' => (int) $offset,
                    'length' => strlen($raw),
                ];
            }
        }

        return $hits;
    }

    private function extractReviewedAtNear(string $text, int $start, int $end): ?string
    {
        $slice = substr($text, $start, max(0, $end - $start));
        if ($slice === '') {
            return null;
        }

        // Ưu tiên dd/mm/yyyy (ShopeeFood / VN OCR), rồi yyyy-mm-dd
        $patterns = [
            // 15/08/2026 17:29 | 15-08-2026 17:29:00
            '/(?P<d>\d{1,2})[\/\-.](?P<m>\d{1,2})[\/\-.](?P<y>\d{4})(?:\s+(?P<t>\d{1,2}:\d{2}(?::\d{2})?))?/',
            // 2026-08-15 17:29 | 2026/08/15
            '/(?P<y>\d{4})[\/\-.](?P<m>\d{1,2})[\/\-.](?P<d>\d{1,2})(?:\s+(?P<t>\d{1,2}:\d{2}(?::\d{2})?))?/',
        ];

        foreach ($patterns as $pattern) {
            if (! preg_match($pattern, $slice, $m)) {
                continue;
            }
            $day = (int) $m['d'];
            $month = (int) $m['m'];
            $year = (int) $m['y'];
            if ($day < 1 || $day > 31 || $month < 1 || $month > 12 || $year < 2000) {
                continue;
            }
            $time = $m['t'] ?? '00:00:00';
            if (strlen($time) === 5) {
                $time .= ':00';
            }

            return $this->normalizeReviewedAt(sprintf(
                '%04d-%02d-%02d %s',
                $year,
                $month,
                $day,
                $time
            ));
        }

        return null;
    }

    private function extractRating(string $text): ?int
    {
        if (preg_match('/([1-5])\s*[★*]/u', $text, $m)) {
            return (int) $m[1];
        }
        // ShopeeFood OCR: "...5.0" (có thể dính ký tự lạ)
        if (preg_match('/(?<![0-9])([1-5])\.0(?![0-9])/u', $text, $m)) {
            return (int) $m[1];
        }

        return null;
    }

    private function normalizeOrderCode(string $code): string
    {
        $code = trim($code);
        if ($code !== '' && ! str_starts_with($code, '#') && preg_match('/^\d{4,}[-–]\d{6,}$/u', $code)) {
            return '#'.$code;
        }

        return $code;
    }

    private function normalizeReviewedAt(string $value): ?string
    {
        $value = trim(preg_replace('/\s+/', ' ', $value) ?? $value);
        if ($value === '') {
            return null;
        }

        // dd/mm/yyyy [HH:mm[:ss]] — tránh Carbon hiểu nhầm mm/dd
        if (preg_match(
            '/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$/',
            $value,
            $m
        )) {
            $time = $m[4] ?? '00:00:00';
            if (strlen($time) === 5) {
                $time .= ':00';
            }
            $value = sprintf('%04d-%02d-%02d %s', (int) $m[3], (int) $m[2], (int) $m[1], $time);
        }

        if (preg_match('/^\d{4}-\d{1,2}-\d{1,2} \d{1,2}:\d{2}$/', $value)) {
            $value .= ':00';
        }
        try {
            return Carbon::createFromFormat('Y-m-d H:i:s', $value)->format('Y-m-d H:i:s');
        } catch (\Throwable) {
            try {
                return Carbon::parse($value)->format('Y-m-d H:i:s');
            } catch (\Throwable) {
                return null;
            }
        }
    }

    /**
     * @param  list<array{order_code: string, reviewed_at: ?string, rating: ?int, snippet: ?string}>  $rows
     * @return list<array{order_code: string, reviewed_at: ?string, rating: ?int, snippet: ?string}>
     */
    private function uniqueByOrderCode(array $rows): array
    {
        $seen = [];
        $out = [];
        foreach ($rows as $row) {
            $key = mb_strtolower(trim($row['order_code']));
            if ($key === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = $row;
        }

        return $out;
    }

    private function isListArray(array $arr): bool
    {
        if ($arr === []) {
            return true;
        }

        return array_keys($arr) === range(0, count($arr) - 1);
    }

    /**
     * @return array<string, mixed>
     */
    public function formMeta(): array
    {
        $campaign = $this->campaigns->ensureDefaultActiveCampaign();
        $campaign->loadMissing(['campaignBranches', 'campaignChannels']);

        $channels = \App\Models\MarketingChannel::query()
            ->ordered()
            ->get(['id', 'name', 'code', 'color', 'enabled']);

        if ($campaign && $campaign->campaignChannels->isNotEmpty()) {
            $allowed = $campaign->campaignChannels
                ->where('enabled', true)
                ->pluck('channel_id');
            $channels = $channels->whereIn('id', $allowed)->values();
        } else {
            $channels = $channels->where('enabled', true)->values();
        }

        $branchIds = $campaign && $campaign->campaignBranches->isNotEmpty()
            ? $campaign->campaignBranches->pluck('branch_id')->all()
            : null;

        $branches = \App\Models\Branch::query()
            ->when($branchIds !== null, fn ($q) => $q->whereIn('id', $branchIds))
            ->orderBy('name')
            ->get(['id', 'name']);

        $rewards = \App\Models\MarketingReward::query()
            ->enabled()
            ->ordered()
            ->get();

        if ($campaign) {
            $linkedIds = \App\Models\MarketingCampaignReward::query()
                ->where('campaign_id', $campaign->id)
                ->where('enabled', true)
                ->pluck('reward_id');
            if ($linkedIds->isNotEmpty()) {
                $rewards = $rewards->whereIn('id', $linkedIds)->values();
            }
        }

        return [
            'campaign' => $campaign ? [
                'id' => $campaign->id,
                'name' => $campaign->name,
                'min_rating' => $campaign->min_rating,
                'start_at' => optional($campaign->start_at)?->toIso8601String(),
                'end_at' => optional($campaign->end_at)?->toIso8601String(),
            ] : null,
            'channels' => $channels->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'code' => $c->code,
                'color' => $c->color,
            ])->values(),
            'branches' => $branches->map(fn ($b) => [
                'id' => $b->id,
                'name' => $b->name,
            ])->values(),
            'rewards' => $rewards->map(fn (\App\Models\MarketingReward $r) => [
                'id' => $r->id,
                'name' => $r->name,
                'value' => (int) $r->value,
                'image_url' => $r->imageUrl(),
            ])->values(),
            'defaults' => [
                'rating' => 5,
            ],
        ];
    }

    /**
     * Xác minh review trong transaction + row lock.
     * Tránh 2 nhân viên cùng verify / cấp 2 mã.
     *
     * @return array{review: MarketingReview, reward_code: ?\App\Models\MarketingRewardCode}
     */
    public function verify(int $reviewId, int $verifiedBy): array
    {
        return DB::transaction(function () use ($reviewId, $verifiedBy) {
            /** @var MarketingReview $review */
            $review = MarketingReview::query()
                ->whereKey($reviewId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($review->status !== MarketingReview::STATUS_PENDING) {
                throw ValidationException::withMessages([
                    'status' => 'Chỉ xác minh được review đang PENDING.',
                ]);
            }

            /** @var MarketingReviewCampaign $campaign */
            $campaign = MarketingReviewCampaign::query()
                ->whereKey($review->campaign_id)
                ->lockForUpdate()
                ->firstOrFail();

            $this->assertEligibleForVerify($review, $campaign);

            $review->status = MarketingReview::STATUS_VERIFIED;
            $review->verified_by = $verifiedBy;
            $review->verified_at = now();
            $review->rejection_reason = null;
            $review->save();

            $rewardCode = null;
            if ($campaign->auto_issue_reward) {
                $rewardCode = $this->rewardCodes->issueForVerifiedReview($review, $campaign);
            }

            return [
                'review' => $review->fresh(['campaign', 'channel', 'branch']) ?? $review,
                'reward_code' => $rewardCode,
            ];
        });
    }

    public function reject(int $reviewId, string $reason, int $rejectedBy): MarketingReview
    {
        return DB::transaction(function () use ($reviewId, $reason, $rejectedBy) {
            /** @var MarketingReview $review */
            $review = MarketingReview::query()
                ->whereKey($reviewId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($review->status !== MarketingReview::STATUS_PENDING) {
                throw ValidationException::withMessages([
                    'status' => 'Chỉ từ chối được review đang PENDING.',
                ]);
            }

            $review->status = MarketingReview::STATUS_REJECTED;
            $review->rejection_reason = trim($reason);
            $review->verified_by = $rejectedBy;
            $review->verified_at = now();
            $review->save();

            return $review->fresh(['campaign', 'channel', 'branch']) ?? $review;
        });
    }

    /**
     * Cấp mã thủ công cho review đã VERIFIED (transaction + row lock).
     *
     * @return array{review: MarketingReview, reward_code: \App\Models\MarketingRewardCode}
     */
    public function issueReward(int $reviewId, ?int $rewardId = null): array
    {
        return DB::transaction(function () use ($reviewId, $rewardId) {
            /** @var MarketingReview $review */
            $review = MarketingReview::query()
                ->whereKey($reviewId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($review->status !== MarketingReview::STATUS_VERIFIED) {
                throw ValidationException::withMessages([
                    'status' => 'Chỉ cấp mã cho review đã VERIFIED.',
                ]);
            }

            /** @var MarketingReviewCampaign $campaign */
            $campaign = MarketingReviewCampaign::query()
                ->whereKey($review->campaign_id)
                ->lockForUpdate()
                ->firstOrFail();

            $this->assertCampaignActive($campaign);

            $rewardCode = $this->rewardCodes->issueForVerifiedReview(
                $review,
                $campaign,
                $rewardId,
            );

            return [
                'review' => $review->fresh(['campaign', 'channel', 'branch']) ?? $review,
                'reward_code' => $rewardCode,
            ];
        });
    }

    public function payload(MarketingReview $review): array
    {
        $review->loadMissing(['campaign', 'channel', 'branch']);

        return [
            'id' => $review->id,
            'organization_id' => $review->organization_id,
            'campaign_id' => $review->campaign_id,
            'order_code' => $review->order_code,
            'customer_name' => $review->customer_name,
            'customer_phone' => $review->customer_phone,
            'channel_id' => $review->channel_id,
            'branch_id' => $review->branch_id,
            'rating' => $review->rating,
            'review_content' => $review->review_content,
            'reviewed_at' => optional($review->reviewed_at)?->format('Y-m-d H:i:s'),
            'source' => $review->source,
            'source_reference' => $review->source_reference,
            'status' => $review->status,
            'submitted_by' => $review->submitted_by,
            'verified_by' => $review->verified_by,
            'verified_at' => optional($review->verified_at)?->toIso8601String(),
            'rejection_reason' => $review->rejection_reason,
            'created_at' => optional($review->created_at)?->toIso8601String(),
            'updated_at' => optional($review->updated_at)?->toIso8601String(),
        ];
    }

    protected function assertEligibleForVerify(
        MarketingReview $review,
        MarketingReviewCampaign $campaign,
    ): void {
        $this->assertCampaignActive($campaign);
        $this->assertRatingMeetsMinimum($campaign, (int) $review->rating);

        if ($review->reviewed_at) {
            $this->assertReviewDateValid(
                $campaign,
                $review->reviewed_at->format('Y-m-d H:i:s'),
            );
        }

        $this->assertChannelBelongsToCampaign($campaign, (int) $review->channel_id);
        $this->assertBranchBelongsToCampaign($campaign, (int) $review->branch_id);
    }

    protected function assertCampaignActive(MarketingReviewCampaign $campaign): void
    {
        if ($campaign->status !== MarketingReviewCampaign::STATUS_ACTIVE) {
            throw ValidationException::withMessages([
                'campaign_id' => 'Chiến dịch không đang active.',
            ]);
        }
    }

    protected function assertRatingMeetsMinimum(
        MarketingReviewCampaign $campaign,
        int $rating,
    ): void {
        $min = (int) $campaign->min_rating;

        if ($rating < $min) {
            throw ValidationException::withMessages([
                'rating' => "Rating phải >= {$min} (min_rating của chiến dịch).",
            ]);
        }
    }

    protected function assertReviewDateValid(
        MarketingReviewCampaign $campaign,
        string $reviewedAtRaw,
    ): Carbon {
        $reviewedAt = Carbon::parse($reviewedAtRaw);

        if ($reviewedAt->isFuture()) {
            throw ValidationException::withMessages([
                'reviewed_at' => 'Thời điểm đánh giá không được ở tương lai.',
            ]);
        }

        if ($campaign->start_at && $reviewedAt->lt($campaign->start_at)) {
            throw ValidationException::withMessages([
                'reviewed_at' => 'Thời điểm đánh giá trước ngày bắt đầu chiến dịch.',
            ]);
        }

        if ($campaign->end_at && $reviewedAt->gt($campaign->end_at)) {
            throw ValidationException::withMessages([
                'reviewed_at' => 'Thời điểm đánh giá sau ngày kết thúc chiến dịch.',
            ]);
        }

        return $reviewedAt;
    }

    protected function assertChannelBelongsToCampaign(
        MarketingReviewCampaign $campaign,
        int $channelId,
    ): void {
        $linked = MarketingCampaignChannel::query()
            ->where('campaign_id', $campaign->id)
            ->exists();

        if (! $linked) {
            $ok = \App\Models\MarketingChannel::query()
                ->whereKey($channelId)
                ->where('enabled', true)
                ->exists();
            if (! $ok) {
                throw ValidationException::withMessages([
                    'channel_id' => 'Channel không hợp lệ.',
                ]);
            }

            return;
        }

        $ok = MarketingCampaignChannel::query()
            ->where('campaign_id', $campaign->id)
            ->where('channel_id', $channelId)
            ->where('enabled', true)
            ->exists();

        if (! $ok) {
            throw ValidationException::withMessages([
                'channel_id' => 'Channel không thuộc chiến dịch (hoặc đang tắt).',
            ]);
        }
    }

    protected function assertBranchBelongsToCampaign(
        MarketingReviewCampaign $campaign,
        int $branchId,
    ): void {
        $linked = MarketingCampaignBranch::query()
            ->where('campaign_id', $campaign->id)
            ->exists();

        if (! $linked) {
            $ok = \App\Models\Branch::query()->whereKey($branchId)->exists();
            if (! $ok) {
                throw ValidationException::withMessages([
                    'branch_id' => 'Chi nhánh không hợp lệ.',
                ]);
            }

            return;
        }

        $ok = MarketingCampaignBranch::query()
            ->where('campaign_id', $campaign->id)
            ->where('branch_id', $branchId)
            ->exists();

        if (! $ok) {
            throw ValidationException::withMessages([
                'branch_id' => 'Chi nhánh không thuộc chiến dịch.',
            ]);
        }
    }

    protected function assertOrderCodeUnique(
        MarketingReviewCampaign $campaign,
        string $orderCode,
    ): void {
        $exists = MarketingReview::query()
            ->where('organization_id', $campaign->organization_id)
            ->where('campaign_id', $campaign->id)
            ->where('order_code', $orderCode)
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'order_code' => 'Mã đơn đã có review trong chiến dịch này.',
            ]);
        }
    }

    protected function isDuplicateOrderCodeViolation(QueryException $e): bool
    {
        $message = $e->getMessage();

        return str_contains($message, 'marketing_reviews_org_campaign_order_unique')
            || (str_contains($message, 'Duplicate entry')
                && str_contains($message, 'order_code'));
    }
}
