<?php
/**
 * Organic Safelink - Entry Point
 *
 * This file processes the incoming link, stores it in a cookie,
 * and redirects the user to the WordPress page1 (Step 1).
 *
 * Usage: safe.php?link=YOUR_ENCODED_URL
 *
 * Place this file in your WordPress theme directory or root.
 * Update SAFELINK_PAGE1_URL below to match your WordPress page1 slug.
 */

include 'tpcode.php';

// Configure your WordPress page1 URL here
define('SAFELINK_PAGE1_URL', '/page1/');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecting, please wait...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .redirect-card {
      background: #fff;
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
      max-width: 420px;
      width: 90%;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #e9ecef;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h2 {
      color: #1a1a2e;
      font-size: 20px;
      margin-bottom: 8px;
    }
    p {
      color: #6c757d;
      font-size: 14px;
    }
    .note {
      margin-top: 16px;
      font-size: 12px;
      color: #adb5bd;
    }
  </style>
</head>
<body>
  <div class="redirect-card">
    <div class="spinner"></div>
    <h2>Preparing Your Link</h2>
    <p>You will be redirected automatically...</p>
    <p class="note">If not redirected, <a href="<?php echo SAFELINK_PAGE1_URL; ?>">click here</a>.</p>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.location.href = "<?php echo SAFELINK_PAGE1_URL; ?>";
      }, 1500);
    };
  </script>
</body>
</html>
