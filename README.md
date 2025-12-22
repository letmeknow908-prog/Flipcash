# FlipCash Backend API

> Currency exchange and crypto swap platform for Nigerians in Kenya

## 🚀 Features

- ✅ User registration & authentication (JWT)
- ✅ Virtual Naira account generation per user
- ✅ Multi-currency wallet support (NGN, KSH, BTC, ETH, USDT)
- 🚧 Currency swaps with real-time exchange rates
- 🚧 M-Pesa & Airtel Money withdrawals
- 🚧 Cryptocurrency deposits and swaps
- 🚧 Transaction history & analytics
- ✅ SMS & Email notifications
- ✅ Rate limiting & security middleware

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **PostgreSQL** (v14 or higher)
- **Redis** (v6 or higher)
- **npm** or **yarn**

## 🛠️ Installation

### 1. Clone the repository

```bash
cd flipcash-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=flipcash_db
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Secrets
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_REFRESH_SECRET=your_refresh_secret_change_this

# M-Pesa (Get from Safaricom Daraja)
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
MPESA_SHORTCODE=your_paybill
MPESA_PASSKEY=your_passkey

# Paystack (Get from paystack.com)
PAYSTACK_SECRET_KEY=sk_test_xxx

# Twilio (Get from twilio.com)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+254xxx

# SendGrid (Get from sendgrid.com)
SENDGRID_API_KEY=your_api_key
```

### 4. Set up PostgreSQL database

```bash
# Create database
createdb flipcash_db

# Or using psql
psql -U postgres
CREATE DATABASE flipcash_db;
\q
```

### 5. Run database migrations

```bash
npm run migrate
```

### 6. Start Redis

```bash
# MacOS/Linux
redis-server

# Windows (with WSL or Docker)
docker run -d -p 6379:6379 redis
```

## 🚀 Running the Application

### Development mode (with auto-reload)

```bash
npm run dev
```

### Production mode

```bash
npm start
```

The API will be available at: `http://localhost:5000`

## 📚 API Documentation

### Base URL

```
http://localhost:5000/api/v1
```

### Authentication Endpoints

#### 1. Register User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "phone": "0712345678",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Registration successful. Please verify your phone number.",
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "phone": "0712345678"
  }
}
```

#### 2. Verify OTP

```http
POST /api/v1/auth/verify-otp
Content-Type: application/json

{
  "userId": "uuid",
  "otp": "123456"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Phone number verified successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "virtualAccount": "9901234567"
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token"
    }
  }
}
```

#### 3. Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

#### 4. Refresh Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "jwt_refresh_token"
}
```

### User Endpoints (Protected)

All user endpoints require authentication header:

```
Authorization: Bearer {accessToken}
```

#### Get User Profile

```http
GET /api/v1/users/me
```

#### Get Virtual Account

```http
GET /api/v1/users/virtual-account
```

### Wallet Endpoints (Protected)

#### Get All Wallets

```http
GET /api/v1/wallets
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "wallets": [
      {
        "currency": "NGN",
        "balance": "50000.00"
      },
      {
        "currency": "KSH",
        "balance": "15000.00"
      }
    ]
  }
}
```

### Transaction Endpoints (Protected)

#### Currency Swap

```http
POST /api/v1/transactions/swap
Content-Type: application/json

{
  "fromCurrency": "NGN",
  "toCurrency": "KSH",
  "amount": 10000
}
```

#### Withdraw to M-Pesa

```http
POST /api/v1/transactions/withdraw
Content-Type: application/json

{
  "currency": "KSH",
  "amount": 5000,
  "phoneNumber": "0712345678",
  "provider": "mpesa"
}
```

### Exchange Rate Endpoints (Protected)

#### Get All Rates

