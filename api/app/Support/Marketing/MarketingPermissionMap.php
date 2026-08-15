<?php

namespace App\Support\Marketing;

/**
 * Map permission dotted (spec) → resource/action trong RolePermissionCatalog.
 *
 * marketing.review.view      → marketing_review.view
 * marketing.review.create    → marketing_review.create
 * marketing.review.verify    → marketing_review.update
 * marketing.review.reject    → marketing_review.update
 * marketing.reward.view      → marketing_reward.view
 * marketing.reward.issue     → marketing_reward.create
 * marketing.reward.cancel    → marketing_reward.delete
 * marketing.redemption.view  → marketing_redemption.view
 * marketing.redemption.redeem→ marketing_redemption.create
 * marketing.campaign.*       → marketing_campaign.*
 * marketing.settings.*       → marketing_settings.*
 */
final class MarketingPermissionMap
{
    public const REVIEW = 'marketing_review';
    public const REWARD = 'marketing_reward';
    public const REDEMPTION = 'marketing_redemption';
    public const CAMPAIGN = 'marketing_campaign';
    public const SETTINGS = 'marketing_settings';
}
