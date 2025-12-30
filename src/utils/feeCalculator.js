/**
 * FlipCash Dynamic Fee Calculator
 * AGGRESSIVE on small amounts, COMPETITIVE on large amounts
 */

const FLUTTERWAVE_COST_NGN = 1194.44; // 107.5 KSH ÷ 0.09

function calculateFees(amountNGN, direction = 'NGN_TO_KSH') {
    let swapFeePercent, withdrawalFeePercent, tier, rateMarkupPercent;
    
    // ✅ MINIMUM TRANSACTION: ₦2,000
    if (amountNGN < 2000) {
        throw new Error('Minimum transaction amount is ₦2,000');
    }
    
    // ✅ AGGRESSIVE TIER STRUCTURE (Profitable on ALL amounts)
    if (amountNGN < 5000) {
        // Micro: ₦2,000 - ₦4,999
        tier = 'Micro';
        rateMarkupPercent = 20;  // AGGRESSIVE
        swapFeePercent = 0;
        withdrawalFeePercent = 12;
    } else if (amountNGN < 20000) {
        // Basic: ₦5,000 - ₦19,999
        tier = 'Basic';
        rateMarkupPercent = 10;
        swapFeePercent = 0;
        withdrawalFeePercent = 8;
    } else if (amountNGN < 50000) {
        // Standard: ₦20,000 - ₦49,999
        tier = 'Standard';
        rateMarkupPercent = 5;
        swapFeePercent = 0;
        withdrawalFeePercent = 5;
    } else if (amountNGN < 100000) {
        // Premium: ₦50,000 - ₦99,999
        tier = 'Premium';
        rateMarkupPercent = 3;
        swapFeePercent = 0;
        withdrawalFeePercent = 3.5;
    } else if (amountNGN < 500000) {
        // VIP: ₦100,000 - ₦499,999
        tier = 'VIP';
        rateMarkupPercent = 2;
        swapFeePercent = 0;
        withdrawalFeePercent = 2.5;
    } else {
        // Elite: ₦500,000+
        tier = 'Elite';
        rateMarkupPercent = 1.5;
        swapFeePercent = 0;
        withdrawalFeePercent = 2;
    }
    
    // Base exchange rate
    const BASE_RATE = 0.0908;
    
    // Apply hidden markup to rate
    const adjustedRate = BASE_RATE * (1 - rateMarkupPercent / 100);
    
    // Calculate swap
    const swapFee = (amountNGN * swapFeePercent) / 100;
    const netAmount = amountNGN - swapFee;
    
    // Convert to KSH using ADJUSTED rate
    const amountKSH = netAmount * adjustedRate;
    
    // Calculate withdrawal fee (deducted from KSH)
    const withdrawalFeeKSH = (amountKSH * withdrawalFeePercent) / 100;
    
    // Convert withdrawal fee to NGN for revenue calculation
    const FLUTTERWAVE_RATE = 0.09;
    const withdrawalFeeNGN = withdrawalFeeKSH / FLUTTERWAVE_RATE;
    
    // Calculate hidden service fee (from rate markup)
    const baseAmountKSH = netAmount * BASE_RATE;
    const hiddenServiceFeeKSH = baseAmountKSH - amountKSH;
    const hiddenServiceFeeNGN = hiddenServiceFeeKSH / FLUTTERWAVE_RATE;
    
    // Final amount user receives in KSH (AFTER withdrawal fee deducted)
    const finalAmountKSH = amountKSH - withdrawalFeeKSH;
    
    // Total revenue
    const totalRevenue = hiddenServiceFeeNGN + swapFee + withdrawalFeeNGN;
    
    // Profit calculation
    const profit = totalRevenue - FLUTTERWAVE_COST_NGN;
    const profitMargin = (profit / amountNGN) * 100;
    
    return {
        tier,
        serviceFee: 0, // No visible service fee
        hiddenServiceFeeNGN,
        swapFee,
        swapFeePercent,
        withdrawalFeeKSH,
        withdrawalFeeNGN,
        withdrawalFeePercent,
        rateMarkupPercent,
        baseRate: BASE_RATE,
        adjustedRate,
        originalAmount: amountNGN,
        netAmount,
        amountKSH, // Amount credited to user's wallet
        finalAmountKSH, // Amount user receives AFTER withdrawal fee
        totalRevenue,
        flutterwaveCost: FLUTTERWAVE_COST_NGN,
        profit,
        profitMargin: profitMargin.toFixed(2) + '%',
        profitable: profit > 0,
        userVisibleFeePercent: withdrawalFeePercent,
        userVisibleFeeKSH: withdrawalFeeKSH
    };
}

function getTierForWithdrawal(lastSwapAmount) {
    if (!lastSwapAmount || lastSwapAmount < 5000) {
        return { tier: 'Micro', withdrawalFeePercent: 12 };
    } else if (lastSwapAmount < 20000) {
        return { tier: 'Basic', withdrawalFeePercent: 8 };
    } else if (lastSwapAmount < 50000) {
        return { tier: 'Standard', withdrawalFeePercent: 5 };
    } else if (lastSwapAmount < 100000) {
        return { tier: 'Premium', withdrawalFeePercent: 3.5 };
    } else if (lastSwapAmount < 500000) {
        return { tier: 'VIP', withdrawalFeePercent: 2.5 };
    } else {
        return { tier: 'Elite', withdrawalFeePercent: 2 };
    }
}

module.exports = {
    calculateFees,
    getTierForWithdrawal,
    FLUTTERWAVE_COST_NGN
};
