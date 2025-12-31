/**
 * FlipCash Fee Calculator - FINAL FIXED VERSION
 */

const FLUTTERWAVE_COST_NGN = 1194.44;
const BASE_RATE = 0.0908; // This will be overridden by live rate from API

function calculateFees(amountNGN, baseRate = BASE_RATE) {
    // ✅ MINIMUM: ₦2,000
    if (amountNGN < 2000) {
        throw new Error('Minimum transaction amount is ₦2,000');
    }
    
    let tier, rateMarkupPercent, withdrawalFeePercent;
    
    // ✅ TIER STRUCTURE
    if (amountNGN < 5000) {
        tier = 'Micro';
        rateMarkupPercent = 40;
        withdrawalFeePercent = 20;
    } else if (amountNGN < 10000) {
        tier = 'Basic';
        rateMarkupPercent = 15;
        withdrawalFeePercent = 12;
    } else if (amountNGN < 50000) {
        tier = 'Standard';
        rateMarkupPercent = 0;  // LIVE RATE
        withdrawalFeePercent = 14;
    } else if (amountNGN < 100000) {
        tier = 'Premium';
        rateMarkupPercent = 0;  // LIVE RATE
        withdrawalFeePercent = 8;
    } else if (amountNGN < 500000) {
        tier = 'VIP';
        rateMarkupPercent = 0;  // LIVE RATE
        withdrawalFeePercent = 5;
    } else {
        tier = 'Elite';
        rateMarkupPercent = 0;  // LIVE RATE
        withdrawalFeePercent = 3.5;
    }
    
    // Calculate adjusted rate (apply markup to base rate)
    const adjustedRate = baseRate * (1 - rateMarkupPercent / 100);
    
    // ✅ SWAP PHASE: Convert NGN to KSH using adjusted rate
    const amountKSH = amountNGN * adjustedRate;
    
    // ✅ HIDDEN MARKUP CALCULATION (revenue from rate difference)
    const realValueKSH = amountNGN * baseRate;
    const hiddenMarkupKSH = realValueKSH - amountKSH;
    const hiddenMarkupNGN = hiddenMarkupKSH / 0.09; // Convert to NGN equivalent
    
    // ✅ WITHDRAWAL FEE CALCULATION (will be charged when user withdraws)
    const withdrawalFeeKSH = amountKSH * (withdrawalFeePercent / 100);
    const withdrawalFeeNGN = withdrawalFeeKSH / 0.09;
    
    // ✅ FINAL AMOUNT (what user will get after withdrawal fee)
    const finalAmountKSH = amountKSH - withdrawalFeeKSH;
    
    // ✅ TOTAL DEDUCTED FROM USER'S NGN WALLET (just the swap amount, no extra fees on swap)
    const totalDeductedNGN = amountNGN;
    
    // Revenue & Profit
    const totalRevenue = hiddenMarkupNGN + withdrawalFeeNGN;
    const profit = totalRevenue - FLUTTERWAVE_COST_NGN;
    
    console.log('💰 [FEE CALC] Breakdown:', {
        tier,
        amountNGN,
        baseRate,
        adjustedRate,
        rateMarkupPercent: rateMarkupPercent + '%',
        amountKSH: amountKSH.toFixed(2),
        withdrawalFeePercent: withdrawalFeePercent + '%',
        withdrawalFeeKSH: withdrawalFeeKSH.toFixed(2),
        finalAmountKSH: finalAmountKSH.toFixed(2),
        totalDeductedNGN,
        profit: profit.toFixed(2)
    });
    
    return {
        tier,
        rateMarkupPercent,
        withdrawalFeePercent,
        baseRate,
        adjustedRate,
        amountKSH,                  // Amount credited to KSH wallet
        withdrawalFeeKSH,           // Fee charged on withdrawal
        finalAmountKSH,             // What user receives after withdrawal
        hiddenMarkupNGN,
        withdrawalFeeNGN,
        totalDeductedNGN,           // ✅ CRITICAL: What to deduct from NGN wallet
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
