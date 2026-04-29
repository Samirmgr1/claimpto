<?php

// Include the necessary helper file
require_once "includes/lb_helper.php";

// Create an instance of LicenseBoxExternalAPI (assuming this is used for some other purpose)
$api = new LicenseBoxExternalAPI();

// Verify license (license-related code removed)
// If you have a specific purpose for this verification, replace it accordingly
// The $res variable will now always have ['status' => true] for demonstration purposes
$res = ['status' => true];

if (!$res["status"]) {
    exit("Your license is invalid, please contact support.");
}

// Process the URL (assuming this is part of your application logic)
$url = $_GET["link"];
$url = str_replace("snpurl", "", $url);

// Set a cookie with the processed URL for 3 minutes
setcookie("tp", (string) $url, time() + 180);

// Continue with your application logic as needed

?>
