const axios = require('axios');

class FlutterwaveService {
    constructor() {
        this.secretKey = process.env.FLW_SECRET_KEY;
        this.baseURL = 'https://api.flutterwave.com/v3';
    }

    /**
     * Create a virtual account for a user
     */
    async createVirtualAccount(userData) {
        try {
            console.log('🏦 Creating Flutterwave virtual account for:', userData.email);

            const response = await axios.post(
                `${this.baseURL}/virtual-account-numbers`,
                {
                    email: userData.email,
                    is_permanent: true,
                    bvn: userData.bvn,
                    tx_ref: `flipcash_${userData.userId}_${Date.now()}`,
                    firstname: userData.firstName,
                    lastname: userData.lastName,
                    narration: `FlipCash - ${userData.firstName} ${userData.lastName}`
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.status === 'success') {
                console.log('✅ Virtual account created:', response.data.data);
                return {
                    success: true,
                    data: {
                        accountNumber: response.data.data.account_number,
                        accountName: response.data.data.account_name || `${userData.firstName} ${userData.lastName}`,
                        bank: response.data.data.bank_name,
                        flwRef: response.data.data.flw_ref,
                        orderRef: response.data.data.order_ref
                    }
                };
            } else {
                throw new Error(response.data.message || 'Failed to create virtual account');
            }
        } catch (error) {
            console.error('❌ Flutterwave virtual account error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Verify BVN details match user information
     */
    async verifyBVN(bvn, firstName, lastName, dob) {
        try {
            console.log('🔍 Verifying BVN:', { bvn: bvn.slice(0, 3) + '****', firstName, lastName });

            const response = await axios.post(
                `${this.baseURL}/kyc/bvns/${bvn}`,
                {
                    first_name: firstName,
                    last_name: lastName,
                    date_of_birth: dob // Format: YYYY-MM-DD
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.status === 'success') {
                const bvnData = response.data.data;
                
                console.log('✅ BVN verification result:', {
                    firstNameMatch: bvnData.first_name?.toLowerCase() === firstName.toLowerCase(),
                    lastNameMatch: bvnData.last_name?.toLowerCase() === lastName.toLowerCase()
                });

                return {
                    success: true,
                    data: {
                        firstName: bvnData.first_name,
                        lastName: bvnData.last_name,
                        dob: bvnData.date_of_birth,
                        phone: bvnData.phone_number,
                        match: bvnData.first_name?.toLowerCase() === firstName.toLowerCase() && 
                               bvnData.last_name?.toLowerCase() === lastName.toLowerCase()
                    }
                };
            } else {
                throw new Error(response.data.message || 'BVN verification failed');
            }
        } catch (error) {
            console.error('❌ BVN verification error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Get live exchange rates from Flutterwave
     */
    async getExchangeRates() {
        try {
            console.log('💱 Fetching live exchange rates from Flutterwave...');

            // NGN to KES
            const ngnToKesResponse = await axios.get(
                `${this.baseURL}/transfers/rates?amount=1&destination_currency=KES&source_currency=NGN`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`
                    }
                }
            );

            // KES to NGN
            const kesToNgnResponse = await axios.get(
                `${this.baseURL}/transfers/rates?amount=1&destination_currency=NGN&source_currency=KES`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`
                    }
                }
            );

            if (ngnToKesResponse.data.status === 'success' && kesToNgnResponse.data.status === 'success') {
                const ngnToKsh = parseFloat(ngnToKesResponse.data.data.rate);
                const kshToNgn = parseFloat(kesToNgnResponse.data.data.rate);

                console.log('✅ Live rates fetched:', { ngnToKsh, kshToNgn });

                return {
                    success: true,
                    data: {
                        ngnToKsh: ngnToKsh,
                        kshToNgn: kshToNgn,
                        lastUpdated: new Date().toISOString()
                    }
                };
            } else {
                throw new Error('Failed to fetch exchange rates');
            }
        } catch (error) {
            console.error('❌ Flutterwave exchange rate error:', error.response?.data || error.message);
            
            // Fallback to default rates if API fails
            return {
                success: true,
                data: {
                    ngnToKsh: 0.18,
                    kshToNgn: 5.5,
                    lastUpdated: new Date().toISOString(),
                    fallback: true
                }
            };
        }
    }

    /**
     * Verify a transaction
     */
    async verifyTransaction(transactionId) {
        try {
            const response = await axios.get(
                `${this.baseURL}/transactions/${transactionId}/verify`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`
                    }
                }
            );

            return {
                success: response.data.status === 'success',
                data: response.data.data
            };
        } catch (error) {
            console.error('❌ Transaction verification error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new FlutterwaveService();