```http
GET /api/v1/rates
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "rates": [
      {
        "from": "NGN",
        "to": "KSH",
        "rate": 0.29,
        "lastUpdated": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

## 🔐 Security Features

- **JWT Authentication**: Access tokens (15min) + Refresh tokens (7 days)
- **Password Hashing**: bcrypt with salt rounds = 12
- **Rate Limiting**: 5 requests per 15 minutes for auth endpoints
- **Helmet.js**: Security headers
- **CORS**: Configurable origins
- **Input Validation**: express-validator
- **SQL Injection Protection**: Parameterized queries

## 🏗️ Project Structure

```
flipcash-backend/
├── src/
│   ├── config/          # Database & Redis configuration
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Custom middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Helper functions
│   └── server.js        # Entry point
├── tests/               # Test files
├── logs/                # Application logs
├── .env.example         # Environment template
├── package.json
└── README.md
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

## 📊 Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `email` (Unique)
- `phone` (Unique)
- `password_hash`
- `first_name`
- `last_name`
- `kyc_status` (pending/verified/rejected)
- `virtual_naira_account` (Unique)
- `is_active`
- `created_at`, `updated_at`

### Wallets Table
- `id` (UUID, Primary Key)
- `user_id` (Foreign Key → users)
- `currency` (NGN/KSH/BTC/ETH/USDT)
- `balance`
- `created_at`, `updated_at`

### Transactions Table
- `id` (UUID, Primary Key)
- `user_id` (Foreign Key → users)
- `type` (deposit/withdrawal/swap/transfer)
- `from_currency`, `to_currency`
- `from_amount`, `to_amount`
- `exchange_rate`, `fee`
- `status` (pending/processing/completed/failed)
- `reference` (Unique)
- `created_at`, `updated_at`

## 🔄 Third-Party Integrations

### Required Services

1. **Paystack** (Virtual Accounts)
   - Sign up: https://paystack.com
   - Get API keys from Dashboard
   - Set `PAYSTACK_SECRET_KEY` in `.env`

2. **M-Pesa Daraja API** (Payments)
   - Register: https://developer.safaricom.co.ke
   - Create app, get credentials
   - Set M-Pesa env variables

3. **Twilio** (SMS)
   - Sign up: https://twilio.com
   - Get Account SID & Auth Token
   - Buy phone number

4. **SendGrid** (Email)
   - Sign up: https://sendgrid.com
   - Generate API key

## 🚧 Development Roadmap

### Phase 1: MVP (Weeks 1-4) ✅
- [x] User authentication system
- [x] Virtual account generation
- [x] Wallet management
- [ ] NGN to KSH swap
- [ ] M-Pesa withdrawal

### Phase 2: Enhanced (Weeks 5-8)
- [ ] Cryptocurrency support
- [ ] Airtel Money integration
- [ ] Transaction analytics
- [ ] KYC verification system

### Phase 3: Scale (Weeks 9-12)
- [ ] Referral program
- [ ] Admin dashboard
- [ ] Performance optimization
- [ ] Advanced security features

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready

# Check connection
psql -h localhost -U postgres -d flipcash_db
```

### Redis Connection Issues

```bash
# Check Redis is running
redis-cli ping
# Should return: PONG
```

### Migration Errors

```bash
# Drop database and recreate
dropdb flipcash_db
createdb flipcash_db
npm run migrate
```

## 📝 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | Yes |
| `PORT` | Server port | Yes |
| `DB_HOST` | PostgreSQL host | Yes |
| `DB_PORT` | PostgreSQL port | Yes |
| `DB_NAME` | Database name | Yes |
| `DB_USER` | Database user | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `REDIS_HOST` | Redis host | Yes |
| `JWT_SECRET` | JWT secret key | Yes |
| `JWT_REFRESH_SECRET` | JWT refresh secret | Yes |
| `PAYSTACK_SECRET_KEY` | Paystack API key | Yes |
| `MPESA_CONSUMER_KEY` | M-Pesa consumer key | Optional |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | Optional |
| `SENDGRID_API_KEY` | SendGrid API key | Optional |

## 📞 Support

For issues or questions:
- Email: support@flipcash.app
- GitHub Issues: [Create an issue]

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ for the Nigerian-Kenyan community**
