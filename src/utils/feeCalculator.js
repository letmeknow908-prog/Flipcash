/**
 * FlipCash Dynamic Fee Calculator
 * USER-FRIENDLY VERSION - Service fee hidden in rate
 */

const FLUTTERWAVE_COST_NGN = 1194.44;

/**
 * Calculate fees - Service fee hidden in exchange rate
 */
function calculateFees(amountNGN, direction = 'NGN_TO_KSH') {
    let swapFeePercent, withdrawalFeePercent, tier, rateMarkupPercent;
    
    // ✅ MINIMUM TRANSACTION: ₦2,000
    if (amountNGN < 2000) {
        throw new Error('Minimum transaction amount is ₦2,000');
    }
    
    // ✅ USER-FRIENDLY TIERS (no visible service fee)
    if (amountNGN < 5000) {
        // Starter: ₦2,000 - ₦4,999
        tier = 'Starter';
        rateMarkupPercent = 3.5;  // Hidden in rate
        swapFeePercent = 0;
        withdrawalFeePercent = 6;
    } else if (amountNGN < 20000) {
        // Basic: ₦5,000 - ₦19,999
        tier = 'Basic';
        rateMarkupPercent = 2.5;
        swapFeePercent = 0;
        withdrawalFeePercent = 4.5;
    } else if (amountNGN < 50000) {
        // Standard: ₦20,000 - ₦49,999
        tier = 'Standard';
        rateMarkupPercent = 1.5;
        swapFeePercent = 0;
        withdrawalFeePercent = 3.5;
    } else if (amountNGN < 100000) {
        // Premium: ₦50,000 - ₦99,999
        tier = 'Premium';
        rateMarkupPercent = 1;
        swapFeePercent = 0;
        withdrawalFeePercent = 2.8;
    } else {
        // VIP: ₦100,000+
        tier = 'VIP';
        rateMarkupPercent = 0.8;
        swapFeePercent = 0;
        withdrawalFeePercent = 2;
    }
    
    // Base exchange rate (from API)
    const BASE_RATE = 0.0908;
    
    // Apply hidden markup to rate
    const adjustedRate = BASE_RATE * (1 - rateMarkupPercent / 100);
    
    // Calculate swap (no visible swap fee)
    const swapFee = (amountNGN * swapFeePercent) / 100;
    const netAmount = amountNGN - swapFee;
    
    // Convert to KSH using ADJUSTED rate
    const amountKSH = netAmount * adjustedRate;
    
    // Calculate withdrawal fee
    const withdrawalFeeKSH = (amountKSH * withdrawalFeePercent) / 100;
    
    // Convert withdrawal fee to NGN for revenue calculation
    const FLUTTERWAVE_RATE = 0.09;
    const withdrawalFeeNGN = withdrawalFeeKSH / FLUTTERWAVE_RATE;
    
    // Calculate hidden service fee (from rate markup)
    const baseAmountKSH = netAmount * BASE_RATE;
    const hiddenServiceFeeKSH = baseAmountKSH - amountKSH;
    const hiddenServiceFeeNGN = hiddenServiceFeeKSH / FLUTTERWAVE_RATE;
    
    // Final amount user receives
    const finalAmountKSH = amountKSH - withdrawalFeeKSH;
    
    // Total revenue
    const totalRevenue = hiddenServiceFeeNGN + swapFee + withdrawalFeeNGN;
    
    // Profit calculation
    const profit = totalRevenue - FLUTTERWAVE_COST_NGN;
    const profitMargin = (profit / amountNGN) * 100;
    
    return {
        // Tier info
        tier,
        
        // Fee breakdown
        serviceFee: 0, // Hidden
        hiddenServiceFeeNGN, // For internal tracking
        swapFee,
        swapFeePercent,
        withdrawalFeeKSH,
        withdrawalFeeNGN,
        withdrawalFeePercent,
        rateMarkupPercent,
        
        // Rates
        baseRate: BASE_RATE,
        adjustedRate,
        
        // Amounts
        originalAmount: amountNGN,
        netAmount,
        amountKSH,
        finalAmountKSH,
        
        // Revenue & Profit
        totalRevenue,
        flutterwaveCost: FLUTTERWAVE_COST_NGN,
        profit,
        profitMargin: profitMargin.toFixed(2) + '%',
        profitable: profit > 0,
        
        // What user sees
        userVisibleFeePercent: withdrawalFeePercent,
        userVisibleFeeKSH: withdrawalFeeKSH
    };
}

/**
 * Get tier name for display
 */
function getTierName(amount) {
    if (amount < 2000) return 'Below Minimum';
    if (amount < 5000) return 'Starter';
    if (amount < 20000) return 'Basic';
    if (amount < 50000) return 'Standard';
    if (amount < 100000) return 'Premium';
    return 'VIP';
}

/**
 * Get tier info for display
 */
function getTierInfo(amount) {
    if (amount < 2000) {
        return {
            tier: 'Below Minimum',
            error: 'Minimum transaction amount is ₦2,000'
        };
    }
    
    const fees = calculateFees(amount);
    return {
        tier: fees.tier,
        withdrawalFeePercent: fees.withdrawalFeePercent,
        adjustedRate: fees.adjustedRate,
        userVisibleFeePercent: fees.userVisibleFeePercent,
        minAmount: amount < 5000 ? 2000 : amount < 20000 ? 5000 : amount < 50000 ? 20000 : amount < 100000 ? 50000 : 100000,
        maxAmount: amount < 5000 ? 4999 : amount < 20000 ? 19999 : amount < 50000 ? 49999 : amount < 100000 ? 99999 : null
    };
}

/**
 * Get withdrawal fee based on user's recent swap tier
 */
function getTierForWithdrawal(lastSwapAmount) {
    if (!lastSwapAmount || lastSwapAmount < 5000) {
        return {
            tier: 'Starter',
            withdrawalFeePercent: 6
        };
    } else if (lastSwapAmount < 20000) {
        return {
            tier: 'Basic',
            withdrawalFeePercent: 4.5
        };
    } else if (lastSwapAmount < 50000) {
        return {
            tier: 'Standard',
            withdrawalFeePercent: 3.5
        };
    } else if (lastSwapAmount < 100000) {
        return {
            tier: 'Premium',
            withdrawalFeePercent: 2.8
        };
    } else {
        return {
            tier: 'VIP',
            withdrawalFeePercent: 2
        };
    }
}

module.exports = {
    calculateFees,
    getTierForWithdrawal,
    getTierName,
    getTierInfo,
    FLUTTERWAVE_COST_NGN
};
