// src/middleware/kycValidation.js
const { body } = require('express-validator');

const validateKYC = [
    body('fullname')
        .notEmpty().withMessage('Full name is required')
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    
    body('dob')
        .notEmpty().withMessage('Date of birth is required')
        .isISO8601().withMessage('Valid date (YYYY-MM-DD) required')
        .custom((value) => {
            const dob = new Date(value);
            const today = new Date();
            const age = today.getFullYear() - dob.getFullYear();
            if (age < 18) throw new Error('Must be at least 18 years old');
            return true;
        }),
    
    body('address')
        .notEmpty().withMessage('Address is required')
        .trim()
        .isLength({ min: 5, max: 200 }).withMessage('Address must be 5-200 characters'),
    
    body('idType')
        .notEmpty().withMessage('ID type is required')
        .isIn(['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'VOTERS_CARD'])
        .withMessage('Invalid ID type'),
    
    body('idNumber')
        .notEmpty().withMessage('ID number is required')
        .trim()
        .isLength({ min: 5, max: 50 }).withMessage('ID must be 5-50 characters'),
    
    body('bvn')
        .notEmpty().withMessage('BVN is required') // COMPULSORY as you requested
        .isLength({ min: 11, max: 11 }).withMessage('BVN must be exactly 11 digits')
        .isNumeric().withMessage('BVN must contain only numbers'),
    
    body('country')
        .notEmpty().withMessage('Country is required')
        .isIn(['NG', 'KE', 'GH', 'TZ', 'UG']).withMessage('Invalid country'),
    
    body('occupation')
        .notEmpty().withMessage('Occupation is required')
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Occupation must be 2-100 characters'),
    
    body('sourceFunds')
        .notEmpty().withMessage('Source of funds is required')
        .isIn(['SALARY', 'BUSINESS', 'INVESTMENT', 'FAMILY', 'OTHER'])
        .withMessage('Invalid source of funds')
];

module.exports = { validateKYC };
