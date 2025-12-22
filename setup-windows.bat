@echo off
echo ========================================
echo FlipCash Backend - Windows Setup
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo Download the LTS version.
    pause
    exit /b 1
)

echo [OK] Node.js is installed
node --version
echo.

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not available!
    pause
    exit /b 1
)

echo [OK] npm is available
npm --version
echo.

REM Copy environment file
echo [STEP 1] Creating .env file...
if not exist .env (
    copy .env.example .env
    echo [OK] .env file created
    echo [ACTION REQUIRED] Please edit .env file with your API keys
) else (
    echo [SKIP] .env file already exists
)
echo.

REM Install dependencies
echo [STEP 2] Installing npm dependencies...
echo This may take a few minutes...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)
echo [OK] Dependencies installed
echo.

REM Create logs directory
echo [STEP 3] Creating logs directory...
if not exist logs mkdir logs
echo [OK] Logs directory created
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo IMPORTANT: Before running the server, you need to:
echo.
echo 1. Install PostgreSQL:
echo    - Download from https://www.postgresql.org/download/windows/
echo    - OR use Docker: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:14
echo.
echo 2. Install Redis:
echo    - Use Docker: docker run -d -p 6379:6379 redis
echo    - OR use WSL and install Redis there
echo.
echo 3. Edit .env file with your database credentials
echo.
echo 4. Create the database:
echo    psql -U postgres -c "CREATE DATABASE flipcash_db;"
echo.
echo 5. Run migrations:
echo    npm run migrate
echo.
echo 6. Start the server:
echo    npm run dev
echo.
echo ========================================
pause
