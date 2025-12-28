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
        const { amount, phone, beneficiaryName, method, userId, currency } = withdrawalData;
        
        console.log('🔍 [FLUTTERWAVE DEBUG] Step 1: Function called');
        console.log('📋 Input data:', JSON.stringify(withdrawalData, null, 2));

        // Validate inputs
        if (!phone.startsWith('+254') || phone.length !== 13) {
            console.log('❌ [FLUTTERWAVE DEBUG] Invalid phone format');
            throw new Error('Invalid phone number format. Must be +254XXXXXXXXX');
        }
        console.log('✅ [FLUTTERWAVE DEBUG] Phone validation passed');

        if (!beneficiaryName || beneficiaryName.length < 3) {
            console.log('❌ [FLUTTERWAVE DEBUG] Invalid beneficiary name');
            throw new Error('Beneficiary name is required');
        }
        console.log('✅ [FLUTTERWAVE DEBUG] Beneficiary name validation passed');

        // Flutterwave M-Pesa/Airtel payout payload
        const payload = {
            account_bank: method === 'AIRTEL' ? 'MPS' : 'MPS',
            account_number: phone,
            amount: parseFloat(amount),
            currency: 'KES',
            beneficiary_name: beneficiaryName,
            narration: `FlipCash withdrawal`,
            reference: `WTH_${Date.now()}`,
            callback_url: `${process.env.BACKEND_URL}/api/v1/webhooks/withdrawal-callback`,
            debit_currency: 'KES'
        };

        console.log('📤 [FLUTTERWAVE DEBUG] Sending request to Flutterwave...');
        console.log('🔑 API Key (first 20 chars):', this.secretKey.substring(0, 20) + '...');
        console.log('🌐 URL:', `${this.baseURL}/transfers`);
        console.log('📦 Payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(
            `${this.baseURL}/transfers`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${this.secretKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000, // 30 second timeout
                validateStatus: function (status) {
                    return true; // Don't throw on any status code
                }
            }
        );

        console.log('📥 [FLUTTERWAVE DEBUG] Raw response received');
        console.log('📊 HTTP Status:', response.status);
        console.log('📦 Response body:', JSON.stringify(response.data, null, 2));
        console.log('🔍 Response status field:', response.data?.status);
        console.log('🔍 Response message field:', response.data?.message);

        // Handle non-2xx status codes
        if (response.status >= 400) {
            console.log('❌ [FLUTTERWAVE DEBUG] HTTP error status detected');
            throw new Error(response.data?.message || `HTTP ${response.status}: ${JSON.stringify(response.data)}`);
        }

        if (response.data.status === 'success') {
            console.log('✅ [FLUTTERWAVE DEBUG] Payout successful');
            return {
                success: true,
                transactionId: response.data.data.id,
                reference: response.data.data.reference,
                status: response.data.data.status,
                message: 'Withdrawal initiated successfully'
            };
        } else {
            console.log('❌ [FLUTTERWAVE DEBUG] Payout failed - non-success status');
            console.log('❌ Exact error message:', response.data.message);
            throw new Error(response.data.message || 'Payout failed');
        }
    } catch (error) {
        console.error('❌ [FLUTTERWAVE DEBUG] EXCEPTION in processKenyaPayout');
        console.error('❌ Error type:', error.constructor.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error code:', error.code);
        
        if (error.code === 'ECONNABORTED') {
            console.error('❌ Request TIMEOUT - Flutterwave took too long to respond');
        }
        
        if (error.response) {
            console.error('❌ HTTP Status:', error.response.status);
            console.error('❌ Response data:', JSON.stringify(error.response.data, null, 2));
            console.error('❌ Response headers:', JSON.stringify(error.response.headers, null, 2));
        } else if (error.request) {
            console.error('❌ No response received from Flutterwave');
            console.error('❌ Request config:', JSON.stringify({
                url: error.config?.url,
                method: error.config?.method,
                headers: error.config?.headers
            }, null, 2));
        }
        
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            errorDetails: {
                errorType: error.constructor.name,
                errorCode: error.code,
                httpStatus: error.response?.status,
                responseData: error.response?.data,
                originalError: error.message,
                timedOut: error.code === 'ECONNABORTED'
            },
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
