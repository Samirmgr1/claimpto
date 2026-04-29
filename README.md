# Organic Safelink for WordPress

A 3-step safelink system for WordPress that redirects users through verification pages with ad slots before delivering the final download link. Each step has a custom, modern design with countdown timers and verification buttons.

## How It Works

```
User clicks safelink URL
    ↓
safe.php?link=ENCODED_URL
    ↓ (sets cookie, redirects)
Page 1 (/page1/) — Step 1/3: 15s timer → verify → continue
    ↓ (POST form)
Page 2 (/page2/) — Step 2/3: 15s timer → verify → continue
    ↓ (POST form)
Page 3 (/page3/) — Step 3/3: 15s timer → verify → Download button
    ↓
Final destination: https://linkzon.pro/{encoded_url}
```

## File Structure

```
├── safe.php                  # Entry point — processes link & redirects to page1
├── tpcode.php                # Link processor — strips URL, sets cookie
├── page1.php                 # WordPress template — Step 1/3
├── page2.php                 # WordPress template — Step 2/3
├── page3.php                 # WordPress template — Step 3/3 (final link)
├── functions-safelink.php    # WordPress integration (templates, rewrites)
├── ads/
│   ├── ads.txt               # Ad slot placeholder
│   ├── ads1.txt              # Ad slot placeholder
│   ├── ads2.txt              # Ad slot placeholder
│   └── ads3.txt              # Ad slot placeholder
├── includes/
│   ├── lb_helper.php         # License helper class
│   └── index.html            # Directory protection (403)
└── activate/
    └── index.php             # License activation page
```

## Installation

### 1. Copy Files to Your Theme

Copy all files to your active WordPress theme directory:
```
wp-content/themes/your-theme/
```

### 2. Add to functions.php

Add this line to your theme's `functions.php`:
```php
require_once get_stylesheet_directory() . '/functions-safelink.php';
```

### 3. Create WordPress Pages

Create 3 pages in WordPress Admin → Pages → Add New:

| Page Title | Slug    | Template         |
|------------|---------|------------------|
| Page 1     | `page1` | Safelink Step 1  |
| Page 2     | `page2` | Safelink Step 2  |
| Page 3     | `page3` | Safelink Step 3  |

For each page:
1. Set the **Permalink/Slug** as shown above
2. In the right sidebar, select the corresponding **Page Template**
3. Publish the page

### 4. Flush Permalinks

Go to **Settings → Permalinks** and click **Save Changes** (no need to change anything). This registers the `/safe/` rewrite rule.

### 5. Add Your Ads

Edit the ad slot files in the `ads/` folder:
- `ads/ads.txt` — General ad slot
- `ads/ads1.txt` — Primary ad slot (shown most frequently)
- `ads/ads2.txt` — Secondary ad slot
- `ads/ads3.txt` — Tertiary ad slot

Paste your ad code (e.g., Google AdSense) into each file.

## Usage

Generate safelink URLs in this format:
```
https://yoursite.com/safe/?link=YOUR_ENCODED_URL
```

The `link` parameter is the encoded destination URL that will be appended to `https://linkzon.pro/` at the final step.

## Customization

### Change Timers
Each page has a `var count = 15;` in the JavaScript section. Change `15` to your desired countdown duration in seconds.

### Change Final Destination
In `page3.php`, update the `$final_url` line:
```php
$final_url = 'https://linkzon.pro/' . $link_value;
```

### Change Colors
Each page uses a different gradient theme:
- **Step 1**: Purple (`#667eea → #764ba2`)
- **Step 2**: Pink (`#f093fb → #f5576c`)
- **Step 3**: Green (`#11998e → #38ef7d`)

Edit the CSS gradients in each page file to customize.

### Ad Slots
Each step shows 4-6 ad slots. The `ads/` files are included via PHP at strategic points. Edit the placement in the page templates if needed.

## Design Features

- **Responsive**: Works on all screen sizes
- **Modern UI**: Card-based layout with gradient accents, rounded buttons, and smooth animations
- **Progress indicator**: Visual step dots (1 → 2 → 3) and progress bar
- **Countdown timer**: 15-second wait per step with animated counter
- **Two-click verify**: Each step requires 2 verification clicks before revealing the continue button
- **Pulsing download button**: Final download button has an eye-catching pulse animation
- **Error handling**: Shows a friendly message if users try to skip steps

## WordPress Theme Compatibility

These templates use `get_header()` and `get_footer()`, so they inherit your theme's header and footer. They work with any WordPress theme. Tested with MH Magazine Lite.
