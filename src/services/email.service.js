const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        // Gmail SMTP configuration
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD
            }
        });
    }

    async sendPasswordResetEmail(email, resetToken, firstName) {
        const resetUrl = `https://flipcash.app/reset-password?token=${resetToken}`;
        
        const mailOptions = {
            from: `"FlipCash" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Reset Your FlipCash Password',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">💰 FlipCash</h1>
                    </div>
                    <div style="padding: 30px; background: #f9fafb;">
                        <h2 style="color: #111827;">Hi ${firstName},</h2>
                        <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">
                            We received a request to reset your password. Click the button below to create a new password:
                        </p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                                Reset Password
                            </a>
                        </div>
                        <p style="color: #6B7280; font-size: 14px;">
                            Or copy this link: <br>
                            <a href="${resetUrl}" style="color: #10B981;">${resetUrl}</a>
                        </p>
                        <p style="color: #EF4444; font-size: 14px; margin-top: 20px;">
                            ⚠️ This link expires in 1 hour.
                        </p>
                        <p style="color: #9CA3AF; font-size: 12px; margin-top: 30px;">
                            If you didn't request this, please ignore this email.
                        </p>
                    </div>
                    <div style="background: #1F2937; padding: 20px; text-align: center;">
                        <p style="color: #D1D5DB; font-size: 12px; margin: 0;">
                            © 2025 FlipCash. All rights reserved.
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log('✅ Password reset email sent to:', email);
            return { success: true };
        } catch (error) {
            console.error('❌ Email send error:', error);
            return { success: false, error: error.message };
        }
    }

    async sendWelcomeEmail(email, firstName) {
        const mailOptions = {
            from: `"FlipCash" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Welcome to FlipCash! 🎉',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0;">💰 Welcome to FlipCash!</h1>
                    </div>
                    <div style="padding: 30px; background: #f9fafb;">
                        <h2 style="color: #111827;">Hi ${firstName}! 👋</h2>
                        <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">
                            Thank you for joining FlipCash! You can now exchange currency between Nigeria and Kenya instantly.
                        </p>
                        <h3 style="color: #111827; margin-top: 30px;">Next Steps:</h3>
                        <ul style="color: #6B7280; font-size: 14px; line-height: 1.8;">
                            <li>✅ Complete KYC verification to unlock all features</li>
                            <li>💳 Generate your virtual account for deposits</li>
                            <li>💱 Start swapping between NGN and KSH</li>
                            <li>💸 Withdraw to M-Pesa or Airtel Money</li>
                        </ul>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://flipcash.app/dashboard" style="background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                                Go to Dashboard
                            </a>
                        </div>
                    </div>
                    <div style="background: #1F2937; padding: 20px; text-align: center;">
                        <p style="color: #D1D5DB; font-size: 12px; margin: 0;">
                            © 2025 FlipCash. All rights reserved.
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log('✅ Welcome email sent to:', email);
        } catch (error) {
            console.error('❌ Welcome email error:', error);
        }
    }
}

module.exports = new EmailService();
