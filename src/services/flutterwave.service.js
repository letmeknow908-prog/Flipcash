const axios = require('axios');
const db = require('../../config/db');

class FlutterwaveService {
    constructor() {
        this.secretKey = process.env.FLW_SECRET_KEY;
        this.baseURL = 'https://api.flutterwave.com/v3';
    }

    /**
     * Create a virtual account for NGN deposits
     */
    async createVirtualAccount(userData) {
        try {
            console.log('🏦 Creating virtual account with Flutterwave...');
            
            const payload = {
                email: userData.email,
                is_permanent: true,
                bvn: userData.bvn,
                tx_ref: userData.tx_ref || `VTU_${Date.now()}`,
                firstname: userData.firstname || userData.firstName,
                lastname: userData.lastname || userData.lastName,
                narration: userData.narration || `${userData.firstname} ${userData.lastname}`
            };
            
            console.log('📤 Flutterwave request:', { 
                ...payload, 
                bvn: payload.bvn ? '***hidden***' : 'NOT PROVIDED'
            });
            
            const response = await axios.post(
                `${this.baseURL}/virtual-account-numbers`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('📥 Flutterwave response status:', response.data.status);
            
            if (response.data.status === 'success' && response.data.data) {
                const data = response.data.data;
                
                return {
                    account_number: data.account_number,
                    account_name: data.account_name || `${userData.firstname} ${userData.lastname}`,
                    bank_name: data.bank_name || 'Wema Bank',
                    flw_ref: data.flw_ref || data.order_ref,
                    order_ref: data.order_ref
                };
            } else {
                throw new Error(response.data.message || 'Account creation failed');
            }
        } catch (error) {
            console.error('❌ Flutterwave API error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || error.message || 'Failed to create virtual account');
        }
    }

    /**
     * Process M-Pesa/Airtel Money payout (REAL WITHDRAWAL)
     */
    async processKenyaPayout(withdrawalData) {
        try {
            const { amount, phone, method, userId, currency } = withdrawalData;
            
            console.log('💸 Processing Kenya payout:', {
                amount,
                phone,
                method,
                userId
            });

            // Validate phone number format
            if (!phone.startsWith('+254') || phone.length !== 13) {
                throw new Error('Invalid phone number format. Must be +254XXXXXXXXX');
            }

            // Flutterwave M-Pesa/Airtel payout payload
            const payload = {
                account_bank: method === 'AIRTEL' ? 'MPS' : 'MPS', // MPS for M-Pesa
                account_number: phone,
                amount: parseFloat(amount),
                currency: 'KES',
                narration: `FlipCash withdrawal`,
                reference: `WTH_${Date.now()}`,
                callback_url: `${process.env.BACKEND_URL}/api/v1/webhooks/withdrawal-callback`,
                debit_currency: 'KES'
            };

            console.log('📤 Sending payout request to Flutterwave...');

            const response = await axios.post(
                `${this.baseURL}/transfers`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('📥 Flutterwave payout response:', response.data);

            if (response.data.status === 'success') {
                return {
                    success: true,
                    transactionId: response.data.data.id,
                    reference: response.data.data.reference,
                    status: response.data.data.status,
                    message: 'Withdrawal initiated successfully'
                };
            } else {
                throw new Error(response.data.message || 'Payout failed');
            }
        } catch (error) {
            console.error('❌ Kenya payout error:', error.response?.data || error.message);
            
            return {
                success: false,
                error: error.response?.data?.message || error.message,
                shouldRefund: true
            };
        }
    }

    /**
     * Verify payout status
     */
    async verifyPayout(transactionId) {
        try {
            const response = await axios.get(
                `${this.baseURL}/transfers/${transactionId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`
                    }
                }
            );

            return {
                success: response.data.status === 'success',
                status: response.data.data?.status,
                data: response.data.data
            };
        } catch (error) {
            console.error('❌ Payout verification error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verify BVN
     */
    async verifyBVN(bvn, firstName, lastName) {
        try {
            console.log('🔍 Verifying BVN...');
            
            const response = await axios.post(
                `${this.baseURL}/bvn/verifications`,
                {
                    bvn: bvn,
                    first_name: firstName,
                    last_name: lastName
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (response.data.status === 'success') {
                const data = response.data.data;
                
                return {
                    success: true,
                    match: data.first_name?.toLowerCase() === firstName.toLowerCase() && 
                           data.last_name?.toLowerCase() === lastName.toLowerCase(),
                    bvnData: {
                        firstName: data.first_name,
                        lastName: data.last_name,
                        middleName: data.middle_name,
                        dateOfBirth: data.date_of_birth,
                        phoneNumber: data.phone_number,
                        verified: true
                    }
                };
            } else {
                return {
                    success: false,
                    error: response.data.message || 'BVN verification failed'
                };
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
     * Verify transaction
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
            console.error('❌ Transaction verification error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new FlutterwaveService();
