<?php
/**
 * Template Name: Safelink Step 3
 * Description: Organic Safelink - Step 3 of 3 (Final). Assign this template to a WordPress page with slug "page3".
 */

get_header();

// Check if step 2 was completed (newwpsafelink1 POST variable)
$has_step2 = isset($_POST["newwpsafelink1"]) && !empty($_POST["newwpsafelink1"]);
$link_value = $has_step2 ? sanitize_text_field($_POST["newwpsafelink1"]) : '';
$final_url = 'https://linkzon.pro/' . $link_value;
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
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
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
    width: 100%;
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
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
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    padding: 12px 32px;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    text-decoration: none;
  }
  .sl-btn-verify {
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    box-shadow: 0 4px 15px rgba(17,153,142,0.4);
  }
  .sl-btn-verify:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(17,153,142,0.5);
  }
  .sl-btn-download {
    background: linear-gradient(135deg, #ff6a00 0%, #ee0979 100%);
    box-shadow: 0 4px 15px rgba(238,9,121,0.4);
    font-size: 18px;
    padding: 16px 48px;
    animation: sl-pulse 2s infinite;
  }
  .sl-btn-download:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(238,9,121,0.5);
    color: #fff;
    text-decoration: none;
  }
  @keyframes sl-pulse {
    0%, 100% { box-shadow: 0 4px 15px rgba(238,9,121,0.4); }
    50% { box-shadow: 0 4px 25px rgba(238,9,121,0.7); }
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
  .sl-step-dot.done {
    background: #28a745;
    color: #fff;
  }
  .sl-step-dot.active {
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    color: #fff;
  }
  .sl-step-line {
    width: 40px;
    height: 3px;
    background: #28a745;
    border-radius: 2px;
  }
  .sl-msg {
    text-align: center;
    font-weight: 600;
    font-size: 15px;
    display: none;
    margin-top: 16px;
    padding: 16px;
    border-radius: 8px;
  }
  .sl-msg-success {
    color: #28a745;
    background: #f0fff4;
    border: 1px solid #c3e6cb;
  }
  .sl-final-link {
    text-align: center;
    padding: 24px;
    display: none;
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
  .sl-confetti {
    font-size: 28px;
    margin-bottom: 12px;
  }
</style>

<div class="sl-wrapper">

<?php if ($has_step2): ?>

  <div class="sl-card">
    <span class="sl-step-badge">STEP 3 OF 3 — FINAL</span>
    <h2 class="sl-title">Last Step!</h2>
    <p class="sl-subtitle">Complete this final verification to get your download link.</p>

    <div class="sl-steps-visual">
      <div class="sl-step-dot done">&#10003;</div>
      <div class="sl-step-line"></div>
      <div class="sl-step-dot done">&#10003;</div>
      <div class="sl-step-line"></div>
      <div class="sl-step-dot active">3</div>
    </div>

    <div class="sl-progress-bar">
      <div class="sl-progress-fill"></div>
    </div>

    <div class="sl-ad-slot"><?php include get_stylesheet_directory() . '/ads/ads1.txt'; ?></div>
    <div class="sl-ad-slot"><?php include get_stylesheet_directory() . '/ads/ads.txt'; ?></div>

    <div id="sl-timer-section" class="sl-timer">
      Please wait <span id="sl-countdown">15</span> seconds...
    </div>

    <div id="sl-verify1-wrap" class="sl-btn-wrap" style="display:none;">
      <button class="sl-btn sl-btn-verify" id="sl-verify1-btn" onclick="slVerifyStep3()">Click to Verify</button>
    </div>

    <div id="sl-verify2-wrap" class="sl-btn-wrap" style="display:none;">
      <button class="sl-btn sl-btn-verify" onclick="slShowDownload()">Confirm Verification</button>
    </div>

    <div class="sl-ad-slot"><?php include get_stylesheet_directory() . '/ads/ads2.txt'; ?></div>

    <div id="sl-success-msg" class="sl-msg sl-msg-success">
      <div class="sl-confetti">&#127881;</div>
      All steps completed! Your download link is ready below.
    </div>
  </div>

  <div id="sl-final-link" class="sl-final-link">
    <div class="sl-card" style="background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);">
      <div class="sl-ad-slot"><?php include get_stylesheet_directory() . '/ads/ads3.txt'; ?></div>
      <div class="sl-btn-wrap" style="margin: 24px 0;">
        <a href="<?php echo esc_url($final_url); ?>" class="sl-btn sl-btn-download" rel="noopener nofollow">
          Download Now
        </a>
      </div>
      <div class="sl-ad-slot"><?php include get_stylesheet_directory() . '/ads/ads1.txt'; ?></div>
    </div>
  </div>

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

    function slVerifyStep3() {
      var btn = document.getElementById('sl-verify1-btn');
      btn.disabled = true;
      btn.textContent = 'Verifying...';
      setTimeout(function() {
        document.getElementById('sl-verify1-wrap').style.display = 'none';
        document.getElementById('sl-verify2-wrap').style.display = 'block';
      }, 4000);
    }

    function slShowDownload() {
      document.getElementById('sl-verify2-wrap').style.display = 'none';
      document.getElementById('sl-success-msg').style.display = 'block';
      document.getElementById('sl-final-link').style.display = 'block';
    }
  </script>

<?php else: ?>
  <div class="sl-card sl-no-link">
    <h3>Invalid Access</h3>
    <p>You must complete Steps 1 and 2 before accessing this page. Please start from the beginning.</p>
  </div>
<?php endif; ?>

</div>

<?php get_footer(); ?>
