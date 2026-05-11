<?php
require_once '../core/db.php';
require_once '../core/functions.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    die("Session expired.");
}

// Offerwalls have been removed. Bitcotasks only provides a PTC API,
// so the dedicated offerwall page now redirects users to the PTC ads page.
include __DIR__ . '/load_ptc.php';
