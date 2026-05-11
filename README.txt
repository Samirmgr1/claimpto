=========================================================
      PREMIUM FAUCET SCRIPT - INSTALLATION GUIDE
=========================================================

Thank you for purchasing our Premium Faucet Script! 
This guide will help you install and configure your site in just a few minutes.

---------------------------------------------------------
 1. SYSTEM REQUIREMENTS
---------------------------------------------------------
- PHP 7.4 or higher (PHP 8.1+ recommended)
- MySQL / MariaDB Database
- standard Web Server (Apache / Nginx / LiteSpeed)
- cPanel / DirectAdmin / CyberPanel (or any standard control panel)

---------------------------------------------------------
 2. INSTALLATION STEPS
---------------------------------------------------------
Step 1: Upload the zip file to your hosting (usually in the 'public_html' folder) and extract it.
Step 2: Create a new MySQL Database, Database User, and Password in your hosting control panel.
Step 3: Create 'core/db.php' with your database credentials (see sample in core/ folder).
Step 4: Access admin.php to configure settings. Tables are auto-created on first run.

---------------------------------------------------------
 3. POST-INSTALLATION & CONFIGURATION
---------------------------------------------------------
1. Login to your Admin Panel:
   👉 Go to: https://yourdomain.com/admin.php
   👉 Use the Admin Password you created during installation.

2. Setup Weadev Publisher API (To get Ads):
   - Register/Login at https://weadev.in
   - Get your Publisher API Key, API Token, and Secret Key.
   - Enter them in your Admin Panel -> "Weadev Publisher API" section.

3. Setup Postback URL (Crucial for receiving rewards):
   - In your Weadev publisher dashboard, locate the Postback / Webhook setting.
   - Set your Postback URL to: https://yourdomain.com/postback.php
   - This ensures users get credited when they complete ads.

4. Setup Payment Gateway:
   - In the Admin Panel, choose your preferred withdrawal method (Weadev Native or FaucetPay).
   - If using FaucetPay, make sure to enter your FaucetPay API Key and a Proxycheck.io API Key to prevent VPN/Proxy abuse.

=========================================================
Enjoy your new Faucet Business!
=========================================================