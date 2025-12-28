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
    console.log('🔍 [FLUTTERWAVE DEBUG] ========== START ==========');
    
    try {
        const { amount, phone, beneficiaryName, method, userId, currency } = withdrawalData;
        
        console.log('📋 [FLUTTERWAVE DEBUG] Input data:', JSON.stringify(withdrawalData, null, 2));

        // Validate inputs
        if (!phone.startsWith('+254') || phone.length !== 13) {
            console.log('❌ [FLUTTERWAVE DEBUG] Invalid phone format');
            throw new Error('Invalid phone number format. Must be +254XXXXXXXXX');
        }

        if (!beneficiaryName || beneficiaryName.length < 3) {
            console.log('❌ [FLUTTERWAVE DEBUG] Invalid beneficiary name');
            throw new Error('Beneficiary name is required');
        }

        const payload = {
            account_bank: 'MPS',
            account_number: phone,
            amount: parseFloat(amount),
            currency: 'KES',
            beneficiary_name: beneficiaryName,
            narration: `FlipCash withdrawal`,
            reference: `WTH_${Date.now()}`,
            callback_url: `${process.env.BACKEND_URL}/api/v1/webhooks/withdrawal-callback`,
            debit_currency: 'KES'
        };

        console.log('📤 [FLUTTERWAVE DEBUG] About to send request...');
        console.log('🌐 [FLUTTERWAVE DEBUG] URL:', `${this.baseURL}/transfers`);
        console.log('📦 [FLUTTERWAVE DEBUG] Payload:', JSON.stringify(payload, null, 2));
        console.log('⏱️  [FLUTTERWAVE DEBUG] Starting axios request NOW...');

        let response;
        try {
            response = await axios.post(
                `${this.baseURL}/transfers`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000,
                    validateStatus: () => true
                }
            );
            console.log('✅ [FLUTTERWAVE DEBUG] axios.post() completed without throwing');
        } catch (axiosError) {
            console.log('❌ [FLUTTERWAVE DEBUG] axios.post() THREW AN ERROR');
            console.log('❌ Error type:', axiosError.constructor.name);
            console.log('❌ Error message:', axiosError.message);
            console.log('❌ Error code:', axiosError.code);
            throw axiosError;
        }

        console.log('📥 [FLUTTERWAVE DEBUG] Response object exists:', !!response);
        console.log('📊 [FLUTTERWAVE DEBUG] HTTP Status:', response?.status);
        
        try {
            console.log('📦 [FLUTTERWAVE DEBUG] Response data:', JSON.stringify(response.data, null, 2));
        } catch (stringifyError) {
            console.log('❌ [FLUTTERWAVE DEBUG] Could not stringify response.data');
            console.log('❌ Stringify error:', stringifyError.message);
            console.log('📦 [FLUTTERWAVE DEBUG] Response data (raw):', response.data);
        }

        if (response.status >= 400) {
            console.log('❌ [FLUTTERWAVE DEBUG] HTTP error status detected:', response.status);
            const errorMsg = response.data?.message || `HTTP ${response.status}`;
            console.log('❌ [FLUTTERWAVE DEBUG] Throwing error:', errorMsg);
            throw new Error(errorMsg);
        }

        if (response.data.status === 'success') {
            console.log('✅ [FLUTTERWAVE DEBUG] SUCCESS response detected');
            const result = {
                success: true,
                transactionId: response.data.data?.id,
                reference: response.data.data?.reference,
                status: response.data.data?.status,
                message: 'Withdrawal initiated successfully'
            };
            console.log('✅ [FLUTTERWAVE DEBUG] Returning:', JSON.stringify(result, null, 2));
            return result;
        } else {
            console.log('❌ [FLUTTERWAVE DEBUG] Non-success status:', response.data.status);
            console.log('❌ [FLUTTERWAVE DEBUG] Error message:', response.data.message);
            throw new Error(response.data.message || 'Payout failed');
        }
        
    } catch (error) {
        console.error('❌ [FLUTTERWAVE DEBUG] ========== EXCEPTION ==========');
        console.error('❌ Error name:', error?.name);
        console.error('❌ Error constructor:', error?.constructor?.name);
        console.error('❌ Error message:', error?.message);
        console.error('❌ Error code:', error?.code);
        console.error('❌ Error stack:', error?.stack?.substring(0, 500));
        
        if (error?.code === 'ECONNABORTED') {
            console.error('❌ TIMEOUT - Flutterwave did not respond within 30 seconds');
        }
        
        if (error?.response) {
            console.error('❌ Has error.response - HTTP error occurred');
            console.error('❌ Response status:', error.response.status);
            try {
                console.error('❌ Response data:', JSON.stringify(error.response.data, null, 2));
            } catch (e) {
                console.error('❌ Response data (could not stringify):', error.response.data);
            }
        } else if (error?.request) {
            console.error('❌ Has error.request - Request sent but no response');
            console.error('❌ Request URL:', error?.config?.url);
            console.error('❌ Request method:', error?.config?.method);
        } else {
            console.error('❌ No error.response or error.request - exception before request');
        }
        
        const returnValue = {
            success: false,
            error: error?.response?.data?.message || error?.message || 'Unknown error',
            errorDetails: {
                errorType: error?.constructor?.name,
                errorCode: error?.code,
                httpStatus: error?.response?.status,
                message: error?.message
            },
            shouldRefund: true
        };
        
        console.error('❌ [FLUTTERWAVE DEBUG] Returning error object:', JSON.stringify(returnValue, null, 2));
        console.log('🔍 [FLUTTERWAVE DEBUG] ========== END (ERROR) ==========');
        return returnValue;
        
    } finally {
        console.log('🔍 [FLUTTERWAVE DEBUG] ========== FINALLY BLOCK ==========');
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
