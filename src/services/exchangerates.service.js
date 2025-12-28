const axios = require('axios');

class ExchangeRatesService {
    constructor() {
        // ✅ FREE API - No key needed!
        this.baseURL = 'https://open.er-api.com/v6/latest';
        this.markup = 0.02; // 2% markup
    }

    async getLiveRates() {
        try {
            console.log('💱 Fetching live FX rates from open.er-api.com...');
            
            // ✅ FIXED: Use parentheses, not backticks!
            const response = await axios.get(`${this.baseURL}/USD`, {
                timeout: 10000
            });

            console.log('📡 Exchange rate API response status:', response.status);

            if (response.data && response.data.rates) {
                const usdToNgn = response.data.rates.NGN;
                const usdToKes = response.data.rates.KES;
                
                if (!usdToNgn || !usdToKes) {
                    throw new Error('Missing NGN or KES rates in response');
                }
                
                // Calculate cross rate: NGN → KES
                const ngnToKesRaw = usdToKes / usdToNgn;
                const kesToNgnRaw = usdToNgn / usdToKes;
                
                // Apply 2% markup
                const ngnToKes = ngnToKesRaw * (1 + this.markup);
                const kesToNgn = kesToNgnRaw * (1 - this.markup);
                
                console.log('✅ Live rates calculated:', {
                    usdToNgn: usdToNgn.toFixed(2),
                    usdToKes: usdToKes.toFixed(2),
                    ngnToKesRaw: ngnToKesRaw.toFixed(4),
                    ngnToKesWithMarkup: ngnToKes.toFixed(4),
                    markup: `${this.markup * 100}%`
                });

                return {
                    success: true,
                    data: {
                        ngnToKsh: parseFloat(ngnToKes.toFixed(4)),
                        kshToNgn: parseFloat(kesToNgn.toFixed(4)),
                        lastUpdated: new Date().toISOString(),
                        source: 'open.er-api.com',
                        markup: this.markup
                    }
                };
            } else {
                throw new Error('API returned invalid data');
            }
        } catch (error) {
            console.error('❌ Exchange rate API error:', error.message);
            
            return {
                success: false,
                data: {
                    ngnToKsh: 0.29,
                    kshToNgn: 3.45,
                    lastUpdated: new Date().toISOString(),
                    source: 'fallback',
                    error: error.message
                }
            };
        }
    }
}

module.exports = new ExchangeRatesService();
