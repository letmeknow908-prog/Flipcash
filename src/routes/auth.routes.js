const express = require('express');
const router = express.Router();

const authController = {
  register: async (req, res) => {
    const { email, phone, password, firstName, lastName } = req.body;
    res.json({
      status: 'success',
      message: 'Registration successful',
      data: { userId: Date.now().toString(), email, phone }
    });
  },
  login: async (req, res) => {
    const { email } = req.body;
    res.json({
      status: 'success',
      data: {
        user: { id: Date.now().toString(), email, firstName: 'Steven' },
        tokens: {
          accessToken: 'token_' + Date.now(),
          refreshToken: 'refresh_' + Date.now()
        }
      }
    });
  }
};

router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;
