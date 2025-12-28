const axios = require('axios');

class ExchangeRatesService {
    constructor() {
        this.apiKey = '3dad52876ca5008378b1b0d6';
        this.baseURL = 'https://open.er-api.com/v6/latest';
        this.markup = 0.02; // 2% markup on rates
    }

    /**
     * Get live NGN → KES exchange rate with markup
     */
    async getLiveRates() {
        try {
            console.log('💱 Fetching live FX rates from ExchangeRatesAPI...');
            
            // Fetch latest rates with EUR as base
            const response = await axios.get(`${this.baseURL}/latest`, {
                params: {
                    access_key: this.apiKey,
                    symbols: 'NGN,KES',
                    format: 1
                }
            });

            if (response.data.success) {
                const eurToNgn = response.data.rates.NGN;
                const eurToKes = response.data.rates.KES;
                
                // Calculate cross rate: NGN → KES
                const ngnToKesRaw = eurToKes / eurToNgn;
                const kesToNgnRaw = eurToNgn / eurToKes;
                
                // Apply 2% markup
                const ngnToKes = ngnToKesRaw * (1 + this.markup);
                const kesToNgn = kesToNgnRaw * (1 - this.markup);
                
                console.log('✅ Live rates with 2% markup:', {
                    ngnToKes: ngnToKes.toFixed(4),
                    kesToNgn: kesToNgn.toFixed(4),
                    rawRate: ngnToKesRaw.toFixed(4),
                    markup: `${this.markup * 100}%`
                });

                return {
                    success: true,
                    data: {
                        ngnToKsh: parseFloat(ngnToKes.toFixed(4)),
                        kshToNgn: parseFloat(kesToNgn.toFixed(4)),
                        lastUpdated: new Date().toISOString(),
                        source: 'ExchangeRatesAPI',
                        markup: this.markup
                    }
                };
            } else {
                throw new Error('API returned non-success status');
            }
        } catch (error) {
            console.error('❌ ExchangeRatesAPI error:', error.message);
            
            // Fallback to safe default rates
            return {
                success: false,
                data: {
                    ngnToKsh: 0.29, // Safe fallback
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
