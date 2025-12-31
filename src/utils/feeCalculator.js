/**
 * FlipCash Fee Calculator - FINAL VERSION
 * Smart fee structure: Tampered rates for small amounts, LIVE rates from ₦10K+
 */

const FLUTTERWAVE_COST_NGN = 1194.44; // 107.5 KSH flat fee
const BASE_RATE = 0.0908; // Live market rate (will be updated from API)

function calculateFees(amountNGN, direction = 'NGN_TO_KSH') {
    // ✅ MINIMUM: ₦2,000
    if (amountNGN < 2000) {
        throw new Error('Minimum transaction amount is ₦2,000');
    }
    
    let tier, rateMarkupPercent, withdrawalFeePercent;
    
    // ✅ TIER STRUCTURE (Based on user requirements)
    if (amountNGN < 5000) {
        // Micro: ₦2,000 - ₦4,999 (TAMPERED - High fees)
        tier = 'Micro';
        rateMarkupPercent = 40;  // User gets 60% of value
        withdrawalFeePercent = 20;
    } else if (amountNGN < 10000) {
        // Basic: ₦5,000 - ₦9,999 (TAMPERED - Moderate fees)
        tier = 'Basic';
        rateMarkupPercent = 15;  // User gets 76% of value
        withdrawalFeePercent = 12;
    } else if (amountNGN < 50000) {
        // Standard: ₦10,000 - ₦49,999 (LIVE RATE! 🔥)
        tier = 'Standard';
        rateMarkupPercent = 0;   // NO MARKUP - LIVE RATE
        withdrawalFeePercent = 14;
    } else if (amountNGN < 100000) {
        // Premium: ₦50,000 - ₦99,999 (LIVE RATE! 🔥)
        tier = 'Premium';
        rateMarkupPercent = 0;   // NO MARKUP - LIVE RATE
        withdrawalFeePercent = 8;
    } else if (amountNGN < 500000) {
        // VIP: ₦100,000 - ₦499,999 (LIVE RATE! 🔥)
        tier = 'VIP';
        rateMarkupPercent = 0;   // NO MARKUP - LIVE RATE
        withdrawalFeePercent = 5;
    } else {
        // Elite: ₦500,000+ (LIVE RATE! 🔥)
        tier = 'Elite';
        rateMarkupPercent = 0;   // NO MARKUP - LIVE RATE
        withdrawalFeePercent = 3.5;
    }
    
    // Calculate adjusted rate
    const adjustedRate = BASE_RATE * (1 - rateMarkupPercent / 100);
    
    // Swap calculation (no visible fee)
    const amountKSH = amountNGN * adjustedRate;
    
    // Hidden markup revenue (in KSH)
    const realValueKSH = amountNGN * BASE_RATE;
    const hiddenMarkupKSH = realValueKSH - amountKSH;
    const hiddenMarkupNGN = hiddenMarkupKSH / 0.09; // Convert to NGN
    
    // Withdrawal fee (visible to user)
    const withdrawalFeeKSH = amountKSH * (withdrawalFeePercent / 100);
    const withdrawalFeeNGN = withdrawalFeeKSH / 0.09;
    
    // Final amount user receives AFTER withdrawal
    const finalAmountKSH = amountKSH - withdrawalFeeKSH;
    
    // Revenue & Profit
    const totalRevenue = hiddenMarkupNGN + withdrawalFeeNGN;
    const profit = totalRevenue - FLUTTERWAVE_COST_NGN;
    
    return {
        tier,
        rateMarkupPercent,
        withdrawalFeePercent,
        baseRate: BASE_RATE,
        adjustedRate,
        amountKSH,              // Credited to wallet
        withdrawalFeeKSH,       // Fee deducted on withdrawal
        finalAmountKSH,         // User receives this
        hiddenMarkupNGN,
        withdrawalFeeNGN,
        totalRevenue,
        flutterwaveCost: FLUTTERWAVE_COST_NGN,
        profit,
        profitable: profit > 0
    };
}

function getTierForWithdrawal(lastSwapAmount) {
    if (!lastSwapAmount) {
        return { tier: 'Micro', withdrawalFeePercent: 20 };
    }
    
    if (lastSwapAmount < 5000) {
        return { tier: 'Micro', withdrawalFeePercent: 20 };
    } else if (lastSwapAmount < 10000) {
        return { tier: 'Basic', withdrawalFeePercent: 12 };
    } else if (lastSwapAmount < 50000) {
        return { tier: 'Standard', withdrawalFeePercent: 14 };
    } else if (lastSwapAmount < 100000) {
        return { tier: 'Premium', withdrawalFeePercent: 8 };
    } else if (lastSwapAmount < 500000) {
        return { tier: 'VIP', withdrawalFeePercent: 5 };
    } else {
        return { tier: 'Elite', withdrawalFeePercent: 3.5 };
    }
}

module.exports = {
    calculateFees,
    getTierForWithdrawal,
    FLUTTERWAVE_COST_NGN,
    BASE_RATE
};
