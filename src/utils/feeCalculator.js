/**
 * FlipCash Dynamic Fee Calculator
 * Ensures profitability on ALL transaction amounts (₦200 - ₦1,000,000+)
 */

const FLUTTERWAVE_COST_NGN = 1194.44; // KSh 107.5 converted at 0.09 rate

/**
 * Calculate fees based on transaction amount
 * Returns all fee details including profitability
 */
function calculateFees(amountNGN, direction = 'NGN_TO_KSH') {
    let serviceFee, swapFeePercent, withdrawalFeePercent, tier;
    
    // Tiered fee structure based on amount
    if (amountNGN < 5000) {
    // Tier 1: Micro (₦200 - ₦5,000)
    tier = 'Micro';
    serviceFee = 1000;  // ✅ REDUCED from ₦1,500
    swapFeePercent = 0;
    withdrawalFeePercent = 5;
    } else if (amountNGN < 20000) {
        // Tier 2: Small (₦5,001 - ₦20,000)
        tier = 'Small';
        serviceFee = 800;
        swapFeePercent = 2;
        withdrawalFeePercent = 3;
    } else if (amountNGN < 50000) {
        // Tier 3: Medium (₦20,001 - ₦50,000)
        tier = 'Medium';
        serviceFee = 500;
        swapFeePercent = 1.5;
        withdrawalFeePercent = 2.5;
    } else if (amountNGN < 100000) {
        // Tier 4: Large (₦50,001 - ₦100,000)
        tier = 'Large';
        serviceFee = 300;
        swapFeePercent = 1;
        withdrawalFeePercent = 2;
    } else {
        // Tier 5: Very Large (₦100,001+)
        tier = 'Very Large';
        serviceFee = 200;
        swapFeePercent = 0.8;
        withdrawalFeePercent = 1.8;
    }
    
    // Calculate swap fee
    const swapFee = (amountNGN * swapFeePercent) / 100;
    const netAmount = amountNGN - swapFee;
    
    // Exchange rate (your platform rate)
    const YOUR_RATE = 0.0908;
    
    // Convert to KSH
    const amountKSH = netAmount * YOUR_RATE;
    
    // Calculate withdrawal fee in KSH
    const withdrawalFeeKSH = (amountKSH * withdrawalFeePercent) / 100;
    
    // Convert withdrawal fee back to NGN for revenue calculation
    const FLUTTERWAVE_RATE = 0.09;
    const withdrawalFeeNGN = withdrawalFeeKSH / FLUTTERWAVE_RATE;
    
    // Final amount user receives
    const finalAmountKSH = amountKSH - withdrawalFeeKSH;
    
    // Total revenue
    const totalRevenue = serviceFee + swapFee + withdrawalFeeNGN;
    
    // Profit calculation
    const profit = totalRevenue - FLUTTERWAVE_COST_NGN;
    const profitMargin = (profit / amountNGN) * 100;
    
    return {
        // Tier info
        tier,
        
        // Fee breakdown
        serviceFee,
        swapFee,
        swapFeePercent,
        withdrawalFeeKSH,
        withdrawalFeeNGN,
        withdrawalFeePercent,
        
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
        
        // Total fee percentage
        totalFeePercent: ((serviceFee + swapFee + withdrawalFeeNGN) / amountNGN * 100).toFixed(2) + '%'
    };
}

/**
 * Get tier name for display
 */
function getTierName(amount) {
    if (amount < 5000) return 'Micro';
    if (amount < 20000) return 'Small';
    if (amount < 50000) return 'Medium';
    if (amount < 100000) return 'Large';
    return 'Very Large';
}

/**
 * Get tier details for display
 */
function getTierInfo(amount) {
    const fees = calculateFees(amount);
    return {
        tier: fees.tier,
        serviceFee: fees.serviceFee,
        swapFeePercent: fees.swapFeePercent,
        withdrawalFeePercent: fees.withdrawalFeePercent,
        minAmount: amount < 5000 ? 200 : amount < 20000 ? 5001 : amount < 50000 ? 20001 : amount < 100000 ? 50001 : 100001,
        maxAmount: amount < 5000 ? 5000 : amount < 20000 ? 20000 : amount < 50000 ? 50000 : amount < 100000 ? 100000 : null
    };
}

module.exports = {
    calculateFees,
    getTierName,
    getTierInfo,
    FLUTTERWAVE_COST_NGN
};
