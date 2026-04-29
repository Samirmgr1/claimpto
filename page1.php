<?php
/**
 * Template Name: Safelink Step 1
 * Description: Organic Safelink - Step 1 of 3. Assign this template to a WordPress page.
 */

// Load WordPress
get_header();

// Check if the safelink cookie exists (set by safe.php → tpcode.php)
$has_link = isset($_COOKIE["tp"]) && !empty($_COOKIE["tp"]);
$link_value = $has_link ? sanitize_text_field($_COOKIE["tp"]) : '';
?>

<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .sl-wrapper {
    max-width: 720px;
    margin: 40px auto;
    padding: 0 20px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }
  .sl-card {
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 2px 20px rgba(0,0,0,0.08);
    padding: 32px;
    margin-bottom: 24px;
  }
  .sl-step-badge {
    display: inline-block;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.5px;
    margin-bottom: 20px;
  }
  .sl-title {
    font-size: 22px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 8px;
  }
  .sl-subtitle {
    font-size: 15px;
    color: #6c757d;
    margin-bottom: 24px;
  }
  .sl-progress-bar {
    width: 100%;
    height: 8px;
    background: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 24px;
  }
  .sl-progress-fill {
    height: 100%;
    width: 33%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 4px;
    transition: width 0.5s ease;
  }
  .sl-timer {
    text-align: center;
    font-size: 16px;
    color: #495057;
    margin-bottom: 20px;
  }
  .sl-timer span {
    display: inline-block;
    background: #fff3f3;
    color: #e74c3c;
    font-weight: 700;
    font-size: 20px;
    padding: 4px 12px;
    border-radius: 8px;
    min-width: 40px;
  }
  .sl-btn {
    display: inline-block;
    border: none;
    border-radius: 8px;
    color: #fff;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    padding: 12px 32px;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    box-shadow: 0 4px 15px rgba(102,126,234,0.4);
  }
  .sl-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102,126,234,0.5);
  }
  .sl-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  .sl-btn-wrap { text-align: center; margin: 16px 0; }
  .sl-ad-slot { text-align: center; margin: 20px 0; }
  .sl-steps-visual {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-bottom: 24px;
  }
  .sl-step-dot {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
  }
  .sl-step-dot.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
  .sl-step-dot.inactive {
    background: #e9ecef;
    color: #adb5bd;
  }
  .sl-step-line {
    width: 40px;
    height: 3px;
    background: #e9ecef;
    border-radius: 2px;
  }
  .sl-msg {
    text-align: center;
    color: #28a745;
    font-weight: 600;
    font-size: 15px;
    display: none;
    margin-top: 16px;
    padding: 12px;
    background: #f0fff4;
    border-radius: 8px;
    border: 1px solid #c3e6cb;
  }
  .sl-no-link {
    text-align: center;
    padding: 40px 20px;
    color: #6c757d;
  }
  .sl-no-link h3 {
    color: #e74c3c;
    margin-bottom: 12px;
  }
</style>

<div class="sl-wrapper">

<?php if ($has_link): ?>

  <div class="sl-card">
    <span class="sl-step-badge">STEP 1 OF 3</span>
    <h2 class="sl-title">Verify to Continue</h2>
    <p class="sl-subtitle">Complete the verification steps below to access your download link.</p>

    <div class="sl-steps-visual">
      <div class="sl-step-dot active">1</div>
      <div class="sl-step-line"></div>
      <div class="sl-step-dot inactive">2</div>
      <div class="sl-step-line"></div>
      <div class="sl-step-dot inactive">3</div>
    </div>

    <div class="sl-progress-bar">
      <div class="sl-progress-fill"></div>
    </div>

    <div class="sl-ad-slot"><?php include get_stylesheet_directory() . '/ads/ads1.txt'; ?></div>

    <div id="sl-timer-section" class="sl-timer">
      Please wait <span id="sl-countdown">15</span> seconds...
    </div>

    <div id="sl-verify1-wrap" class="sl-btn-wrap" style="display:none;">
      <button class="sl-btn" id="sl-verify1-btn" onclick="slVerifyStep1()">Click to Verify</button>
    </div>

    <div id="sl-verify2-wrap" class="sl-btn-wrap" style="display:none;">
      <button class="sl-btn" onclick="slShowContinue()">Confirm Verification</button>
    </div>

    <div class="sl-ad-slot"><?php include get_stylesheet_directory() . '/ads/ads2.txt'; ?></div>

    <div id="sl-success-msg" class="sl-msg">
      &#10003; Verified! Scroll down and click <strong>Continue to Step 2</strong>.
    </div>
  </div>

  <form method="post" action="<?php echo esc_url(home_url('/page2/')); ?>" id="sl-form-step1" style="display:none;">
    <input type="hidden" name="newwpsafelink" value="<?php echo esc_attr($link_value); ?>">
    <div class="sl-card">
      <div class="sl-ad-slot"><?php include get_stylesheet_directory() . '/ads/ads.txt'; ?></div>
      <div class="sl-btn-wrap">
        <button class="sl-btn" type="submit">Continue to Step 2 &rarr;</button>
      </div>
      <div class="sl-ad-slot"><?php include get_stylesheet_directory() . '/ads/ads1.txt'; ?></div>
    </div>
  </form>

  <script>
    (function() {
      var count = 15;
      var timer = setInterval(function() {
        count--;
        document.getElementById('sl-countdown').textContent = count;
        if (count <= 0) {
          clearInterval(timer);
          document.getElementById('sl-timer-section').style.display = 'none';
          document.getElementById('sl-verify1-wrap').style.display = 'block';
        }
      }, 1000);
    })();

    function slVerifyStep1() {
      var btn = document.getElementById('sl-verify1-btn');
      btn.disabled = true;
      btn.textContent = 'Verifying...';
      setTimeout(function() {
        document.getElementById('sl-verify1-wrap').style.display = 'none';
        document.getElementById('sl-verify2-wrap').style.display = 'block';
      }, 4000);
    }

    function slShowContinue() {
      document.getElementById('sl-verify2-wrap').style.display = 'none';
      document.getElementById('sl-success-msg').style.display = 'block';
      document.getElementById('sl-form-step1').style.display = 'block';
    }
  </script>

<?php else: ?>
  <div class="sl-card sl-no-link">
    <h3>No Link Found</h3>
    <p>Please use a valid safelink URL to access this page. The link may have expired.</p>
  </div>
<?php endif; ?>

</div>

<?php get_footer(); ?>
