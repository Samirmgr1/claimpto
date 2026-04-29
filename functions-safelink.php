<?php
/**
 * Organic Safelink - WordPress Integration
 *
 * Add this to your theme's functions.php:
 *   require_once get_stylesheet_directory() . '/functions-safelink.php';
 *
 * This file handles:
 * 1. Registering custom page templates for the 3-step safelink flow
 * 2. Adding rewrite rules so /safe/ works as a WordPress slug
 * 3. Handling the safelink entry point via WordPress
 */

/**
 * Register the safelink page templates so they appear in the
 * WordPress page editor under "Template" dropdown.
 */
function organic_safelink_register_templates($templates) {
    $templates['page1.php'] = 'Safelink Step 1';
    $templates['page2.php'] = 'Safelink Step 2';
    $templates['page3.php'] = 'Safelink Step 3';
    return $templates;
}
add_filter('theme_page_templates', 'organic_safelink_register_templates');

/**
 * Load the safelink templates from the theme directory.
 */
function organic_safelink_load_template($template) {
    global $post;

    if (!$post) {
        return $template;
    }

    $page_template = get_post_meta($post->ID, '_wp_page_template', true);

    $safelink_templates = array('page1.php', 'page2.php', 'page3.php');

    if (in_array($page_template, $safelink_templates)) {
        $file = get_stylesheet_directory() . '/' . $page_template;
        if (file_exists($file)) {
            return $file;
        }
    }

    return $template;
}
add_filter('template_include', 'organic_safelink_load_template');

/**
 * Add rewrite rule for safe.php to work via WordPress.
 * Access: yoursite.com/safe/?link=ENCODED_URL
 */
function organic_safelink_rewrite_rules() {
    add_rewrite_rule(
        '^safe/?$',
        'index.php?safelink_entry=1',
        'top'
    );
}
add_action('init', 'organic_safelink_rewrite_rules');

/**
 * Register the custom query variable.
 */
function organic_safelink_query_vars($vars) {
    $vars[] = 'safelink_entry';
    return $vars;
}
add_filter('query_vars', 'organic_safelink_query_vars');

/**
 * Handle the safelink entry request.
 * When someone visits /safe/?link=..., process the link and redirect to page1.
 */
function organic_safelink_handle_entry() {
    if (get_query_var('safelink_entry')) {
        $link = isset($_GET['link']) ? sanitize_text_field($_GET['link']) : '';
        $link = str_replace('snpurl', '', $link);

        if (!empty($link)) {
            setcookie('tp', $link, time() + 180, '/');
        }

        include get_stylesheet_directory() . '/safe.php';
        exit;
    }
}
add_action('template_redirect', 'organic_safelink_handle_entry');

/**
 * Flush rewrite rules on theme activation to register the /safe/ slug.
 */
function organic_safelink_flush_rules() {
    organic_safelink_rewrite_rules();
    flush_rewrite_rules();
}
add_action('after_switch_theme', 'organic_safelink_flush_rules');
