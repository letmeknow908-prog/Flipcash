const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Initialize Twilio only if credentials are valid
let twilioClient = null;
if (
  process.env.TWILIO_ACCOUNT_SID && 
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_ACCOUNT_SID.startsWith('AC')
) {
  try {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  } catch (error) {
    console.log('⚠️  Twilio not configured - SMS features disabled');
  }
}

// Initialize email transporter
const emailTransporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY,
  },
});

class NotificationService {
  // Send OTP via SMS
  static async sendOTP(phoneNumber, otp) {
    try {
      // Format phone number to international format
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+254${phoneNumber.slice(-9)}`;
      
      const message = `Your FlipCash verification code is: ${otp}. This code expires in 10 minutes. Do not share this code with anyone.`;
      
      if (process.env.NODE_ENV === 'production' && twilioClient) {
        await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone,
        });
      } else {
        console.log(`📱 SMS (Dev Mode / Twilio Disabled): ${formattedPhone} - ${message}`);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to send OTP:', error);
      // Don't throw error - allow registration to continue
      console.log(`📱 OTP for testing: ${otp}`);
      return false;
    }
  }

  // Send welcome email
  static async sendWelcomeEmail(email, firstName, virtualAccount) {
    try {
      const emailContent = {
        from: {
          name: process.env.FROM_NAME || 'FlipCash',
          email: process.env.FROM_EMAIL || 'noreply@flipcash.app',
        },
        to: email,
        subject: 'Welcome to FlipCash! 🎉',
        html: `
          <h1>Welcome to FlipCash, ${firstName}!</h1>
          <p>Your account has been successfully created.</p>
          <h3>Your Virtual Naira Account:</h3>
          <p style="font-size: 24px; font-weight: bold; color: #4CAF50;">${virtualAccount}</p>
          <p>Use this account number to deposit Naira from any Nigerian bank. Your balance will be updated instantly!</p>
          <h3>What's Next?</h3>
          <ul>
            <li>Complete your KYC verification for higher limits</li>
            <li>Deposit Naira to your virtual account</li>
            <li>Swap to KSH or crypto</li>
            <li>Send money to M-Pesa or Airtel Money</li>
          </ul>
          <p>Need help? Reply to this email or contact our support team.</p>
          <p>Happy swapping!<br>The FlipCash Team</p>
        `,
      };

      if (process.env.NODE_ENV === 'production') {
        await emailTransporter.sendMail(emailContent);
      } else {
        console.log(`📧 Email (Dev Mode): ${email}`);
        console.log(emailContent.html);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't throw - email failure shouldn't break registration
      return false;
    }
  }

  // Send transaction notification
  static async sendTransactionNotification(phone, email, transaction) {
    try {
      const message = `FlipCash: Your ${transaction.type} of ${transaction.amount} ${transaction.currency} was ${transaction.status}. Ref: ${transaction.reference}`;
      
      // Send SMS
      await this.sendSMS(phone, message);
      
      // TODO: Send email notification
      
      return true;
    } catch (error) {
      console.error('Failed to send transaction notification:', error);
      return false;
    }
  }

  // Generic SMS sender
  static async sendSMS(phoneNumber, message) {
    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+254${phoneNumber.slice(-9)}`;
      
      if (process.env.NODE_ENV === 'production' && twilioClient) {
        await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone,
        });
      } else {
        console.log(`📱 SMS (Dev Mode / Twilio Disabled): ${formattedPhone} - ${message}`);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to send SMS:', error);
      return false;
    }
  }
}

module.exports = NotificationService;
