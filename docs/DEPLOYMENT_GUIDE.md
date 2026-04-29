# MiniFaucet Deployment Guide

> **💡 Need Help?** We offer a **professional installation service for just $20**! We'll set up everything for you - Railway, Vercel, MongoDB, Telegram Bot, and FaucetPay integration. Contact us on Telegram: **[@gemifs](https://t.me/gemifs)**

<div align="center">

![MiniFaucet Logo](https://via.placeholder.com/200x80?text=MiniFaucet)

**Complete Deployment & Configuration Guide**

[![Railway](https://img.shields.io/badge/Deploy%20on-Railway-blueviolet?logo=railway)](https://railway.com?referralCode=MNiSD5)
[![Vercel](https://img.shields.io/badge/Deploy%20on-Vercel-black?logo=vercel)](https://vercel.com)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Atlas-green?logo=mongodb)](https://mongodb.com/atlas)

</div>

---

## 📋 Table of Contents

- [Introduction](#-introduction)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Step 1: MongoDB Atlas Setup](#-step-1-mongodb-atlas-setup)
- [Step 2: Railway Backend Deployment](#-step-2-railway-backend-deployment)
- [Step 3: Vercel Frontend Deployment](#-step-3-vercel-frontend-deployment)
- [Step 4: Admin Setup](#-step-4-admin-setup)
- [Step 5: Telegram Bot Setup](#-step-5-telegram-bot-setup)
- [Step 6: FaucetPay Integration](#-step-6-faucetpay-integration)
- [Step 7: Cloudflare Turnstile Setup](#-step-7-cloudflare-turnstile-setup)
- [Environment Variables Reference](#-environment-variables-reference)
- [Post-Deployment Checklist](#-post-deployment-checklist)
- [Troubleshooting](#-troubleshooting)
- [FAQ](#-faq)
- [Support](#-support)

---

## 🎯 Introduction

MiniFaucet is a feature-rich cryptocurrency faucet application built for Telegram Mini Apps. This guide will walk you through deploying your faucet on:

| Service           | Purpose          | Free Tier                           |
| ----------------- | ---------------- | ----------------------------------- |
| **MongoDB Atlas** | Database         | 512MB Free Forever                  |
| **Railway**       | Backend API      | $5/month free + $20 referral credit |
| **Vercel**        | Frontend Hosting | Generous free tier                  |

**Estimated Setup Time**: 30-45 minutes

---

## 🔐 Free Credits

### 🚂 Railway - Get $20 FREE Credit

Use our referral link to get **$20 free credit** on Railway:

<div align="center">

### 👉 [**Click Here to Get $20 Railway Credit**](https://railway.com?referralCode=MNiSD5) 👈

</div>

### 🍃 MongoDB Atlas - Free Credits

Apply these promo codes in MongoDB Atlas billing section:

| Code        | Credit Amount |
| ----------- | ------------- |
| `GETATLAS`  | **$100 FREE** |
| `GOATLAS10` | **$10 FREE**  |

---

## ✅ Prerequisites

Before you begin, ensure you have:

- [ ] **GitHub Account** - [Sign up here](https://github.com/signup)
- [ ] **Railway Account** - [Sign up with referral](https://railway.com?referralCode=MNiSD5)
- [ ] **Vercel Account** - [Sign up here](https://vercel.com/signup)
- [ ] **MongoDB Atlas Account** - [Sign up here](https://mongodb.com/atlas)
- [ ] **Telegram Bot Token** - From [@BotFather](https://t.me/BotFather)
- [ ] **FaucetPay Account** - [Sign up here](https://faucetpay.io/?r=4835992)
- [ ] **Cloudflare Account** - [Sign up here](https://cloudflare.com) (for Turnstile)

---

## ⚡ Quick Start

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT OVERVIEW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. MongoDB Atlas    ──▶   Create Database                    │
│          ↓                                                      │
│   2. Railway          ──▶   Deploy Backend                     │
│          ↓                                                      │
│   3. Vercel           ──▶   Deploy Frontend                    │
│          ↓                                                      │
│   4. Configure        ──▶   Set Environment Variables          │
│          ↓                                                      │
│   5. Launch           ──▶   Create Admin & Go Live!            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🍃 Step 1: MongoDB Atlas Setup

MongoDB Atlas provides a free cloud database. Follow these steps:

### 1.1 Create Account & Cluster

1. Go to [MongoDB Atlas](https://mongodb.com/atlas)
2. Click **"Try Free"** and create an account
3. Choose **"Build a Database"**
4. Select **FREE - Shared** tier (M0)
5. Choose your preferred cloud provider and region:
   - **Recommended**: AWS, closest to your users
6. Name your cluster (e.g., `minifaucet-cluster`)
7. Click **"Create Cluster"** (takes 1-3 minutes)

### 1.2 Apply Free Credits

1. Go to **Organization Settings** → **Billing**
2. Click **"Apply Credit"**
3. Enter code: `GETATLAS` for **$100 FREE**
4. Or enter: `GOATLAS10` for **$10 FREE**

### 1.3 Create Database User

1. In left sidebar, click **"Database Access"**
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Enter username: `minifaucet`
5. Click **"Autogenerate Secure Password"**
6. **⚠️ SAVE THIS PASSWORD** - You'll need it later!
7. Set privileges to: **"Read and write to any database"**
8. Click **"Add User"**

### 1.4 Configure Network Access

1. In left sidebar, click **"Network Access"**
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - This is required for Railway/Vercel to connect
4. Click **"Confirm"**

### 1.5 Get Connection String

1. Go to **"Database"** in left sidebar
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Select Driver: **Node.js**, Version: **5.5 or later**
5. Copy the connection string:

```
mongodb+srv://minifaucet:<password>@minifaucet-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

6. **Replace `<password>` with your actual password**
7. Add database name before `?`:

```
mongodb+srv://minifaucet:YOUR_PASSWORD@minifaucet-cluster.xxxxx.mongodb.net/minifaucet?retryWrites=true&w=majority
```

**⚠️ Save this connection string - you'll need it for Railway!**

---

## 🚂 Step 2: Railway Backend Deployment

Railway provides easy backend hosting with automatic deployments.

### 2.1 Sign Up & Get Free Credit

1. Go to [Railway with Referral](https://railway.com?referralCode=MNiSD5) to get **$20 free credit**
2. Sign up with GitHub (recommended)
3. Verify your account

### 2.2 Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Connect your GitHub account if prompted
4. Select your MiniFaucet repository
5. Railway will auto-detect it's a Node.js project

### 2.3 Configure Backend Service

1. Click on the deployed service
2. Go to **"Settings"** tab
3. Set the following:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 2.4 Set Environment Variables

1. Go to **"Variables"** tab
2. Click **"Raw Editor"** for bulk input
3. Paste the following (replace values with your own):

```env
# Database
MONGODB_URI=mongodb+srv://minifaucet:YOUR_PASSWORD@cluster.mongodb.net/minifaucet?retryWrites=true&w=majority

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
SESSION_SECRET=another-super-secret-session-key-min-32-chars

# Server
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app

# Telegram Bot
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_BOT_USERNAME=YourBotUsername

# FaucetPay
FAUCETPAY_API_KEY=your-faucetpay-api-key

# Admin (Initial Setup)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-secure-admin-password
```

> **Note**: Turnstile keys are configured later in Admin Dashboard → Settings → Cloudflare Turnstile section.

4. Click **"Update Variables"**

### 2.5 Get Your Railway Domain

1. Go to **"Settings"** tab
2. Under **"Networking"** section
3. Click **"Generate Domain"**
4. Copy your domain: `your-app.up.railway.app`

**Save this URL - you'll need it for:**

- Frontend API configuration
- Telegram Bot webhook

### 2.6 Verify Deployment

1. Check **"Deployments"** tab for build progress
2. Once deployed, visit: `https://your-app.up.railway.app/api/health`
3. You should see: `{"status":"ok","timestamp":"..."}`

---

## ▲ Step 3: Vercel Frontend Deployment

Vercel provides fast, global frontend hosting with automatic SSL.

### 3.1 Sign Up

1. Go to [Vercel](https://vercel.com)
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"**

### 3.2 Import Project

1. Click **"Add New..."** → **"Project"**
2. Select your MiniFaucet repository
3. Configure the project:

| Setting              | Value            |
| -------------------- | ---------------- |
| **Framework Preset** | Create React App |
| **Root Directory**   | `frontend`       |
| **Build Command**    | `npm run build`  |
| **Output Directory** | `build`          |

### 3.3 Set Environment Variables

Click **"Environment Variables"** and add:

```env
REACT_APP_API_URL=https://your-app.up.railway.app
REACT_APP_TELEGRAM_BOT_USERNAME=YourBotUsername
```

> **Note**: Turnstile Site Key is configured in Admin Dashboard, not here.

### 3.4 Deploy

1. Click **"Deploy"**
2. Wait for build to complete (2-3 minutes)
3. Your frontend is now live at: `https://your-app.vercel.app`

### 3.5 Custom Domain (Optional)

1. Go to **Project Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Vercel will automatically provision SSL

---

## � Step 4: Admin Setup

### 5.1 Initialize Admin Account

**Option A: Via Environment Variables (Recommended for first setup)**

Set these in Railway:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=YourSecurePassword123!
```

The admin account is created automatically on first startup.

**Option B: Via API (After deployment)**

```bash
curl -X POST https://your-app.up.railway.app/api/admin/init \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "YourSecurePassword123!"
  }'
```

### 5.2 Access Admin Panel

1. Go to: `https://your-frontend.vercel.app/admin`
2. Login with your admin credentials
3. You'll see the Admin Dashboard

### 5.3 Configure Faucet Settings

In Admin Panel → Settings, configure:

| Setting             | Recommended Value |
| ------------------- | ----------------- |
| Claim Amount        | 0.00001000 BTC    |
| Claim Interval      | 300 (5 minutes)   |
| Minimum Withdrawal  | 0.00010000 BTC    |
| Referral Commission | 10%               |
| Daily Claim Limit   | 100               |

---

## 🤖 Step 5: Telegram Bot Setup

### 6.1 Create Bot with BotFather

1. Open Telegram, search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Enter a name for your bot: `My Faucet Bot`
4. Enter a username: `myfaucet_bot` (must end with `bot`)
5. **Save the API token** provided

### 6.2 Configure Bot Token

In Railway environment variables:

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_BOT_USERNAME=myfaucet_bot
```

### 6.3 Set Up Mini App

1. In BotFather, send `/mybots`
2. Select your bot
3. Click **"Bot Settings"** → **"Menu Button"**
4. Click **"Configure menu button"**
5. Enter your frontend URL: `https://your-app.vercel.app`
6. Enter button text: `🎰 Open Faucet`

### 6.4 Enable Mini App

1. In BotFather, send `/mybots`
2. Select your bot
3. Click **"Bot Settings"** → **"Web Apps"**
4. Click **"Enable Web Apps"**

### 6.5 Set Webhook (Optional but Recommended)

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-app.up.railway.app/api/telegram/webhook"
```

---

## 💰 Step 6: FaucetPay Integration

FaucetPay handles cryptocurrency withdrawals.

### 7.1 Create FaucetPay Account

1. Go to [FaucetPay](https://faucetpay.io/)
2. Sign up for an account
3. Verify your email

### 7.2 Get API Key

1. Go to **Owner API** section
2. Click **"Create New API Key"**
3. Enter a name: `MiniFaucet`
4. Select permissions:
   - ✅ Check Balance
   - ✅ Send Payments
5. Copy the API key

### 7.3 Configure API Key

In Railway environment variables:

```env
FAUCETPAY_API_KEY=your-faucetpay-api-key-here
```

### 7.4 Fund Your FaucetPay Balance

1. In FaucetPay, go to **Deposit**
2. Deposit cryptocurrency to your account
3. These funds will be used for user withdrawals

### 7.5 Verify Integration

In Admin Panel → Settings → FaucetPay:

- Click **"Test Connection"**
- Should show: ✅ Connected, Balance: 0.001 BTC

---

## 🛡️ Step 7: Cloudflare Turnstile Setup

Turnstile provides bot protection without CAPTCHAs.

### 7.1 Create Cloudflare Account

1. Go to [Cloudflare](https://cloudflare.com)
2. Sign up for a free account

### 7.2 Create Turnstile Widget

1. Go to **Turnstile** in sidebar
2. Click **"Add Widget"**
3. Enter site name: `MiniFaucet`
4. Add your domains:
   - `your-app.vercel.app`
   - `localhost` (for testing)
5. Choose widget mode: **Managed**
6. Click **"Create"**

### 7.3 Get Keys

Copy both keys:

- **Site Key**: `0x4AAAAAAxxxxxxxxxx` (public, for frontend)
- **Secret Key**: `0x4AAAAAAxxxxxxxxxx` (private, for backend)

### 7.4 Configure Keys in Admin Dashboard

1. Open your MiniFaucet Admin Dashboard
2. Go to **Settings**
3. Scroll to **Cloudflare Turnstile (Bot Protection)** section
4. Enter your keys:
   - **Site Key**: Paste your Site Key
   - **Secret Key**: Paste your Secret Key
5. Click **Save Settings**

> ⚠️ **Important**: Both keys are configured in the Admin Dashboard, NOT in environment variables.

---

## 📝 Environment Variables Reference

### Backend (Railway) - Complete List

```env
# ═══════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/minifaucet?retryWrites=true&w=majority

# ═══════════════════════════════════════════════════════════
# SECURITY
# ═══════════════════════════════════════════════════════════
JWT_SECRET=your-32-char-minimum-secret-key-here-make-it-long
SESSION_SECRET=another-32-char-minimum-secret-key-here
NODE_ENV=production

# ═══════════════════════════════════════════════════════════
# SERVER
# ═══════════════════════════════════════════════════════════
PORT=3000
FRONTEND_URL=https://your-app.vercel.app

# ═══════════════════════════════════════════════════════════
# TELEGRAM
# ═══════════════════════════════════════════════════════════
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_BOT_USERNAME=your_bot_username

# ═══════════════════════════════════════════════════════════
# FAUCETPAY
# ═══════════════════════════════════════════════════════════
FAUCETPAY_API_KEY=your-faucetpay-api-key

# ═══════════════════════════════════════════════════════════
# ADMIN (First-time setup only)
# ═══════════════════════════════════════════════════════════
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=YourSecurePassword123!
```

### Frontend (Vercel) - Complete List

```env
REACT_APP_API_URL=https://your-app.up.railway.app
REACT_APP_TELEGRAM_BOT_USERNAME=your_bot_username
```

> **Note**: Turnstile keys are configured in Admin Dashboard → Settings → Cloudflare Turnstile section, not in environment variables.

---

## ✅ Post-Deployment Checklist

Use this checklist to verify everything is working:

### Database

- [ ] MongoDB Atlas cluster is running
- [ ] Database user created with correct permissions
- [ ] Network access allows 0.0.0.0/0
- [ ] Connection string tested

### Backend

- [ ] Railway deployment successful
- [ ] Environment variables set
- [ ] Health check passes: `/api/health`
- [ ] Admin account created

### Frontend

- [ ] Vercel deployment successful
- [ ] Environment variables set
- [ ] Frontend loads without errors
- [ ] API connection working

### Integrations

- [ ] Telegram bot responds to /start
- [ ] Mini App opens from bot
- [ ] FaucetPay connection verified
- [ ] Turnstile configured in Admin Dashboard

### Security

- [ ] Admin password is strong
- [ ] JWT secret is 32+ characters
- [ ] HTTPS enabled on all endpoints
- [ ] No sensitive data in frontend code

---

## 🔧 Troubleshooting

### Common Issues & Solutions

<details>
<summary><strong>❌ MongoDB Connection Failed</strong></summary>

**Symptoms:**

```
MongoServerError: bad auth : authentication failed
```

**Solution:**

1. Verify password is correct in connection string
2. Check if special characters in password are URL-encoded
3. Ensure database user has correct permissions
4. Verify IP whitelist includes 0.0.0.0/0

</details>

<details>
<summary><strong>❌ CORS Errors in Browser</strong></summary>

**Symptoms:**

```
Access to fetch at 'https://api...' has been blocked by CORS policy
```

**Solution:**

1. Ensure `FRONTEND_URL` in Railway matches your Vercel domain exactly
2. Include the full URL: `https://your-app.vercel.app`
3. Redeploy backend after changing

</details>

<details>
<summary><strong>❌ Telegram Mini App Not Loading</strong></summary>

**Symptoms:**
Mini App shows blank or loading forever

**Solution:**

1. Check browser console for errors
2. Verify `REACT_APP_API_URL` is correct
3. Ensure backend is running and accessible
4. Check if Telegram WebApp script is loading

</details>

<details>
<summary><strong>❌ FaucetPay Withdrawals Failing</strong></summary>

**Symptoms:**

```
FaucetPay Error: Invalid API Key
```

**Solution:**

1. Regenerate API key in FaucetPay
2. Ensure API key has correct permissions
3. Check if FaucetPay account is verified
4. Verify sufficient balance

</details>

<details>
<summary><strong>❌ Turnstile Verification Failed</strong></summary>

**Symptoms:**

```
Turnstile verification failed
```

**Solution:**

1. Verify Site Key matches Secret Key
2. Check if domain is whitelisted in Cloudflare
3. Add `localhost` for local testing
4. Ensure keys are not swapped between frontend/backend

</details>

### Viewing Logs

**Railway Logs:**

1. Go to your project in Railway
2. Click on the service
3. Go to **"Deployments"** tab
4. Click **"View Logs"**

**Vercel Logs:**

1. Go to your project in Vercel
2. Click **"Deployments"**
3. Select a deployment
4. Click **"Functions"** or **"Runtime Logs"**

---

## ❓ FAQ

<details>
<summary><strong>Q: How much does it cost to run MiniFaucet?</strong></summary>

**A:** With the free credits:

- **Railway**: $20 free credit (lasts 2-4 months for small traffic)
- **MongoDB Atlas**: Free tier (512MB) is usually enough
- **Vercel**: Free tier handles most traffic
- **Total**: Can run free for months, then ~$5-10/month

</details>

<details>
<summary><strong>Q: Can I use a custom domain?</strong></summary>

**A:** Yes!

- **Vercel**: Add domain in Project Settings → Domains
- **Railway**: Add domain in Service Settings → Networking → Custom Domain

</details>

<details>
<summary><strong>Q: How do I update to a new version?</strong></summary>

**A:**

1. Pull the latest code to your repository
2. Railway and Vercel will auto-deploy on push
3. Check logs for any migration messages
4. Verify everything works after update

</details>

<details>
<summary><strong>Q: How do I backup my database?</strong></summary>

**A:**

1. In MongoDB Atlas, go to your cluster
2. Click **"..."** → **"Backup"**
3. Enable backup or take a snapshot
4. Download backup if needed

</details>

<details>
<summary><strong>Q: What cryptocurrencies are supported?</strong></summary>

**A:** All cryptocurrencies supported by FaucetPay:

- Bitcoin (BTC)
- Ethereum (ETH)
- Litecoin (LTC)
- Dogecoin (DOGE)
- Bitcoin Cash (BCH)
- Dash (DASH)
- Digibyte (DGB)
- Tron (TRX)
- Feyorra (FEY)
- Solana (SOL)
- And more...

</details>

---

## 💬 Support

If you encounter issues not covered in this guide:

### 🌟 Join Our Community

> **Mini App Owners Group** — Connect with other MiniFaucet owners, get tips, share experiences, and receive updates!
>
> 👉 **[Join Telegram Group](https://t.me/+9fJEFXRmdSMwN2Zl)**

### Before Contacting Support

1. ✅ Check this troubleshooting guide
2. ✅ Review Railway/Vercel logs for errors
3. ✅ Verify all environment variables are set
4. ✅ Test with a fresh browser/incognito mode

### Contact Options

- **👥 Community**: [Mini App Owners Group](https://t.me/+9fJEFXRmdSMwN2Zl)
- **📧 Email**: support@minifaucet.io
- **💬 Telegram**: [@gemifs](https://t.me/gemifs)

### When Reporting Issues

Please include:

1. Error message (full text)
2. Steps to reproduce
3. Railway/Vercel logs (relevant section)
4. Browser console errors (if frontend issue)
5. Your deployment platform details

---

## 📜 License

This software is licensed under a commercial license. Unauthorized distribution, modification of license validation code, or use without a valid license is prohibited.

---

<div align="center">

**Thank you for choosing MiniFaucet! 🎉**

Made with ❤️ for the crypto community

[🚂 Get Railway Credit](https://railway.com?referralCode=MNiSD5) • [📖 Full Documentation](#) • [💬 Support](#)

</div>
