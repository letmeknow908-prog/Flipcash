const { body } = require('express-validator');

exports.validateKYC = [
    body('fullname').notEmpty().trim().withMessage('Full name is required'),
    body('dob').isISO8601().toDate().withMessage('Valid date of birth is required'),
    body('address').notEmpty().trim().withMessage('Address is required'),
    body('idType').isIn(['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'VOTERS_CARD']).withMessage('Invalid ID type'),
    body('idNumber').notEmpty().withMessage('ID number is required'),
    body('bvn').isLength({ min: 11, max: 11 }).withMessage('BVN must be 11 digits').optional({ checkFalsy: false }), // Made optional for demo, but you can make it required
    body('country').notEmpty().withMessage('Country is required'),
    body('occupation').notEmpty().trim().withMessage('Occupation is required'),
    body('sourceFunds').notEmpty().withMessage('Source of funds is required'),
];
