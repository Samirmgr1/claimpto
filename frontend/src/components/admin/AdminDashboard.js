import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useAdminTheme } from '../../context/AdminThemeContext';
import { validateLicense, clearLicenseCache, LicenseError } from '../../services/licenseService';
import cacheService from '../../services/cacheService';

// ============================================
// PROFESSIONAL SVG ICONS
// ============================================
const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

// Dashboard Icon
const DashboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
  </svg>
);

// Users Icon
const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

// Tasks Icon
const TasksIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);

// Withdrawals Icon
const WithdrawalsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

// FaucetPay Icon (Lightning)
const FaucetPayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

// Settings Icon
const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// Notifications Icon
const NotificationsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

// Analytics Icon
const AnalyticsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

// Logout Icon
const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

// Menu Icon
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

// Stat Icons
const TotalUsersIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const ActiveUsersIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const DailyActiveIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const EarningsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="6" x2="12" y2="18"/>
    <path d="M15 9.5a3 3 0 0 0-3-2.5H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H9a3 3 0 0 1-3-2.5"/>
  </svg>
);

const TotalWithdrawalsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const PendingWithdrawalsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const PendingTasksIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const AdsTodayIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
    <polyline points="17 2 12 7 7 2"/>
  </svg>
);

// Additional Icons for Cards and Sections
const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const DropletIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const TvIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
    <polyline points="17 2 12 7 7 2"/>
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const UsersSmallIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const ZapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const XCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

const DollarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const HashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="9" x2="20" y2="9"/>
    <line x1="4" y1="15" x2="20" y2="15"/>
    <line x1="10" y1="3" x2="8" y2="21"/>
    <line x1="16" y1="3" x2="14" y2="21"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const PieChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
    <path d="M22 12A10 10 0 0 0 12 2v10z"/>
  </svg>
);

const HistoryIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5"/>
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
    <path d="M12 7v5l4 2"/>
  </svg>
);

const SlidersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14"/>
    <line x1="4" y1="10" x2="4" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12" y2="3"/>
    <line x1="20" y1="21" x2="20" y2="16"/>
    <line x1="20" y1="12" x2="20" y2="3"/>
    <line x1="1" y1="14" x2="7" y2="14"/>
    <line x1="9" y1="8" x2="15" y2="8"/>
    <line x1="17" y1="16" x2="23" y2="16"/>
  </svg>
);

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const GlobeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const DollarSignIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

// Breadcrumb Icons
const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const WalletIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
    <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
  </svg>
);

const AwardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="7"/>
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
  </svg>
);

const TargetIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

// Social Media Brand Icons
const TelegramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const DiscordIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
  </svg>
);

const LinkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

// Broadcast Analytics Icons
const BarChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10"/>
    <line x1="18" y1="20" x2="18" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="16"/>
  </svg>
);

const RadioIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2"/>
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
  </svg>
);

// Set admin token for requests
axios.interceptors.request.use(
  (config) => {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken && (config.url?.includes('/admin') || config.url?.includes('/license'))) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Admin-specific response interceptor for handling token expiration
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized for admin routes
    if (error.response?.status === 401) {
      const config = error.config;
      const isAdminEndpoint = config?.url?.includes('/admin/');
      const isLicenseEndpoint = config?.url?.includes('/license');
      const isAdminLoginEndpoint = config?.url?.includes('/admin/login');
      
      // Only handle admin endpoints, skip login endpoint to avoid redirect loops
      if ((isAdminEndpoint || isLicenseEndpoint) && !isAdminLoginEndpoint) {
        console.warn('[Admin] Token expired or invalid, redirecting to login');
        
        // Clear admin credentials
        localStorage.removeItem('adminToken');
        localStorage.removeItem('admin');
        localStorage.removeItem('adminActiveTab');
        
        // Force redirect to admin login
        if (window.location.pathname !== '/admin/login') {
          window.location.href = '/admin/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// ============================================
// LICENSE ENFORCEMENT - ADMIN DASHBOARD GATE
// ============================================
// SECURITY: The admin dashboard MUST NOT render without a valid license.
// This component validates the license on mount and periodically.
// License failures display a block screen and prevent admin access.
// DO NOT BYPASS OR WEAKEN THIS GATE.
// ============================================

function AdminDashboard() {
  const { admin, logout } = useAuth();
  const { toggleTheme, isDark } = useAdminTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('adminActiveTab') || 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // License state
  const [licenseStatus, setLicenseStatus] = useState({
    checking: true,   // Validate first before loading dashboard
    valid: false,
    offline: false,
    error: null,
    message: null
  });

  // ============================================
  // LICENSE VALIDATION ON MOUNT (Background)
  // ============================================
  useEffect(() => {
    if (!admin) {
      navigate('/admin/login');
      return;
    }
    
    // Validate license in background without blocking UI
    const checkLicense = async () => {
      console.log('[ADMIN] Validating license in background...');
      
      try {
        const result = await validateLicense(true); // Force fresh validation
        
        if (result.valid) {
          console.log('[ADMIN] ✓ License valid');
          setLicenseStatus({
            checking: false,
            valid: true,
            offline: result.offline || false,
            error: null,
            message: result.message
          });
        } else {
          console.error('[ADMIN] ✗ License invalid:', result.error);
          setLicenseStatus({
            checking: false,
            valid: false,
            offline: false,
            error: result.error || 'LICENSE_INVALID',
            message: result.message || 'License validation failed'
          });
        }
      } catch (error) {
        console.error('[ADMIN] ✗ License check error:', error);
        setLicenseStatus({
          checking: false,
          valid: false,
          offline: false,
          error: 'VALIDATION_ERROR',
          message: 'Unable to validate license'
        });
      }
    };
    
    checkLicense();
    
    // Periodic revalidation every 5 minutes
    const revalidationInterval = setInterval(() => {
      console.log('[ADMIN] Periodic license revalidation...');
      checkLicense();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(revalidationInterval);
  }, [admin, navigate]);

  // Persist active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

  const handleLogout = () => {
    logout();
    clearLicenseCache();
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminActiveTab');
    navigate('/admin/login');
  };

  // ============================================
  // LICENSE CHECK - SILENT LOADING (no UI)
  // ============================================
  if (licenseStatus.checking) {
    return null; // Silent check - no loading UI shown
  }

  // ============================================
  // LICENSE INVALID - BLOCK DASHBOARD
  // ============================================
  if (!licenseStatus.valid) {
    const errorInfo = LicenseError[licenseStatus.error] || LicenseError.VALIDATION_ERROR;
    
    return (
      <div className="admin-license-gate error">
        <div className="admin-license-card">
          <div className="license-error-icon">{errorInfo.icon}</div>
          <h2>{errorInfo.title}</h2>
          <p>{licenseStatus.message || errorInfo.message}</p>
          <div className="license-error-details">
            <small>Error Code: {licenseStatus.error}</small>
          </div>
          <div className="license-error-actions">
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setLicenseStatus(prev => ({ ...prev, checking: true }));
                validateLicense(true).then(result => {
                  setLicenseStatus({
                    checking: false,
                    valid: result.valid,
                    offline: result.offline || false,
                    error: result.error || null,
                    message: result.message || null
                  });
                });
              }}
            >
              Retry Validation
            </button>
            <button className="btn btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // LICENSE VALID - RENDER DASHBOARD
  // ============================================
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'users', label: 'Users', icon: <UsersIcon /> },
    { id: 'tasks', label: 'Tasks', icon: <TasksIcon /> },
    { id: 'withdrawals', label: 'Withdrawals', icon: <WithdrawalsIcon /> },
    { id: 'faucetpay', label: 'FaucetPay', icon: <FaucetPayIcon /> },
    { id: 'ads', label: 'Ads Settings', icon: <TvIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
    { id: 'notifications', label: 'Notifications', icon: <NotificationsIcon /> },
    { id: 'analytics', label: 'Analytics', icon: <AnalyticsIcon /> }
  ];

  return (
    <div className={`admin-layout ${isDark ? 'dark-theme' : ''}`}>
      {/* Offline Mode Warning Banner */}
      {licenseStatus.offline && (
        <div className="admin-offline-banner">
          ⚠️ Operating in offline mode. Some features may be limited.
        </div>
      )}
      
      {/* Sidebar */}
      <div className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <FaucetPayIcon />
            <span>Admin Panel</span>
          </div>
        </div>
        <nav className="admin-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="admin-nav-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <div className="admin-user-name">
              Logged in as: <strong>{admin?.username}</strong>
            </div>
          </div>
          <button className="btn btn-secondary admin-logout-btn" onClick={handleLogout}>
            <LogoutIcon />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-header-left">
            <button 
              className="admin-menu-toggle" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <MenuIcon />
            </button>
            <div className="admin-header-content">
              <nav className="admin-breadcrumb">
                <span className="breadcrumb-item breadcrumb-home" onClick={() => setActiveTab('dashboard')}>
                  <HomeIcon />
                  <span>Admin</span>
                </span>
                <ChevronRightIcon />
                <span className="breadcrumb-item breadcrumb-current">
                  {tabs.find(t => t.id === activeTab)?.label}
                </span>
              </nav>
              <h1 className="admin-page-title">
                {tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label}
              </h1>
            </div>
          </div>
          <button className="admin-theme-toggle" onClick={toggleTheme}>
            {isDark ? <SunIcon /> : <MoonIcon />}
            <span>{isDark ? 'Light' : 'Dark'}</span>
          </button>
        </header>

        <div className="admin-content">
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'tasks' && <TasksTab />}
          {activeTab === 'withdrawals' && <WithdrawalsTab />}
          {activeTab === 'faucetpay' && <FaucetPayTab />}
          {activeTab === 'ads' && <AdsSettingsTab />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
        </div>
      </div>
    </div>
  );
}

/* ============================================
   DASHBOARD TAB
   ============================================ */
function DashboardTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    const fetchStats = async () => {
      try {
        // Use cached fetch for better performance
        const data = await cacheService.deduplicatedFetch(
          'admin/dashboard',
          async () => {
            const response = await axios.get('/admin/dashboard');
            return response.data.stats;
          }
        );
        if (isMountedRef.current) {
          setStats(data);
        }
      } catch (error) {
        console.error('Dashboard error:', error);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };
    fetchStats();
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (loading) {
    return <div className="loading"><div className="loading-spinner"></div><p>Loading dashboard...</p></div>;
  }

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon"><TotalUsersIcon /></div>
          <div className="stat-value">{stats?.totalUsers || 0}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><ActiveUsersIcon /></div>
          <div className="stat-value">{stats?.activeUsers || 0}</div>
          <div className="stat-label">Active Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><DailyActiveIcon /></div>
          <div className="stat-value">{stats?.dailyActiveUsers || 0}</div>
          <div className="stat-label">Daily Active</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><EarningsIcon /></div>
          <div className="stat-value">{stats?.totalEarnings?.toFixed(5) || '0.00000'}</div>
          <div className="stat-label">Total Earnings</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><TotalWithdrawalsIcon /></div>
          <div className="stat-value">{stats?.totalWithdrawals?.toFixed(5) || '0.00000'}</div>
          <div className="stat-label">Total Withdrawals</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><PendingWithdrawalsIcon /></div>
          <div className="stat-value">{stats?.pendingWithdrawals || 0}</div>
          <div className="stat-label">Pending Withdrawals</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><PendingTasksIcon /></div>
          <div className="stat-value">{stats?.pendingTasks || 0}</div>
          <div className="stat-label">Pending Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><AdsTodayIcon /></div>
          <div className="stat-value">{stats?.adsToday || 0}</div>
          <div className="stat-label">Ads Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FaucetPayIcon /></div>
          <div className="stat-value">{stats?.faucetPayStats?.todayCount || 0}</div>
          <div className="stat-label">FaucetPay Today</div>
        </div>
      </div>

      {/* Today's Summary */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon"><ChartIcon /></span>
            Today's Earnings Breakdown
          </h2>
        </div>
        <div className="stats-list">
          <div className="stats-list-item">
            <span className="stats-list-label"><DropletIcon /> Faucet Earnings</span>
            <span className="stats-list-value">{stats?.todayEarnings?.faucet?.toFixed(5) || '0.00000'}</span>
          </div>
          <div className="stats-list-item">
            <span className="stats-list-label"><CheckCircleIcon /> Task Earnings</span>
            <span className="stats-list-value">{stats?.todayEarnings?.task?.toFixed(5) || '0.00000'}</span>
          </div>
          <div className="stats-list-item">
            <span className="stats-list-label"><TvIcon /> Ad Earnings</span>
            <span className="stats-list-value">{stats?.todayEarnings?.ads?.toFixed(5) || '0.00000'}</span>
          </div>
          <div className="stats-list-item">
            <span className="stats-list-label"><UsersSmallIcon /> Referral Earnings</span>
            <span className="stats-list-value">{stats?.todayEarnings?.referral?.toFixed(5) || '0.00000'}</span>
          </div>
        </div>
      </div>

      {/* FaucetPay Quick Stats */}
      {stats?.faucetPayStats && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon"><ZapIcon /></span>
              FaucetPay Instant Withdrawals
            </h2>
          </div>
          <div className="stats-list">
            <div className="stats-list-item">
              <span className="stats-list-label"><CheckCircleIcon /> Successful Payments</span>
              <span className="stats-list-value">{stats?.faucetPayStats?.success || 0}</span>
            </div>
            <div className="stats-list-item">
              <span className="stats-list-label"><XCircleIcon /> Failed Payments</span>
              <span className="stats-list-value">{stats?.faucetPayStats?.failed || 0}</span>
            </div>
            <div className="stats-list-item">
              <span className="stats-list-label"><HashIcon /> Total Payments</span>
              <span className="stats-list-value">{stats?.faucetPayStats?.total || 0}</span>
            </div>
            <div className="stats-list-item">
              <span className="stats-list-label"><DollarIcon /> Today's Amount</span>
              <span className="stats-list-value">{stats?.faucetPayStats?.todayAmount?.toFixed(8) || '0.00000000'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================
   USERS TAB
   ============================================ */
function UsersTab() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const isMountedRef = useRef(true);

  const fetchUsers = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      
      const cacheKey = `admin/users?${params.toString()}`;
      
      // Invalidate cache if force refresh
      if (forceRefresh) {
        cacheService.invalidate(cacheKey);
      }
      
      const data = await cacheService.deduplicatedFetch(
        cacheKey,
        async () => {
          const response = await axios.get(`/admin/users?${params}`);
          return response.data;
        }
      );
      
      if (isMountedRef.current) {
        setUsers(data.users);
        setTotalPages(data.pagination?.pages || 1);
      }
    } catch (error) {
      console.error('Users error:', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchUsers();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchUsers]);

  const updateUserStatus = async (userId, status) => {
    try {
      await axios.patch(`/admin/users/${userId}/status`, { status });
      cacheService.invalidatePattern('admin/users');
      fetchUsers(true);
      setSelectedUser(null);
    } catch (error) {
      console.error('Update status error:', error);
    }
  };

  const adjustBalance = async (userId, amount, type = 'add', reason = '') => {
    try {
      await axios.patch(`/admin/users/${userId}/balance`, { amount, type, reason });
      cacheService.invalidatePattern('admin/users');
      fetchUsers(true);
      setSelectedUser(null);
    } catch (error) {
      console.error('Adjust balance error:', error);
      alert(error.response?.data?.message || 'Failed to adjust balance');
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="card">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search by username or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '150px' }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <button className="btn btn-primary" onClick={fetchUsers} style={{ width: 'auto' }}>
            Search
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        {loading ? (
          <div className="loading"><div className="loading-spinner"></div></div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Telegram ID</th>
                    <th>Balance</th>
                    <th>Total Earned</th>
                    <th>Referrals</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user._id}>
                      <td>
                        <strong>{user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown'}</strong>
                      </td>
                      <td>{user.telegramId}</td>
                      <td>{user.balance?.toFixed(5)}</td>
                      <td>{user.totalEarnings?.toFixed(5)}</td>
                      <td>{user.referralCount || 0}</td>
                      <td>
                        <span className={`badge badge-${user.status === 'active' ? 'success' : user.status === 'suspended' ? 'warning' : 'danger'}`}>
                          {user.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            className="btn btn-primary" 
                            onClick={() => navigate(`/admin/users/${user._id}`)}
                            style={{ padding: '4px 12px', fontSize: '12px' }}
                          >
                            View Details
                          </button>
                          <button 
                            className="btn btn-outline" 
                            onClick={() => setSelectedUser(user)}
                            style={{ padding: '4px 12px', fontSize: '12px' }}
                          >
                            Quick Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
              <button 
                className="btn btn-secondary" 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                style={{ width: 'auto' }}
              >
                Previous
              </button>
              <span className="balance-display">
                Page {page} of {totalPages}
              </span>
              <button 
                className="btn btn-secondary" 
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{ width: 'auto' }}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* User Modal */}
      {selectedUser && (
        <UserModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)}
          onUpdateStatus={updateUserStatus}
          onAdjustBalance={adjustBalance}
        />
      )}
    </div>
  );
}

function UserModal({ user, onClose, onUpdateStatus, onAdjustBalance }) {
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('add');
  const [adjustReason, setAdjustReason] = useState('');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Manage User</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="stats-list">
            <div className="stats-list-item">
              <span>Username</span>
              <span className="stats-list-value">{user.username || 'N/A'}</span>
            </div>
            <div className="stats-list-item">
              <span>Telegram ID</span>
              <span className="stats-list-value">{user.telegramId}</span>
            </div>
            <div className="stats-list-item">
              <span>Balance</span>
              <span className="stats-list-value">{user.balance?.toFixed(5)} coins</span>
            </div>
            <div className="stats-list-item">
              <span>Total Earnings</span>
              <span className="stats-list-value">{user.totalEarnings?.toFixed(5)} coins</span>
            </div>
            <div className="stats-list-item">
              <span>Status</span>
              <span className={`badge badge-${user.status === 'active' ? 'success' : 'danger'}`}>
                {user.status}
              </span>
            </div>
          </div>

          {/* Status Actions */}
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ marginBottom: '12px' }}>Update Status</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-success" 
                onClick={() => onUpdateStatus(user._id, 'active')}
                disabled={user.status === 'active'}
                style={{ flex: 1 }}
              >
                Activate
              </button>
              <button 
                className="btn btn-warning" 
                onClick={() => onUpdateStatus(user._id, 'suspended')}
                disabled={user.status === 'suspended'}
                style={{ flex: 1 }}
              >
                Suspend
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => onUpdateStatus(user._id, 'banned')}
                disabled={user.status === 'banned'}
                style={{ flex: 1 }}
              >
                Ban
              </button>
            </div>
          </div>

          {/* Balance Adjustment */}
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ marginBottom: '12px' }}>Adjust Balance</h4>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <select
                className="form-control"
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value)}
                style={{ width: '120px' }}
              >
                <option value="add">Add</option>
                <option value="subtract">Subtract</option>
                <option value="set">Set To</option>
              </select>
              <input
                type="number"
                className="form-control"
                placeholder="Amount"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                min="0"
                style={{ flex: 1 }}
              />
            </div>
            <input
              type="text"
              className="form-control"
              placeholder="Reason (optional)"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
            <button 
              className="btn btn-primary" 
              onClick={() => onAdjustBalance(user._id, parseFloat(adjustAmount), adjustType, adjustReason)}
              disabled={!adjustAmount || parseFloat(adjustAmount) < 0}
              style={{ marginTop: '8px' }}
            >
              {adjustType === 'add' ? '➕ Add' : adjustType === 'subtract' ? '➖ Subtract' : '🔄 Set'} Balance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================
   TASKS TAB
   ============================================ */
function TasksTab() {
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('submissions');
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskAnalytics, setTaskAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const isMountedRef = useRef(true);
  
  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      let tasksUrl = '/admin/tasks?';
      if (dateFrom) tasksUrl += `dateFrom=${dateFrom}&`;
      if (dateTo) tasksUrl += `dateTo=${dateTo}&`;
      if (statusFilter !== 'all') tasksUrl += `status=${statusFilter}&`;
      
      const tasksCacheKey = `admin/tasks?dateFrom=${dateFrom}&dateTo=${dateTo}&status=${statusFilter}`;
      const submissionsCacheKey = 'admin/task-submissions?status=pending';
      
      if (forceRefresh) {
        cacheService.invalidate(tasksCacheKey);
        cacheService.invalidate(submissionsCacheKey);
      }
      
      const [tasksData, submissionsData] = await Promise.all([
        cacheService.deduplicatedFetch(
          tasksCacheKey,
          async () => {
            const response = await axios.get(tasksUrl);
            return response.data.tasks;
          }
        ),
        cacheService.deduplicatedFetch(
          submissionsCacheKey,
          async () => {
            const response = await axios.get('/admin/task-submissions?status=pending');
            return response.data.submissions;
          }
        )
      ]);
      
      if (isMountedRef.current) {
        setTasks(tasksData);
        setSubmissions(submissionsData);
      }
    } catch (error) {
      console.error('Tasks error:', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData]);

  const fetchTaskAnalytics = async (taskId) => {
    setAnalyticsLoading(true);
    try {
      const response = await axios.get(`/admin/tasks/${taskId}/analytics?days=7`);
      setTaskAnalytics(response.data);
    } catch (error) {
      console.error('Task analytics error:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const openTaskAnalytics = (task) => {
    setSelectedTask(task);
    fetchTaskAnalytics(task._id);
  };

  const reviewSubmission = async (id, status) => {
    try {
      await axios.patch(`/admin/task-submissions/${id}`, { status });
      cacheService.invalidatePattern('admin/task');
      cacheService.invalidatePattern('admin/dashboard');
      fetchData(true);
    } catch (error) {
      console.error('Review error:', error);
    }
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await axios.delete(`/admin/tasks/${id}`);
      cacheService.invalidatePattern('admin/task');
      fetchData(true);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setStatusFilter('all');
  };

  // Calculate totals
  const totalCompletions = tasks.reduce((sum, t) => sum + (t.analytics?.totalCompletions || 0), 0);
  const todayCompletions = tasks.reduce((sum, t) => sum + (t.analytics?.todayCompletions || 0), 0);
  const weeklyCompletions = tasks.reduce((sum, t) => sum + (t.analytics?.weeklyCompletions || 0), 0);
  const activeTasks = tasks.filter(t => t.status === 'active').length;
  const maxedOutTasks = tasks.filter(t => t.analytics?.isMaxedOut).length;

  return (
    <div>
      {/* Sub Tabs */}
      <div className="tab-container" style={{ marginBottom: '16px' }}>
        <button 
          className={`tab ${activeSubTab === 'submissions' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('submissions')}
        >
          Pending Submissions ({submissions.length})
        </button>
        <button 
          className={`tab ${activeSubTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('tasks')}
        >
          Manage Tasks
        </button>
        <button 
          className={`tab ${activeSubTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('analytics')}
        >
          📊 Analytics
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="loading-spinner"></div></div>
      ) : activeSubTab === 'submissions' ? (
        <div>
          {submissions.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <h3 className="empty-state-title">No Pending Submissions</h3>
                <p className="empty-state-description">All task submissions have been reviewed.</p>
              </div>
            </div>
          ) : (
            submissions.map(submission => (
              <div key={submission._id} className="card">
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ marginBottom: '4px' }}>{submission.task?.title}</h3>
                  <p className="text-muted" style={{ fontSize: '14px' }}>
                    User: {submission.user?.username || submission.user?.telegramId}
                  </p>
                  {submission.proof && (
                    <div className="proof-display">
                      <strong>Proof:</strong> {submission.proof}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-success" 
                    onClick={() => reviewSubmission(submission._id, 'approved')}
                    style={{ flex: 1 }}
                  >
                    ✓ Approve
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={() => reviewSubmission(submission._id, 'rejected')}
                    style={{ flex: 1 }}
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeSubTab === 'analytics' ? (
        <div>
          {/* Analytics Overview */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: '16px' }}>
            <div className="stat-card">
              <div className="stat-icon">📋</div>
              <div className="stat-value">{tasks.length}</div>
              <div className="stat-label">Total Tasks</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-value">{activeTasks}</div>
              <div className="stat-label">Active Tasks</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🏆</div>
              <div className="stat-value">{totalCompletions}</div>
              <div className="stat-label">Total Completions</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📅</div>
              <div className="stat-value">{todayCompletions}</div>
              <div className="stat-label">Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📈</div>
              <div className="stat-value">{weeklyCompletions}</div>
              <div className="stat-label">This Week</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🚫</div>
              <div className="stat-value">{maxedOutTasks}</div>
              <div className="stat-label">Maxed Out</div>
            </div>
          </div>

          {/* Date Filters */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>📅 Filter by Date</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: '1 1 150px' }}>
                <label className="form-label" style={{ color: 'var(--text-primary)' }}>From</label>
                <input
                  type="date"
                  className="form-control"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: '1 1 150px' }}>
                <label className="form-label" style={{ color: 'var(--text-primary)' }}>To</label>
                <input
                  type="date"
                  className="form-control"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: '1 1 150px' }}>
                <label className="form-label" style={{ color: 'var(--text-primary)' }}>Status</label>
                <select
                  className="form-control"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={clearFilters}
                style={{ width: 'auto', height: '42px' }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Task Analytics Table */}
          <div className="card">
            <h3 className="card-section-title"><PieChartIcon /> Task Performance</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: 'var(--text-primary)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 8px', color: 'var(--text-primary)' }}>Task</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-primary)' }}>Status</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-primary)' }}>Total</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-primary)' }}>Today</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-primary)' }}>Week</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-primary)' }}>Slots</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-primary)' }}>Pending</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-primary)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 8px', color: 'var(--text-primary)' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{task.title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>+{task.reward} coins</div>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span className={`badge badge-${task.status === 'active' ? 'success' : 'secondary'}`}>
                          {task.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {task.analytics?.totalCompletions || 0}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span style={{ color: task.analytics?.todayCompletions > 0 ? '#22c55e' : 'var(--text-secondary)' }}>
                          {task.analytics?.todayCompletions || 0}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-primary)' }}>
                        {task.analytics?.weeklyCompletions || 0}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        {task.maxCompletions > 0 ? (
                          <span className={`badge badge-${task.analytics?.isMaxedOut ? 'danger' : 'warning'}`}>
                            {task.analytics?.remainingSlots}/{task.maxCompletions}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>∞</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        {task.submissionCounts?.pending > 0 ? (
                          <span className="badge badge-warning">{task.submissionCounts.pending}</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <button
                          className="btn btn-outline"
                          onClick={() => openTaskAnalytics(task)}
                          style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }}
                        >
                          📈 Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Task Detail Modal */}
          {selectedTask && (
            <div className="modal-overlay" onClick={() => { setSelectedTask(null); setTaskAnalytics(null); }}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                  <h2 className="modal-title">📊 {selectedTask.title}</h2>
                  <button className="modal-close" onClick={() => { setSelectedTask(null); setTaskAnalytics(null); }}>&times;</button>
                </div>
                <div className="modal-body">
                  {analyticsLoading ? (
                    <div className="loading"><div className="loading-spinner"></div></div>
                  ) : taskAnalytics ? (
                    <>
                      {/* Quick Stats */}
                      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '20px', gap: '12px' }}>
                        <div className="stat-card" style={{ padding: '16px' }}>
                          <div className="stat-value" style={{ fontSize: '24px' }}>{taskAnalytics.task?.analytics?.totalCompletions || 0}</div>
                          <div className="stat-label">Total Completions</div>
                        </div>
                        <div className="stat-card" style={{ padding: '16px' }}>
                          <div className="stat-value" style={{ fontSize: '24px' }}>
                            {taskAnalytics.task?.analytics?.remainingSlots !== null 
                              ? taskAnalytics.task.analytics.remainingSlots 
                              : '∞'}
                          </div>
                          <div className="stat-label">Remaining Slots</div>
                        </div>
                        <div className="stat-card" style={{ padding: '16px' }}>
                          <div className="stat-value" style={{ fontSize: '24px' }}>{taskAnalytics.task?.analytics?.totalRewardsGiven?.toFixed(0) || 0}</div>
                          <div className="stat-label">Rewards Given</div>
                        </div>
                      </div>

                      {/* Daily Completions Chart */}
                      <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>📅 Last 7 Days</h4>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '100px' }}>
                          {taskAnalytics.dailyCompletions?.length > 0 ? (
                            taskAnalytics.dailyCompletions.map((day, i) => {
                              const maxCount = Math.max(...taskAnalytics.dailyCompletions.map(d => d.count), 1);
                              const height = (day.count / maxCount) * 80;
                              return (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <div style={{ fontSize: '10px', marginBottom: '4px', color: 'var(--text-primary)' }}>{day.count}</div>
                                  <div style={{ 
                                    width: '100%', 
                                    height: `${Math.max(height, 4)}px`, 
                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                    borderRadius: '4px 4px 0 0'
                                  }} />
                                  <div style={{ fontSize: '10px', marginTop: '4px', color: 'var(--text-secondary)' }}>
                                    {day._id.slice(5)}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ width: '100%', textAlign: 'center', color: 'var(--text-secondary)' }}>No completions in the last 7 days</div>
                          )}
                        </div>
                      </div>

                      {/* Top Completers */}
                      {taskAnalytics.topCompleters?.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                          <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>🏆 Top Completers</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {taskAnalytics.topCompleters.slice(0, 5).map((completer, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-primary)' }}>
                                <span>{i + 1}. {completer.user}</span>
                                <span className="badge badge-info">{completer.completions}x</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recent Submissions */}
                      {taskAnalytics.recentSubmissions?.length > 0 && (
                        <div>
                          <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>🕐 Recent Submissions</h4>
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {taskAnalytics.recentSubmissions.slice(0, 10).map((sub, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <div>
                                  <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{sub.user}</div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(sub.createdAt).toLocaleString()}</div>
                                </div>
                                <span className={`badge badge-${sub.status === 'approved' ? 'success' : sub.status === 'rejected' ? 'danger' : 'warning'}`}>
                                  {sub.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#666' }}>Failed to load analytics</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>All Tasks ({tasks.length})</h3>
              <button 
                className="btn btn-primary" 
                onClick={() => { setEditingTask(null); setShowTaskModal(true); }}
                style={{ width: 'auto' }}
              >
                + Add Task
              </button>
            </div>
          </div>
          
          {tasks.map(task => (
            <div key={task._id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ marginBottom: '4px' }}>{task.title}</h3>
                  <p className="text-muted" style={{ fontSize: '14px', marginBottom: '8px' }}>{task.description}</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="badge badge-info">+{task.reward} coins</span>
                    <span className={`badge badge-${task.status === 'active' ? 'success' : 'secondary'}`}>
                      {task.status}
                    </span>
                    <span className="badge badge-secondary">{task.type}</span>
                    {task.maxCompletions > 0 && (
                      <span className={`badge badge-${task.analytics?.isMaxedOut ? 'danger' : 'warning'}`}>
                        {task.analytics?.totalCompletions || 0}/{task.maxCompletions} completed
                      </span>
                    )}
                    {task.minVisitDuration > 0 && (
                      <span className="badge badge-secondary">⏱️ {task.minVisitDuration}s min</span>
                    )}
                    {!task.requiresProof && (
                      <span className="badge badge-success">Auto-approve</span>
                    )}
                  </div>
                  {/* Quick Analytics */}
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                    📊 Today: {task.analytics?.todayCompletions || 0} | Week: {task.analytics?.weeklyCompletions || 0} | Total: {task.analytics?.totalCompletions || 0}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-outline" 
                    onClick={() => { setEditingTask(task); setShowTaskModal(true); }}
                    style={{ width: 'auto', padding: '8px 12px' }}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-danger" 
                    onClick={() => deleteTask(task._id)}
                    style={{ width: 'auto', padding: '8px 12px' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showTaskModal && (
        <TaskModal 
          task={editingTask}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
          onSave={fetchData}
        />
      )}
    </div>
  );
}

function TaskModal({ task, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    type: task?.type || 'social',
    reward: task?.reward || 10,
    url: task?.url || '',
    requiresProof: task?.requiresProof ?? true,
    status: task?.status || 'active',
    minVisitDuration: task?.minVisitDuration || 0,
    maxCompletions: task?.maxCompletions || 0
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (task) {
        await axios.put(`/admin/tasks/${task._id}`, formData);
      } else {
        await axios.post('/admin/tasks', formData);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Save task error:', error);
      alert(error.response?.data?.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{task ? 'Edit Task' : 'Add New Task'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                type="text"
                className="form-control"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                rows="3"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select
                className="form-control"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="social">Social</option>
                <option value="visit_website">Visit Website</option>
                <option value="watch_video">Watch Video</option>
                <option value="join_channel">Join Channel</option>
                <option value="survey">Survey</option>
                <option value="download">Download</option>
                <option value="signup">Sign Up</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reward (coins)</label>
              <input
                type="number"
                className="form-control"
                value={formData.reward}
                onChange={(e) => setFormData({ ...formData, reward: parseFloat(e.target.value) })}
                required
                min="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">URL (optional)</label>
              <input
                type="url"
                className="form-control"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Min Visit Duration (seconds)</label>
              <input
                type="number"
                className="form-control"
                value={formData.minVisitDuration}
                onChange={(e) => setFormData({ ...formData, minVisitDuration: parseInt(e.target.value) || 0 })}
                min="0"
                placeholder="0 = no minimum"
              />
              <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
                Users must wait this many seconds after clicking the link before submitting. Leave 0 for no requirement.
              </small>
            </div>
            <div className="form-group">
              <label className="form-label">Max Completions</label>
              <input
                type="number"
                className="form-control"
                value={formData.maxCompletions}
                onChange={(e) => setFormData({ ...formData, maxCompletions: parseInt(e.target.value) || 0 })}
                min="0"
                placeholder="0 = unlimited"
              />
              <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
                Maximum number of users who can complete this task. Task will automatically become unavailable when limit is reached. Leave 0 for unlimited.
              </small>
              {task?.completionCount > 0 && (
                <small className="text-success" style={{ display: 'block', marginTop: '4px' }}>
                  Current completions: {task.completionCount}
                </small>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-control"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="form-group">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={formData.requiresProof}
                  onChange={(e) => setFormData({ ...formData, requiresProof: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
              <span style={{ marginLeft: '12px' }}>Requires Proof</span>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================
   WITHDRAWALS TAB
   ============================================ */
function WithdrawalsTab() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalMethods, setWithdrawalMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [activeSubTab, setActiveSubTab] = useState('requests');
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const isMountedRef = useRef(true);

  const fetchWithdrawals = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const cacheKey = `admin/withdrawals?status=${statusFilter}`;
      
      if (forceRefresh) {
        cacheService.invalidate(cacheKey);
      }
      
      const data = await cacheService.deduplicatedFetch(
        cacheKey,
        async () => {
          const response = await axios.get(`/admin/withdrawals?status=${statusFilter}`);
          return response.data.withdrawals;
        }
      );
      
      if (isMountedRef.current) {
        setWithdrawals(data);
      }
    } catch (error) {
      console.error('Withdrawals error:', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [statusFilter]);

  const fetchMethods = useCallback(async (forceRefresh = false) => {
    try {
      const cacheKey = 'admin/withdrawal-methods';
      
      if (forceRefresh) {
        cacheService.invalidate(cacheKey);
      }
      
      const data = await cacheService.deduplicatedFetch(
        cacheKey,
        async () => {
          const response = await axios.get('/admin/withdrawal-methods');
          return response.data.methods || [];
        }
      );
      
      if (isMountedRef.current) {
        setWithdrawalMethods(data);
      }
    } catch (error) {
      console.error('Methods error:', error);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchWithdrawals();
    fetchMethods();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchWithdrawals, fetchMethods]);

  const processWithdrawal = async (id, status, transactionId = '') => {
    try {
      await axios.patch(`/admin/withdrawals/${id}`, { status, transactionId });
      cacheService.invalidatePattern('admin/withdrawals');
      cacheService.invalidatePattern('admin/dashboard');
      fetchWithdrawals(true);
    } catch (error) {
      console.error('Process error:', error);
    }
  };

  const toggleMethod = async (methodId, isEnabled) => {
    try {
      await axios.patch(`/admin/withdrawal-methods/${methodId}/toggle`, { isEnabled: !isEnabled });
      cacheService.invalidate('admin/withdrawal-methods');
      fetchMethods(true);
    } catch (error) {
      console.error('Toggle method error:', error);
    }
  };

  const deleteMethod = async (methodId) => {
    if (!window.confirm('Are you sure you want to delete this withdrawal method?')) return;
    try {
      await axios.delete(`/admin/withdrawal-methods/${methodId}`);
      cacheService.invalidate('admin/withdrawal-methods');
      fetchMethods(true);
    } catch (error) {
      console.error('Delete method error:', error);
    }
  };

  return (
    <div>
      {/* Sub Tabs */}
      <div className="tab-container" style={{ marginBottom: '16px' }}>
        <button 
          className={`tab ${activeSubTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('requests')}
        >
          Withdrawal Requests
        </button>
        <button 
          className={`tab ${activeSubTab === 'methods' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('methods')}
        >
          Payment Methods
        </button>
      </div>

      {activeSubTab === 'requests' ? (
        <>
          {/* Filter */}
          <div className="card">
            <div className="tab-container" style={{ padding: 0, background: 'transparent' }}>
              {['pending', 'approved', 'rejected', 'all'].map(status => (
                <button
                  key={status}
                  className={`tab ${statusFilter === status ? 'active' : ''}`}
                  onClick={() => setStatusFilter(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="loading"><div className="loading-spinner"></div></div>
          ) : withdrawals.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">💸</div>
                <h3 className="empty-state-title">No Withdrawals</h3>
                <p className="empty-state-description">No {statusFilter} withdrawals found.</p>
              </div>
            </div>
          ) : (
            withdrawals.map(withdrawal => (
              <div key={withdrawal._id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ marginBottom: '4px' }}>{withdrawal.amount?.toFixed(5)} Coins</h3>
                    <p className="text-muted" style={{ fontSize: '14px' }}>
                      User: {withdrawal.user?.username || withdrawal.user?.telegramId}
                    </p>
                    <p className="text-muted" style={{ fontSize: '14px' }}>
                      Method: {withdrawal.method} - {withdrawal.address}
                    </p>
                    {withdrawal.fee > 0 && (
                      <p className="text-muted" style={{ fontSize: '12px' }}>
                        Fee: {withdrawal.fee?.toFixed(5)} | Net: {withdrawal.netAmount?.toFixed(5)}
                      </p>
                    )}
                    <p className="text-muted" style={{ fontSize: '12px' }}>
                      {new Date(withdrawal.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`badge badge-${withdrawal.status === 'approved' ? 'success' : withdrawal.status === 'rejected' ? 'danger' : 'warning'}`}>
                    {withdrawal.status}
                  </span>
                </div>
                {withdrawal.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn btn-success" 
                      onClick={() => {
                        const txId = prompt('Enter transaction ID (optional):');
                        processWithdrawal(withdrawal._id, 'approved', txId || '');
                      }}
                      style={{ flex: 1 }}
                    >
                      ✓ Approve
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => processWithdrawal(withdrawal._id, 'rejected')}
                      style={{ flex: 1 }}
                    >
                      ✗ Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      ) : (
        <>
          {/* Payment Methods Management */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Payment Methods ({withdrawalMethods.length})</h3>
              <button 
                className="btn btn-primary" 
                onClick={() => { setEditingMethod(null); setShowMethodModal(true); }}
                style={{ width: 'auto' }}
              >
                + Add Method
              </button>
            </div>
          </div>

          {withdrawalMethods.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">💳</div>
                <h3 className="empty-state-title">No Payment Methods</h3>
                <p className="empty-state-description">Add payment methods for users to withdraw.</p>
              </div>
            </div>
          ) : (
            withdrawalMethods.map(method => (
              <div key={method._id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ 
                      width: '48px', 
                      height: '48px', 
                      borderRadius: '12px', 
                      background: 'var(--bg-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px'
                    }}>
                      {method.logo ? <img src={method.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} /> : '💳'}
                    </div>
                    <div>
                      <h3 style={{ marginBottom: '4px' }}>{method.name}</h3>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span className="badge badge-info">{method.currency}</span>
                        <span className="badge badge-secondary">Min: {method.minAmount}</span>
                        <span className="badge badge-secondary">Max: {method.maxAmount}</span>
                        {method.fee > 0 && (
                          <span className="badge badge-warning">
                            Fee: {method.fee}{method.feeType === 'percentage' ? '%' : ' fixed'}
                          </span>
                        )}
                      </div>
                      <p className="text-muted" style={{ fontSize: '12px' }}>
                        {method.customFields?.length || 0} custom field(s) • {method.processingTime || 'Instant'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label className="toggle-switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={method.isEnabled}
                        onChange={() => toggleMethod(method._id, method.isEnabled)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => { setEditingMethod(method); setShowMethodModal(true); }}
                      style={{ width: 'auto', padding: '8px 12px' }}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => deleteMethod(method._id)}
                      style={{ width: 'auto', padding: '8px 12px' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {showMethodModal && (
        <WithdrawalMethodModal 
          method={editingMethod}
          onClose={() => { setShowMethodModal(false); setEditingMethod(null); }}
          onSave={() => { fetchMethods(); setShowMethodModal(false); setEditingMethod(null); }}
        />
      )}
    </div>
  );
}

// Withdrawal Method Modal
function WithdrawalMethodModal({ method, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: method?.name || '',
    slug: method?.slug || '',
    description: method?.description || '',
    logo: method?.logo || '',
    currency: method?.currency || 'USDT',
    minAmount: method?.minAmount || 1,
    maxAmount: method?.maxAmount || 1000,
    processingTime: method?.processingTime || '24-48 hours',
    fee: method?.fee || 0,
    feeType: method?.feeType || 'percentage',
    isEnabled: method?.isEnabled ?? true,
    customFields: method?.customFields || [{ name: 'wallet_address', label: 'Wallet Address', type: 'text', placeholder: 'Enter your wallet address', required: true }]
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (method) {
        await axios.patch(`/admin/withdrawal-methods/${method._id}`, formData);
      } else {
        await axios.post('/admin/withdrawal-methods', formData);
      }
      onSave();
    } catch (error) {
      console.error('Save method error:', error);
      alert(error.response?.data?.message || 'Failed to save method');
    } finally {
      setSaving(false);
    }
  };

  const addCustomField = () => {
    setFormData({
      ...formData,
      customFields: [
        ...formData.customFields,
        { name: '', label: '', type: 'text', placeholder: '', required: false }
      ]
    });
  };

  const updateCustomField = (index, field, value) => {
    const updated = [...formData.customFields];
    updated[index] = { ...updated[index], [field]: value };
    // Auto-generate name from label
    if (field === 'label') {
      updated[index].name = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }
    setFormData({ ...formData, customFields: updated });
  };

  const removeCustomField = (index) => {
    const updated = formData.customFields.filter((_, i) => i !== index);
    setFormData({ ...formData, customFields: updated });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2 className="modal-title">{method ? 'Edit Payment Method' : 'Add Payment Method'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Bitcoin, PayPal"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="e.g., BTC, USDT, USD"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Logo URL (optional)</label>
              <input
                type="url"
                className="form-control"
                value={formData.logo}
                onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Min Amount</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.minAmount}
                  onChange={(e) => setFormData({ ...formData, minAmount: parseFloat(e.target.value) })}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Amount</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.maxAmount}
                  onChange={(e) => setFormData({ ...formData, maxAmount: parseFloat(e.target.value) })}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Fee</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.fee}
                  onChange={(e) => setFormData({ ...formData, fee: parseFloat(e.target.value) })}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Fee Type</label>
                <select
                  className="form-control"
                  value={formData.feeType}
                  onChange={(e) => setFormData({ ...formData, feeType: e.target.value })}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Processing Time</label>
              <input
                type="text"
                className="form-control"
                value={formData.processingTime}
                onChange={(e) => setFormData({ ...formData, processingTime: e.target.value })}
                placeholder="e.g., 24-48 hours, Instant"
              />
            </div>

            {/* Custom Fields Section */}
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Custom Fields</h4>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={addCustomField}
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
                >
                  + Add Field
                </button>
              </div>
              
              {formData.customFields.map((field, index) => (
                <div key={index} style={{ 
                  background: 'var(--bg-primary)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  marginBottom: '12px' 
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={field.label}
                      onChange={(e) => updateCustomField(index, 'label', e.target.value)}
                      placeholder="Field Label"
                      style={{ fontSize: '13px', padding: '8px' }}
                    />
                    <select
                      className="form-control"
                      value={field.type}
                      onChange={(e) => updateCustomField(index, 'type', e.target.value)}
                      style={{ fontSize: '13px', padding: '8px' }}
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="number">Number</option>
                      <option value="textarea">Textarea</option>
                    </select>
                    <button 
                      type="button"
                      className="btn btn-danger"
                      onClick={() => removeCustomField(index)}
                      style={{ width: 'auto', padding: '8px 12px' }}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={field.placeholder}
                      onChange={(e) => updateCustomField(index, 'placeholder', e.target.value)}
                      placeholder="Placeholder text"
                      style={{ fontSize: '13px', padding: '8px', flex: 1 }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateCustomField(index, 'required', e.target.checked)}
                      />
                      Required
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={formData.isEnabled}
                  onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
              <span style={{ marginLeft: '12px' }}>Enabled</span>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Method'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================
   FAUCETPAY TAB
   ============================================ */
function FaucetPayTab() {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('payments');
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const isMountedRef = useRef(true);

  const SUPPORTED_CURRENCIES = [
    { code: 'BTC', name: 'Bitcoin' },
    { code: 'ETH', name: 'Ethereum' },
    { code: 'DOGE', name: 'Dogecoin' },
    { code: 'LTC', name: 'Litecoin' },
    { code: 'BCH', name: 'Bitcoin Cash' },
    { code: 'DASH', name: 'Dash' },
    { code: 'DGB', name: 'DigiByte' },
    { code: 'TRX', name: 'Tron' },
    { code: 'USDT', name: 'Tether' },
    { code: 'FEY', name: 'Feyorra' },
    { code: 'ZEC', name: 'Zcash' },
    { code: 'BNB', name: 'Binance Coin' },
    { code: 'SOL', name: 'Solana' },
    { code: 'XRP', name: 'Ripple' },
    { code: 'POL', name: 'Polygon' },
    { code: 'ADA', name: 'Cardano' },
    { code: 'TON', name: 'Toncoin' },
    { code: 'XLM', name: 'Stellar' },
    { code: 'USDC', name: 'USD Coin' },
    { code: 'XMR', name: 'Monero' },
    { code: 'TARA', name: 'Taraxa' },
    { code: 'TRUMP', name: 'Trump' },
    { code: 'PEPE', name: 'Pepe' },
    { code: 'FLT', name: 'Fluent' }
  ];

  const fetchPayments = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const cacheKey = `admin/faucetpay/payments?status=${statusFilter}&page=${page}`;
      
      if (forceRefresh) {
        cacheService.invalidate(cacheKey);
      }
      
      const data = await cacheService.deduplicatedFetch(
        cacheKey,
        async () => {
          const response = await axios.get(`/admin/faucetpay/payments?status=${statusFilter}&page=${page}`);
          return response.data;
        }
      );
      
      if (isMountedRef.current) {
        setPayments(data.payments || []);
        setStats(data.stats);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('FaucetPay payments error:', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [statusFilter, page]);

  const fetchBalance = useCallback(async (forceRefresh = false) => {
    try {
      const cacheKey = 'admin/faucetpay/balance';
      
      if (forceRefresh) {
        cacheService.invalidate(cacheKey);
      }
      
      const data = await cacheService.deduplicatedFetch(
        cacheKey,
        async () => {
          const response = await axios.get('/admin/faucetpay/balance');
          return response.data;
        }
      );
      
      if (isMountedRef.current && data.success) {
        setBalance(data);
      }
    } catch (error) {
      console.error('FaucetPay balance error:', error);
    }
  }, []);

  const fetchSettings = useCallback(async (forceRefresh = false) => {
    try {
      const cacheKey = 'admin/settings';
      
      if (forceRefresh) {
        cacheService.invalidate(cacheKey);
      }
      
      const data = await cacheService.deduplicatedFetch(
        cacheKey,
        async () => {
          const response = await axios.get('/admin/settings');
          return response.data.settings;
        }
      );
      
      if (isMountedRef.current) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Settings error:', error);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchPayments();
    fetchBalance();
    fetchSettings();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchPayments, fetchBalance, fetchSettings]);

  const updateSettings = async () => {
    setSaving(true);
    try {
      await axios.put('/admin/settings', {
        faucetpayEnabled: settings.faucetpayEnabled,
        faucetpayApiKey: settings.faucetpayApiKey,
        faucetpayCurrency: settings.faucetpayCurrency,
        faucetpayMinWithdrawal: settings.faucetpayMinWithdrawal,
        faucetpayMaxWithdrawal: settings.faucetpayMaxWithdrawal,
        faucetpayFee: settings.faucetpayFee,
        faucetpayFeeType: settings.faucetpayFeeType,
        faucetpayProcessingTime: settings.faucetpayProcessingTime,
        faucetpayDailyLimit: settings.faucetpayDailyLimit,
        faucetpayReferToAccountBalance: settings.faucetpayReferToAccountBalance,
        faucetpayExchangeRates: settings.faucetpayExchangeRates || {}
      });
      alert('FaucetPay settings saved successfully!');
      cacheService.invalidatePattern('admin/settings');
      cacheService.invalidatePattern('admin/faucetpay');
      fetchBalance(true);
    } catch (error) {
      console.error('Save settings error:', error);
      alert(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await axios.post('/admin/faucetpay/test', {
        apiKey: settings.faucetpayApiKey,
        currency: settings.faucetpayCurrency
      });
      setTestResult({ success: true, message: response.data.message, balance: response.data.balance, currency: response.data.currency });
    } catch (error) {
      setTestResult({ success: false, message: error.response?.data?.message || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      success: { class: 'success', label: 'Success' },
      failed: { class: 'danger', label: 'Failed' },
      pending: { class: 'warning', label: 'Pending' },
      cancelled: { class: 'secondary', label: 'Cancelled' }
    };
    return badges[status] || { class: 'secondary', label: status };
  };

  return (
    <div>
      {/* Sub Tabs */}
      <div className="tab-container" style={{ marginBottom: '16px' }}>
        <button 
          className={`tab ${activeSubTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('payments')}
        >
          <HistoryIcon /> Payment History
        </button>
        <button 
          className={`tab ${activeSubTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('settings')}
        >
          <SlidersIcon /> Settings
        </button>
      </div>

      {activeSubTab === 'payments' ? (
        <>
          {/* Stats Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: '16px' }}>
            <div className="stat-card">
              <div className="stat-icon"><WalletIcon /></div>
              <div className="stat-value">{balance?.balance || '-'}</div>
              <div className="stat-label">FaucetPay Balance ({balance?.currency || settings?.faucetpayCurrency || 'TRX'})</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><CheckCircleIcon /></div>
              <div className="stat-value">{stats?.success?.count || 0}</div>
              <div className="stat-label">Successful Payments</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><XCircleIcon /></div>
              <div className="stat-value">{stats?.failed?.count || 0}</div>
              <div className="stat-label">Failed Payments</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><ClockIcon /></div>
              <div className="stat-value">{stats?.pending?.count || 0}</div>
              <div className="stat-label">Pending</div>
            </div>
          </div>

          {/* Filter */}
          <div className="card">
            <div className="tab-container" style={{ padding: 0, background: 'transparent' }}>
              {['all', 'success', 'failed', 'pending'].map(status => (
                <button
                  key={status}
                  className={`tab ${statusFilter === status ? 'active' : ''}`}
                  onClick={() => { setStatusFilter(status); setPage(1); }}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="loading"><div className="loading-spinner"></div></div>
          ) : payments.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">⚡</div>
                <h3 className="empty-state-title">No FaucetPay Payments</h3>
                <p className="empty-state-description">No payment history found.</p>
              </div>
            </div>
          ) : (
            <>
              {payments.map(payment => (
                <div key={payment._id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ marginBottom: '4px' }}>
                        {payment.amount?.toFixed(8)} {payment.currency}
                      </h3>
                      <p className="text-muted" style={{ fontSize: '14px' }}>
                        User: {payment.user?.username || payment.user?.telegramId || 'Unknown'}
                      </p>
                      <p className="text-muted" style={{ fontSize: '14px' }}>
                        To: {payment.recipientAddress}
                      </p>
                      {payment.fee > 0 && (
                        <p className="text-muted" style={{ fontSize: '12px' }}>
                          Fee: {payment.fee?.toFixed(8)} | Net: {payment.netAmount?.toFixed(8)}
                        </p>
                      )}
                      {payment.payoutId && (
                        <p className="text-muted" style={{ fontSize: '12px' }}>
                          Payout ID: <code>{payment.payoutId}</code>
                        </p>
                      )}
                      {payment.errorMessage && (
                        <p style={{ fontSize: '12px', color: 'var(--danger-color)' }}>
                          Error: {payment.errorMessage}
                        </p>
                      )}
                      <p className="text-muted" style={{ fontSize: '12px' }}>
                        {new Date(payment.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`badge badge-${getStatusBadge(payment.status).class}`}>
                      {getStatusBadge(payment.status).label}
                    </span>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="card" style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ width: 'auto' }}
                  >
                    Previous
                  </button>
                  <span style={{ padding: '8px 16px' }}>
                    Page {page} of {pagination.pages}
                  </span>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    style={{ width: 'auto' }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {/* FaucetPay Settings */}
          {!settings ? (
            <div className="loading"><div className="loading-spinner"></div></div>
          ) : (
            <div>
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    <span className="card-icon"><ZapIcon /></span>
                    FaucetPay Configuration
                  </h2>
                </div>

                {/* Enable/Disable Toggle */}
                <div className="form-group">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.faucetpayEnabled ?? false}
                      onChange={(e) => setSettings({ ...settings, faucetpayEnabled: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span style={{ marginLeft: '12px' }}>Enable FaucetPay Instant Withdrawals</span>
                </div>

                {/* API Key */}
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input
                    type="password"
                    className="form-control"
                    value={settings.faucetpayApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, faucetpayApiKey: e.target.value })}
                    placeholder="Enter your FaucetPay API Key"
                  />
                  <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
                    Get your API key from <a href="https://faucetpay.io/account/api-keys" target="_blank" rel="noopener noreferrer">FaucetPay API Settings</a>
                  </small>
                </div>

                {/* Test Connection Button */}
                <div className="form-group">
                  <button 
                    className="btn btn-secondary" 
                    onClick={testConnection}
                    disabled={testing || !settings.faucetpayApiKey}
                    style={{ width: 'auto' }}
                  >
                    {testing ? 'Testing...' : '🔌 Test Connection'}
                  </button>
                  {testResult && (
                    <div className={`${testResult.success ? 'success' : 'error'}`} style={{ marginTop: '8px' }}>
                      {testResult.message}
                      {testResult.balance !== undefined && (
                        <span> - Balance: {testResult.balance} {testResult.currency}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Currency Selection */}
                <div className="form-group">
                  <label className="form-label">Payment Currency</label>
                  <select
                    className="form-control"
                    value={settings.faucetpayCurrency || 'TRX'}
                    onChange={(e) => setSettings({ ...settings, faucetpayCurrency: e.target.value })}
                  >
                    {SUPPORTED_CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>

                {/* Amount Limits */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Minimum Withdrawal</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.faucetpayMinWithdrawal || 1}
                      onChange={(e) => setSettings({ ...settings, faucetpayMinWithdrawal: parseFloat(e.target.value) })}
                      step="0.00000001"
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Maximum Withdrawal</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.faucetpayMaxWithdrawal || 1000}
                      onChange={(e) => setSettings({ ...settings, faucetpayMaxWithdrawal: parseFloat(e.target.value) })}
                      step="0.00000001"
                      min="0"
                    />
                  </div>
                </div>

                {/* Fee Settings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Fee</label>
                    <input
                      type="number"
                      className="form-control"
                      value={settings.faucetpayFee || 0}
                      onChange={(e) => setSettings({ ...settings, faucetpayFee: parseFloat(e.target.value) })}
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fee Type</label>
                    <select
                      className="form-control"
                      value={settings.faucetpayFeeType || 'percentage'}
                      onChange={(e) => setSettings({ ...settings, faucetpayFeeType: e.target.value })}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>
                </div>

                {/* Processing Time */}
                <div className="form-group">
                  <label className="form-label">Processing Time (Display Text)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.faucetpayProcessingTime || 'Instant'}
                    onChange={(e) => setSettings({ ...settings, faucetpayProcessingTime: e.target.value })}
                    placeholder="e.g., Instant, 1-5 minutes"
                  />
                </div>

                {/* Daily Limit */}
                <div className="form-group">
                  <label className="form-label">Daily Withdrawal Limit (per user)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={settings.faucetpayDailyLimit || 0}
                    onChange={(e) => setSettings({ ...settings, faucetpayDailyLimit: parseInt(e.target.value) })}
                    min="0"
                  />
                  <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
                    Set to 0 for unlimited withdrawals per day
                  </small>
                </div>

                {/* Referral Option */}
                <div className="form-group">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.faucetpayReferToAccountBalance ?? false}
                      onChange={(e) => setSettings({ ...settings, faucetpayReferToAccountBalance: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span style={{ marginLeft: '12px' }}>Pay from referral balance when possible</span>
                </div>

                {/* Save Button */}
                <button 
                  className="btn btn-primary" 
                  onClick={updateSettings}
                  disabled={saving}
                  style={{ marginTop: '16px' }}
                >
                  {saving ? 'Saving...' : '💾 Save FaucetPay Settings'}
                </button>
              </div>

              {/* Exchange Rates Configuration */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    <span className="card-icon">💱</span>
                    Coin Exchange Rates
                  </h2>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Set the USD value per 1 coin for each cryptocurrency. These rates are used to convert user's balance to the crypto amount when withdrawing.
                  <br /><strong>Example:</strong> If BTC rate is 96000, then $1 USD = 0.00001042 BTC
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {SUPPORTED_CURRENCIES.map(coin => (
                    <div key={coin.code} className="form-group" style={{ marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontSize: '13px' }}>
                        {coin.name} ({coin.code})
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>$</span>
                        <input
                          type="number"
                          className="form-control"
                          value={settings.faucetpayExchangeRates?.[coin.code] || ''}
                          onChange={(e) => setSettings({
                            ...settings,
                            faucetpayExchangeRates: {
                              ...settings.faucetpayExchangeRates,
                              [coin.code]: parseFloat(e.target.value) || 0
                            }
                          })}
                          placeholder="0.00"
                          step="0.00000001"
                          min="0"
                          style={{ fontSize: '13px' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick note about the current payment currency */}
                {settings.faucetpayCurrency && (
                  <div style={{ 
                    marginTop: '16px', 
                    padding: '12px', 
                    background: 'var(--bg-secondary)', 
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}>
                    <strong>Current Payment Currency:</strong> {settings.faucetpayCurrency}
                    {settings.faucetpayExchangeRates?.[settings.faucetpayCurrency] ? (
                      <span style={{ marginLeft: '8px', color: 'var(--success-color)' }}>
                        ✓ Rate set: ${settings.faucetpayExchangeRates[settings.faucetpayCurrency]}
                      </span>
                    ) : (
                      <span style={{ marginLeft: '8px', color: 'var(--danger-color)' }}>
                        ⚠️ No rate configured - withdrawals will fail!
                      </span>
                    )}
                  </div>
                )}

                {/* Save Exchange Rates Button */}
                <button 
                  className="btn btn-primary" 
                  onClick={updateSettings}
                  disabled={saving}
                  style={{ marginTop: '16px' }}
                >
                  {saving ? 'Saving...' : '💾 Save Exchange Rates'}
                </button>
              </div>

              {/* Help Section */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    <span className="card-icon">💡</span>
                    Setup Guide
                  </h2>
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  <p style={{ marginBottom: '8px' }}>1. Create a FaucetPay account at <a href="https://faucetpay.io" target="_blank" rel="noopener noreferrer">faucetpay.io</a></p>
                  <p style={{ marginBottom: '8px' }}>2. Go to <a href="https://faucetpay.io/account/api-keys" target="_blank" rel="noopener noreferrer">API Keys</a> and create a new API key</p>
                  <p style={{ marginBottom: '8px' }}>3. Make sure your API key has the "Send" permission enabled</p>
                  <p style={{ marginBottom: '8px' }}>4. <strong>Configure exchange rates</strong> for the coins you want to support</p>
                  <p style={{ marginBottom: '8px' }}>5. Fund your FaucetPay balance with the selected currency</p>
                  <p style={{ marginBottom: '8px' }}>6. Users can withdraw using their FaucetPay linked email address</p>
                  <p>7. Withdrawals are processed instantly via the FaucetPay API</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================
   ADS SETTINGS TAB
   ============================================ */
function AdsSettingsTab() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    const fetchSettings = async () => {
      try {
        const data = await cacheService.deduplicatedFetch(
          'admin/settings',
          async () => {
            const response = await axios.get('/admin/settings');
            return response.data.settings;
          }
        );
        if (isMountedRef.current) {
          // Create a deep copy to avoid mutating cached data
          setSettings(JSON.parse(JSON.stringify(data)));
        }
      } catch (error) {
        console.error('Settings error:', error);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };
    fetchSettings();
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const updateSettings = async () => {
    // Calculate enabled faucet providers and validate
    const MAX_FAUCET_PROVIDERS = settings.faucetClaimMaxProviders || 3;
    const enabledFaucetProviders = [];
    if (settings.adsgramEnabled && settings.adsgramFaucetEnabled && settings.adsgramBlockId) enabledFaucetProviders.push('adsgram');
    if (settings.monetagEnabled && settings.monetagFaucetEnabled && settings.monetagZoneId) enabledFaucetProviders.push('monetag');
    if (settings.adextraEnabled && settings.adextraFaucetEnabled && settings.adextraPublisherId) enabledFaucetProviders.push('adextra');
    if (settings.adexoraEnabled && settings.adexoraFaucetEnabled && settings.adexoraAppId) enabledFaucetProviders.push('adexora');
    
    // Validate max providers
    if (enabledFaucetProviders.length > MAX_FAUCET_PROVIDERS) {
      alert(`Maximum ${MAX_FAUCET_PROVIDERS} ad providers can be enabled for Faucet Claim. You have ${enabledFaucetProviders.length} enabled. Please disable some providers.`);
      return;
    }

    setSaving(true);
    setSuccess(null);
    try {
      // Include the calculated faucet claim provider priority
      const updatedSettings = {
        ...settings,
        faucetClaimProviderPriority: enabledFaucetProviders.slice(0, MAX_FAUCET_PROVIDERS)
      };
      await axios.put('/admin/settings', updatedSettings);
      cacheService.invalidatePattern('admin/settings');
      cacheService.invalidatePattern('admin/dashboard');
      setSuccess('Ads settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Save settings error:', error);
      alert(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="loading-spinner"></div><p>Loading ads settings...</p></div>;
  }

  if (!settings) {
    return <div className="card"><p>Failed to load settings</p></div>;
  }

  return (
    <div>
      {success && <div className="success">{success}</div>}

      {/* General Ad Settings */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon"><TvIcon /></span>
            General Ads Settings
          </h2>
        </div>
        <div className="form-group">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.adsEnabled ?? true}
              onChange={(e) => setSettings({ ...settings, adsEnabled: e.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
          <span style={{ marginLeft: '12px' }}>Enable Ads</span>
        </div>
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label">Ad Reward</label>
            <input
              type="number"
              className="form-control"
              value={settings.adReward || 0}
              onChange={(e) => setSettings({ ...settings, adReward: parseFloat(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Ad Cooldown (seconds)</label>
            <input
              type="number"
              className="form-control"
              value={settings.adCooldown || 0}
              onChange={(e) => setSettings({ ...settings, adCooldown: parseInt(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Daily Ad Limit</label>
            <input
              type="number"
              className="form-control"
              value={settings.dailyAdLimit || 0}
              onChange={(e) => setSettings({ ...settings, dailyAdLimit: parseInt(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* Faucet Claim Provider Summary */}
      {(() => {
        const MAX_FAUCET_PROVIDERS = settings.faucetClaimMaxProviders || 3;
        const enabledFaucetProviders = [];
        if (settings.adsgramEnabled && settings.adsgramFaucetEnabled && settings.adsgramBlockId) enabledFaucetProviders.push({ id: 'adsgram', name: 'Adsgram' });
        if (settings.monetagEnabled && settings.monetagFaucetEnabled && settings.monetagZoneId) enabledFaucetProviders.push({ id: 'monetag', name: 'Monetag' });
        if (settings.adextraEnabled && settings.adextraFaucetEnabled && settings.adextraPublisherId) enabledFaucetProviders.push({ id: 'adextra', name: 'AdExtra' });
        if (settings.adexoraEnabled && settings.adexoraFaucetEnabled && settings.adexoraAppId) enabledFaucetProviders.push({ id: 'adexora', name: 'Adexora' });
        const isOverLimit = enabledFaucetProviders.length > MAX_FAUCET_PROVIDERS;
        
        return (
          <div className="card" style={{ 
            border: isOverLimit ? '2px solid #ef4444' : '1px solid var(--border-color)',
            background: isOverLimit ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-card)'
          }}>
            <div className="card-header">
              <h2 className="card-title">
                <span className="card-icon">🎯</span>
                Faucet Claim Ads Configuration
              </h2>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '16px',
              background: isOverLimit ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
              borderRadius: '12px',
              marginBottom: '16px'
            }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Enabled Faucet Claim Providers
                </div>
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: '700',
                  color: isOverLimit ? '#ef4444' : 'var(--primary-color)'
                }}>
                  {enabledFaucetProviders.length} / {MAX_FAUCET_PROVIDERS}
                </div>
              </div>
              <div style={{ 
                padding: '8px 16px', 
                borderRadius: '8px',
                background: enabledFaucetProviders.length === 0 ? '#6b7280' : 
                            isOverLimit ? '#ef4444' : '#10b981',
                color: 'white',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                {enabledFaucetProviders.length === 0 ? '⚠️ No providers' :
                 isOverLimit ? '❌ Too many!' : '✓ Valid'}
              </div>
            </div>

            {isOverLimit && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                marginBottom: '16px',
                color: '#ef4444',
                fontSize: '13px'
              }}>
                ⚠️ <strong>Configuration Error:</strong> Maximum {MAX_FAUCET_PROVIDERS} providers allowed for Faucet Claim. 
                Please disable some providers below. Current configuration will not save.
              </div>
            )}

            {enabledFaucetProviders.length === 0 && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                marginBottom: '16px',
                color: '#f59e0b',
                fontSize: '13px'
              }}>
                ⚠️ <strong>Notice:</strong> No ad providers are enabled for Faucet Claim. 
                Users will not be able to claim faucet rewards until at least one provider is enabled.
              </div>
            )}

            {enabledFaucetProviders.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Active providers (in order of priority):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {enabledFaucetProviders.slice(0, MAX_FAUCET_PROVIDERS).map((provider, index) => (
                    <div key={provider.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: 'rgba(99, 102, 241, 0.15)',
                      borderRadius: '20px',
                      fontSize: '13px',
                      color: 'var(--primary-color)',
                      fontWeight: '500'
                    }}>
                      <span style={{ 
                        width: '20px', 
                        height: '20px', 
                        background: 'var(--primary-color)',
                        color: 'white',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}>{index + 1}</span>
                      {provider.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-muted" style={{ fontSize: '13px', marginBottom: '0' }}>
              Only providers enabled below for "Use for Faucet Claim" will appear on the Faucet screen. 
              Maximum {MAX_FAUCET_PROVIDERS} providers can be active at once.
            </p>
          </div>
        );
      })()}

      {/* Ads Peering Configuration - Multiple Groups */}
      {(() => {
        // Available providers for peering (must be enabled and configured)
        const availableProviders = [];
        if (settings.adsgramEnabled && settings.adsgramBlockId) availableProviders.push({ id: 'adsgram', name: 'Adsgram', reward: settings.adsgramReward || 0.1 });
        if (settings.monetagEnabled && settings.monetagZoneId) availableProviders.push({ id: 'monetag', name: 'Monetag', reward: settings.monetagReward || 0.1 });
        if (settings.adextraEnabled && settings.adextraPublisherId) availableProviders.push({ id: 'adextra', name: 'AdExtra', reward: settings.adextraReward || 0.1 });
        if (settings.adexoraEnabled && settings.adexoraAppId) availableProviders.push({ id: 'adexora', name: 'Adexora', reward: settings.adexoraReward || 0.1 });
        
        // Current peer groups - array of arrays
        const peeringGroups = settings.adsPeeringGroups || [];
        
        // Get all providers already in a group
        const providersInGroups = new Set(peeringGroups.flat());
        
        // Available providers not yet in any group
        const availableForNewGroup = availableProviders.filter(p => !providersInGroups.has(p.id));
        
        // Add a new peer group
        const addPeerGroup = () => {
          const newGroups = [...peeringGroups, []];
          setSettings({ ...settings, adsPeeringGroups: newGroups });
        };
        
        // Remove a peer group
        const removePeerGroup = (index) => {
          const newGroups = peeringGroups.filter((_, i) => i !== index);
          setSettings({ ...settings, adsPeeringGroups: newGroups });
        };
        
        // Toggle provider in a specific group
        const toggleProviderInGroup = (groupIndex, providerId) => {
          const newGroups = [...peeringGroups];
          const group = [...(newGroups[groupIndex] || [])];
          
          if (group.includes(providerId)) {
            newGroups[groupIndex] = group.filter(p => p !== providerId);
          } else {
            newGroups[groupIndex] = [...group, providerId];
          }
          setSettings({ ...settings, adsPeeringGroups: newGroups });
        };
        
        // Calculate group reward (sum of individual rewards)
        const getGroupReward = (group) => {
          return Math.round(group.reduce((sum, pId) => {
            const provider = availableProviders.find(p => p.id === pId);
            return sum + (provider?.reward || 0);
          }, 0) * 100) / 100;
        };
        
        // Check if any group has validation issues
        const hasInvalidGroups = peeringGroups.some(g => g.length > 0 && g.length < 2);
        
        return (
          <div className="card" style={{ 
            border: settings.adsPeeringEnabled && hasInvalidGroups ? '2px solid #f59e0b' : '1px solid var(--border-color)'
          }}>
            <div className="card-header">
              <h2 className="card-title">
                <span className="card-icon">🔗</span>
                Ads Peering
              </h2>
            </div>
            
            <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
              Create peer groups. When a user taps any provider in a group, they must watch <strong>all</strong> ads 
              in that group sequentially. Reward is sum of individual ad rewards.
            </p>
            
            {/* Enable toggle */}
            <div className="form-group" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '16px',
              background: settings.adsPeeringEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <div>
                <div style={{ fontWeight: '600', color: 'var(--text-color)' }}>Enable Ads Peering</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {settings.adsPeeringEnabled ? `${peeringGroups.filter(g => g.length >= 2).length} peer group(s) active` : 'Peering is disabled'}
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.adsPeeringEnabled ?? false}
                  onChange={(e) => setSettings({ ...settings, adsPeeringEnabled: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            
            {availableProviders.length < 2 && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                marginBottom: '16px',
                color: '#f59e0b',
                fontSize: '13px'
              }}>
                ⚠️ <strong>Notice:</strong> At least 2 ad providers must be enabled and configured to create peer groups. 
                Currently {availableProviders.length} provider(s) available.
              </div>
            )}
            
            {/* Existing Peer Groups */}
            {peeringGroups.map((group, groupIndex) => {
              const groupReward = getGroupReward(group);
              const isValid = group.length >= 2;
              // Providers available for this group (not in other groups)
              const availableForThisGroup = availableProviders.filter(p => 
                group.includes(p.id) || !providersInGroups.has(p.id) || !peeringGroups.some((g, i) => i !== groupIndex && g.includes(p.id))
              );
              
              return (
                <div key={groupIndex} style={{
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  border: !isValid && group.length > 0 ? '1px solid #f59e0b' : '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-color)' }}>
                      Peer Group {groupIndex + 1}
                      {isValid && (
                        <span style={{
                          marginLeft: '10px',
                          fontSize: '12px',
                          padding: '2px 8px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          borderRadius: '6px'
                        }}>
                          {groupReward} {settings.currencyName || 'Coins'}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removePeerGroup(groupIndex)}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid #ef4444',
                        borderRadius: '6px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  
                  {!isValid && group.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '8px' }}>
                      ⚠️ Select at least 2 providers
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {availableForThisGroup.map(provider => {
                      const isSelected = group.includes(provider.id);
                      return (
                        <button
                          key={provider.id}
                          onClick={() => toggleProviderInGroup(groupIndex, provider.id)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: isSelected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                            background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                            color: isSelected ? 'var(--primary-color)' : 'var(--text-color)',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {isSelected && <span>✓</span>}
                          {provider.name}
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            +{provider.reward}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {/* Add New Group Button */}
            {availableProviders.length >= 2 && availableForNewGroup.length >= 2 && (
              <button
                onClick={addPeerGroup}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px dashed var(--border-color)',
                  borderRadius: '10px',
                  background: 'transparent',
                  color: 'var(--primary-color)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}
              >
                <span style={{ fontSize: '18px' }}>+</span> Add Peer Group
              </button>
            )}
            
            {peeringGroups.length === 0 && availableProviders.length >= 2 && (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: 'var(--text-muted)',
                fontSize: '14px'
              }}>
                Click "Add Peer Group" to create your first peer group.
              </div>
            )}
            
            {/* Summary */}
            {peeringGroups.filter(g => g.length >= 2).length > 0 && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(99, 102, 241, 0.1)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'var(--text-color)'
              }}>
                <strong>Summary:</strong> {peeringGroups.filter(g => g.length >= 2).length} peer group(s) configured. 
                Providers in the same group will be watched sequentially when any is clicked.
              </div>
            )}
          </div>
        );
      })()}

      {/* Ad Providers */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">📺</span>
            Ad Providers
          </h2>
        </div>
        <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
          Configure individual ad providers. Enable "Use for Faucet Claim" to require watching an ad before claiming faucet rewards. 
          <strong> Maximum 3 providers can be enabled for Faucet Claim.</strong>
        </p>

        {/* Adsgram */}
        <div className="ad-provider-section">
          <h4>📺 Adsgram</h4>
          <div className="form-group">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.adsgramEnabled ?? false}
                onChange={(e) => setSettings({ ...settings, adsgramEnabled: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
            <span style={{ marginLeft: '12px' }}>Enable Adsgram</span>
          </div>
          <div className="form-group">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.adsgramFaucetEnabled ?? false}
                onChange={(e) => setSettings({ ...settings, adsgramFaucetEnabled: e.target.checked })}
                disabled={!settings.adsgramEnabled}
              />
              <span className="toggle-slider"></span>
            </label>
            <span style={{ marginLeft: '12px', opacity: settings.adsgramEnabled ? 1 : 0.5 }}>Use for Faucet Claim</span>
          </div>
          <div className="form-group">
            <label className="form-label">Adsgram Block ID</label>
            <input
              type="text"
              className="form-control"
              value={settings.adsgramBlockId || ''}
              onChange={(e) => setSettings({ ...settings, adsgramBlockId: e.target.value })}
              placeholder="Enter Adsgram Block ID"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Adsgram Reward</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-control"
              value={settings.adsgramReward || 0.1}
              onChange={(e) => setSettings({ ...settings, adsgramReward: parseFloat(e.target.value) || 0.1 })}
              placeholder="Enter reward amount"
            />
          </div>
        </div>

        {/* Monetag */}
        <div className="ad-provider-section">
          <h4>💰 Monetag</h4>
          <div className="form-group">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.monetagEnabled ?? false}
                onChange={(e) => setSettings({ ...settings, monetagEnabled: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
            <span style={{ marginLeft: '12px' }}>Enable Monetag</span>
          </div>
          <div className="form-group">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.monetagFaucetEnabled ?? false}
                onChange={(e) => setSettings({ ...settings, monetagFaucetEnabled: e.target.checked })}
                disabled={!settings.monetagEnabled}
              />
              <span className="toggle-slider"></span>
            </label>
            <span style={{ marginLeft: '12px', opacity: settings.monetagEnabled ? 1 : 0.5 }}>Use for Faucet Claim</span>
          </div>
          <div className="form-group">
            <label className="form-label">Monetag Zone ID</label>
            <input
              type="text"
              className="form-control"
              value={settings.monetagZoneId || ''}
              onChange={(e) => setSettings({ ...settings, monetagZoneId: e.target.value })}
              placeholder="Enter Monetag Zone ID"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Monetag Reward</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-control"
              value={settings.monetagReward || 0.1}
              onChange={(e) => setSettings({ ...settings, monetagReward: parseFloat(e.target.value) || 0.1 })}
              placeholder="Enter reward amount"
            />
          </div>
        </div>

        {/* Adextra */}
        <div className="ad-provider-section">
          <h4>🎬 Adextra</h4>
          <div className="form-group">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.adextraEnabled ?? false}
                onChange={(e) => setSettings({ ...settings, adextraEnabled: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
            <span style={{ marginLeft: '12px' }}>Enable Adextra</span>
          </div>
          <div className="form-group">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.adextraFaucetEnabled ?? false}
                onChange={(e) => setSettings({ ...settings, adextraFaucetEnabled: e.target.checked })}
                disabled={!settings.adextraEnabled}
              />
              <span className="toggle-slider"></span>
            </label>
            <span style={{ marginLeft: '12px', opacity: settings.adextraEnabled ? 1 : 0.5 }}>Use for Faucet Claim</span>
          </div>
          <div className="form-group">
            <label className="form-label">Adextra Placement ID</label>
            <input
              type="text"
              className="form-control"
              value={settings.adextraPublisherId || ''}
              onChange={(e) => setSettings({ ...settings, adextraPublisherId: e.target.value })}
              placeholder="Enter Adextra Placement ID"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Adextra Reward</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-control"
              value={settings.adextraReward || 0.1}
              onChange={(e) => setSettings({ ...settings, adextraReward: parseFloat(e.target.value) || 0.1 })}
              placeholder="Enter reward amount"
            />
          </div>
        </div>

        {/* Adexora */}
        <div className="ad-provider-section">
          <h4>🎯 Adexora</h4>
          <div className="form-group">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.adexoraEnabled ?? false}
                onChange={(e) => setSettings({ ...settings, adexoraEnabled: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
            <span style={{ marginLeft: '12px' }}>Enable Adexora</span>
          </div>
          <div className="form-group">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.adexoraFaucetEnabled ?? false}
                onChange={(e) => setSettings({ ...settings, adexoraFaucetEnabled: e.target.checked })}
                disabled={!settings.adexoraEnabled}
              />
              <span className="toggle-slider"></span>
            </label>
            <span style={{ marginLeft: '12px', opacity: settings.adexoraEnabled ? 1 : 0.5 }}>Use for Faucet Claim</span>
          </div>
          <div className="form-group">
            <label className="form-label">Adexora App ID</label>
            <input
              type="text"
              className="form-control"
              value={settings.adexoraAppId || ''}
              onChange={(e) => setSettings({ ...settings, adexoraAppId: e.target.value })}
              placeholder="Enter Adexora App ID"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Adexora Reward</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-control"
              value={settings.adexoraReward || 0.1}
              onChange={(e) => setSettings({ ...settings, adexoraReward: parseFloat(e.target.value) || 0.1 })}
              placeholder="Enter reward amount"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ marginTop: '20px' }}>
        <button 
          className="btn btn-primary" 
          onClick={updateSettings} 
          disabled={saving}
          style={{ width: '100%' }}
        >
          {saving ? 'Saving...' : '💾 Save Ads Settings'}
        </button>
      </div>
    </div>
  );
}

/* ============================================
   SETTINGS TAB
   ============================================ */
function SettingsTab() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const isMountedRef = useRef(true);

  // Admin Profile State
  const [adminProfile, setAdminProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // Two-Factor Authentication State
  const [twoFactorStatus, setTwoFactorStatus] = useState({ enabled: false, backupCodesRemaining: 0 });
  const [twoFactorSetup, setTwoFactorSetup] = useState(null); // { secret, otpauthUrl }
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState(null);
  const [twoFactorSuccess, setTwoFactorSuccess] = useState(null);
  const [backupCodes, setBackupCodes] = useState(null);
  const [showDisable2FA, setShowDisable2FA] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    
    const fetchSettings = async () => {
      try {
        const data = await cacheService.deduplicatedFetch(
          'admin/settings',
          async () => {
            const response = await axios.get('/admin/settings');
            return response.data.settings;
          }
        );
        if (isMountedRef.current) {
          // Create a deep copy to avoid mutating cached data
          setSettings(JSON.parse(JSON.stringify(data)));
        }
      } catch (error) {
        console.error('Settings error:', error);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    const fetchProfile = async () => {
      try {
        const response = await axios.get('/admin/profile');
        if (isMountedRef.current && response.data.admin) {
          setAdminProfile(response.data.admin);
          setProfileForm(prev => ({
            ...prev,
            username: response.data.admin.username || '',
            email: response.data.admin.email || ''
          }));
          // Update 2FA status from profile
          setTwoFactorStatus(prev => ({
            ...prev,
            enabled: response.data.admin.twoFactorEnabled || false
          }));
        }
      } catch (error) {
        console.error('Profile fetch error:', error);
      }
    };

    const fetch2FAStatus = async () => {
      try {
        const response = await axios.get('/admin/2fa/status');
        if (isMountedRef.current) {
          setTwoFactorStatus(response.data);
        }
      } catch (error) {
        console.error('2FA status error:', error);
      }
    };

    fetchSettings();
    fetchProfile();
    fetch2FAStatus();
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 2FA Functions
  const setup2FA = async () => {
    setTwoFactorLoading(true);
    setTwoFactorError(null);
    try {
      const response = await axios.post('/admin/2fa/setup');
      setTwoFactorSetup(response.data);
    } catch (error) {
      setTwoFactorError(error.response?.data?.message || 'Failed to setup 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const enable2FA = async () => {
    if (!twoFactorCode || !twoFactorPassword) {
      setTwoFactorError('Please enter both the verification code and your password');
      return;
    }
    
    setTwoFactorLoading(true);
    setTwoFactorError(null);
    try {
      const response = await axios.post('/admin/2fa/enable', {
        code: twoFactorCode,
        password: twoFactorPassword
      });
      
      setBackupCodes(response.data.backupCodes);
      setTwoFactorStatus({ enabled: true, backupCodesRemaining: response.data.backupCodes.length });
      setTwoFactorSuccess('2FA enabled successfully! Save your backup codes.');
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      setTwoFactorPassword('');
    } catch (error) {
      setTwoFactorError(error.response?.data?.message || 'Failed to enable 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!twoFactorPassword) {
      setTwoFactorError('Password is required to disable 2FA');
      return;
    }
    
    setTwoFactorLoading(true);
    setTwoFactorError(null);
    try {
      await axios.post('/admin/2fa/disable', {
        password: twoFactorPassword,
        code: twoFactorCode || undefined
      });
      
      setTwoFactorStatus({ enabled: false, backupCodesRemaining: 0 });
      setTwoFactorSuccess('2FA has been disabled');
      setShowDisable2FA(false);
      setTwoFactorPassword('');
      setTwoFactorCode('');
      setBackupCodes(null);
      setTimeout(() => setTwoFactorSuccess(null), 5000);
    } catch (error) {
      setTwoFactorError(error.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const regenerateBackupCodes = async () => {
    if (!twoFactorPassword) {
      setTwoFactorError('Password is required');
      return;
    }
    
    setTwoFactorLoading(true);
    setTwoFactorError(null);
    try {
      const response = await axios.post('/admin/2fa/backup-codes', {
        password: twoFactorPassword
      });
      
      setBackupCodes(response.data.backupCodes);
      setTwoFactorStatus(prev => ({ ...prev, backupCodesRemaining: response.data.backupCodes.length }));
      setTwoFactorSuccess('Backup codes regenerated!');
      setTwoFactorPassword('');
    } catch (error) {
      setTwoFactorError(error.response?.data?.message || 'Failed to regenerate backup codes');
    } finally {
      setTwoFactorLoading(false);
    }
  };


  const updateSettings = async () => {
    setSaving(true);
    setSuccess(null);
    try {
      await axios.put('/admin/settings', settings);
      cacheService.invalidatePattern('admin/settings');
      cacheService.invalidatePattern('admin/dashboard');
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Save settings error:', error);
      alert(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = async () => {
    setProfileError(null);
    setProfileSuccess(null);

    // Validate password confirmation
    if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
      setProfileError('New passwords do not match');
      return;
    }

    // Check if anything changed
    const hasChanges = 
      profileForm.username !== adminProfile?.username ||
      profileForm.email !== (adminProfile?.email || '') ||
      profileForm.newPassword;

    if (!hasChanges) {
      setProfileError('No changes to save');
      return;
    }

    setProfileSaving(true);

    try {
      const updateData = {};
      
      if (profileForm.username !== adminProfile?.username) {
        updateData.username = profileForm.username;
      }
      
      if (profileForm.email !== (adminProfile?.email || '')) {
        updateData.email = profileForm.email;
      }
      
      if (profileForm.newPassword) {
        updateData.currentPassword = profileForm.currentPassword;
        updateData.newPassword = profileForm.newPassword;
      }

      const response = await axios.put('/admin/profile', updateData);
      
      setAdminProfile(response.data.admin);
      setProfileForm(prev => ({
        ...prev,
        username: response.data.admin.username || '',
        email: response.data.admin.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      
      setProfileSuccess(response.data.message || 'Profile updated successfully!');
      setTimeout(() => setProfileSuccess(null), 5000);
    } catch (error) {
      console.error('Profile update error:', error);
      setProfileError(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="loading-spinner"></div><p>Loading settings...</p></div>;
  }

  if (!settings) {
    return <div className="card"><p>Failed to load settings</p></div>;
  }

  return (
    <div>
      {success && <div className="success">{success}</div>}

      {/* Admin Profile */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon"><UserIcon /></span>
            Admin Profile
          </h2>
        </div>
        
        {profileError && <div className="error" style={{ marginBottom: '16px' }}>{profileError}</div>}
        {profileSuccess && <div className="success" style={{ marginBottom: '16px' }}>{profileSuccess}</div>}

        <div className="settings-row">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-control"
              value={profileForm.username}
              onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
              placeholder="Enter username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              placeholder="Enter email address (optional)"
            />
          </div>
        </div>

        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--admin-border)' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--admin-text-muted)' }}>Change Password</h4>
          <div className="settings-row">
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                className="form-control"
                value={profileForm.currentPassword}
                onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                placeholder="Enter current password"
              />
            </div>
          </div>
          <div className="settings-row">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-control"
                value={profileForm.newPassword}
                onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                placeholder="Enter new password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-control"
                value={profileForm.confirmPassword}
                onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <small className="text-muted" style={{ display: 'block', marginTop: '8px' }}>
            Leave password fields empty if you don't want to change the password.
          </small>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={updateProfile} 
          disabled={profileSaving}
          style={{ marginTop: '16px' }}
        >
          {profileSaving ? 'Saving...' : 'Update Profile'}
        </button>
      </div>

      {/* Two-Factor Authentication */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">🛡️</span>
            Two-Factor Authentication (2FA)
          </h2>
          {twoFactorStatus.enabled && (
            <span className="badge badge-success" style={{ marginLeft: '12px' }}>Enabled</span>
          )}
        </div>
        
        {twoFactorError && <div className="error" style={{ marginBottom: '16px' }}>{twoFactorError}</div>}
        {twoFactorSuccess && <div className="success" style={{ marginBottom: '16px' }}>{twoFactorSuccess}</div>}

        {!twoFactorStatus.enabled ? (
          // 2FA Not Enabled - Show Setup Flow
          <div>
            <p className="text-muted" style={{ marginBottom: '16px' }}>
              Add an extra layer of security to your admin account by enabling two-factor authentication with Google Authenticator or any TOTP-compatible app.
            </p>
            
            {!twoFactorSetup ? (
              // Step 1: Start Setup
              <button 
                className="btn btn-primary" 
                onClick={setup2FA}
                disabled={twoFactorLoading}
              >
                {twoFactorLoading ? 'Setting up...' : '🔐 Enable 2FA'}
              </button>
            ) : (
              // Step 2: Scan QR Code and Verify
              <div>
                <div style={{ 
                  background: 'var(--admin-card-hover)', 
                  padding: '20px', 
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Step 1: Scan QR Code</h4>
                  <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                    Open Google Authenticator and scan this QR code:
                  </p>
                  
                  {/* QR Code Display - Using Google Charts API for simplicity */}
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(twoFactorSetup.otpauthUrl)}`}
                      alt="2FA QR Code"
                      style={{ borderRadius: '8px', background: '#fff', padding: '8px' }}
                    />
                  </div>
                  
                  <p className="text-muted" style={{ fontSize: '12px', marginBottom: '8px' }}>
                    Or enter this code manually:
                  </p>
                  <div style={{ 
                    background: 'var(--admin-bg)', 
                    padding: '10px 16px', 
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    letterSpacing: '2px',
                    textAlign: 'center',
                    wordBreak: 'break-all'
                  }}>
                    {twoFactorSetup.secret}
                  </div>
                </div>
                
                <div style={{ 
                  background: 'var(--admin-card-hover)', 
                  padding: '20px', 
                  borderRadius: '12px'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Step 2: Verify & Enable</h4>
                  <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                    Enter the 6-digit code from your authenticator app and your password to enable 2FA.
                  </p>
                  
                  <div className="settings-row">
                    <div className="form-group">
                      <label className="form-label">Verification Code</label>
                      <input
                        type="text"
                        className="form-control"
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        style={{ fontFamily: 'monospace', fontSize: '18px', letterSpacing: '4px', textAlign: 'center' }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Your Password</label>
                      <input
                        type="password"
                        className="form-control"
                        value={twoFactorPassword}
                        onChange={(e) => setTwoFactorPassword(e.target.value)}
                        placeholder="Enter your password"
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button 
                      className="btn btn-primary" 
                      onClick={enable2FA}
                      disabled={twoFactorLoading || twoFactorCode.length !== 6 || !twoFactorPassword}
                    >
                      {twoFactorLoading ? 'Verifying...' : '✓ Enable 2FA'}
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => {
                        setTwoFactorSetup(null);
                        setTwoFactorCode('');
                        setTwoFactorPassword('');
                        setTwoFactorError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // 2FA Enabled - Show Status and Management Options
          <div>
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(52, 211, 153, 0.05) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              padding: '16px 20px', 
              borderRadius: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '24px' }}>✅</span>
              <div>
                <div style={{ fontWeight: '600', color: '#10b981' }}>2FA is Active</div>
                <div className="text-muted" style={{ fontSize: '13px' }}>
                  Your account is protected with two-factor authentication.
                  {twoFactorStatus.backupCodesRemaining > 0 && (
                    <span> ({twoFactorStatus.backupCodesRemaining} backup codes remaining)</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Show Backup Codes if just generated */}
            {backupCodes && (
              <div style={{ 
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '20px', 
                borderRadius: '12px',
                marginBottom: '20px'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#f59e0b' }}>
                  ⚠️ Save Your Backup Codes
                </h4>
                <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                  Keep these codes safe. Each code can only be used once if you lose access to your authenticator.
                </p>
                <div style={{ 
                  background: 'var(--admin-bg)', 
                  padding: '16px', 
                  borderRadius: '8px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                  fontFamily: 'monospace',
                  fontSize: '14px'
                }}>
                  {backupCodes.map((code, i) => (
                    <div key={i} style={{ padding: '4px 8px', background: 'var(--admin-card-hover)', borderRadius: '4px', textAlign: 'center' }}>
                      {code}
                    </div>
                  ))}
                </div>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setBackupCodes(null)}
                  style={{ marginTop: '16px' }}
                >
                  I've Saved My Codes
                </button>
              </div>
            )}
            
            {/* Management Options */}
            {!showDisable2FA ? (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowDisable2FA(true)}
                >
                  Disable 2FA
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setBackupCodes(null);
                    const pwd = prompt('Enter your password to regenerate backup codes:');
                    if (pwd) {
                      setTwoFactorPassword(pwd);
                      setTimeout(() => regenerateBackupCodes(), 100);
                    }
                  }}
                  disabled={twoFactorLoading}
                >
                  Regenerate Backup Codes
                </button>
              </div>
            ) : (
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '20px', 
                borderRadius: '12px'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#ef4444' }}>
                  ⚠️ Disable Two-Factor Authentication?
                </h4>
                <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                  This will remove 2FA protection from your account. Enter your password to confirm.
                </p>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={twoFactorPassword}
                    onChange={(e) => setTwoFactorPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn btn-danger" 
                    onClick={disable2FA}
                    disabled={twoFactorLoading || !twoFactorPassword}
                  >
                    {twoFactorLoading ? 'Disabling...' : 'Disable 2FA'}
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowDisable2FA(false);
                      setTwoFactorPassword('');
                      setTwoFactorError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* App Settings */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon"><GlobeIcon /></span>
            App Settings
          </h2>
        </div>
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label">App Name</label>
            <input
              type="text"
              className="form-control"
              value={settings.appName || ''}
              onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Currency Name</label>
            <input
              type="text"
              className="form-control"
              value={settings.currencyName || ''}
              onChange={(e) => setSettings({ ...settings, currencyName: e.target.value })}
            />
          </div>
        </div>
        <div className="settings-row" style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label className="form-label">Support Telegram Username</label>
            <input
              type="text"
              className="form-control"
              value={settings.supportTelegramId || ''}
              onChange={(e) => setSettings({ ...settings, supportTelegramId: e.target.value })}
              placeholder="e.g., @support_bot or username"
            />
            <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
              Users will be directed to this Telegram ID for support (e.g., when banned/suspended)
            </small>
          </div>
        </div>
      </div>

      {/* Currency Configuration */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon"><DollarSignIcon /></span>
            Currency Configuration
          </h2>
        </div>
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label">Currency Mode</label>
            <select
              className="form-control"
              value={settings.currencyMode || 'fiat'}
              onChange={(e) => setSettings({ ...settings, currencyMode: e.target.value })}
            >
              <option value="fiat">Fiat Currency (USD)</option>
              <option value="points">Points-Based Currency</option>
            </select>
            <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
              Fiat: Balance stored as USD. Points: Balance stored as points with conversion for withdrawals.
            </small>
          </div>
          {settings.currencyMode === 'points' && (
            <div className="form-group">
              <label className="form-label">Exchange Rate (Points per $1 USD)</label>
              <input
                type="number"
                className="form-control"
                min="1"
                step="1"
                value={settings.pointsExchangeRate || 1000}
                onChange={(e) => setSettings({ ...settings, pointsExchangeRate: parseFloat(e.target.value) || 1000 })}
                placeholder="e.g., 1000"
              />
              <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
                Example: 1000 means 1000 {settings.currencyName || 'Points'} = $1.00 USD
              </small>
            </div>
          )}
        </div>
        {settings.currencyMode === 'points' && (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <InfoIcon />
              <strong style={{ color: 'var(--primary)' }}>Exchange Rate Preview</strong>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              <div style={{ marginBottom: '4px' }}>
                • {(settings.pointsExchangeRate || 1000).toLocaleString()} {settings.currencyName || 'Points'} = $1.00 USD
              </div>
              <div style={{ marginBottom: '4px' }}>
                • 1 {settings.currencyName || 'Point'} = ${(1 / (settings.pointsExchangeRate || 1000)).toFixed(8)} USD
              </div>
              <div>
                • When users withdraw, their {settings.currencyName || 'Points'} will be converted to USD at this rate.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Faucet Settings */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon"><DropletIcon /></span>
            Faucet Settings
          </h2>
        </div>
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label">Faucet Reward</label>
            <input
              type="number"
              className="form-control"
              value={settings.faucetReward || 0}
              onChange={(e) => setSettings({ ...settings, faucetReward: parseFloat(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Cooldown (seconds)</label>
            <input
              type="number"
              className="form-control"
              value={settings.faucetCooldown || 0}
              onChange={(e) => setSettings({ ...settings, faucetCooldown: parseInt(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* Referral Settings */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon"><UsersSmallIcon /></span>
            Referral Settings
          </h2>
        </div>
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label">Referral Commission (%)</label>
            <input
              type="number"
              className="form-control"
              value={settings.referralCommission || 0}
              onChange={(e) => setSettings({ ...settings, referralCommission: parseFloat(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Welcome Bonus</label>
            <input
              type="number"
              className="form-control"
              value={settings.welcomeBonus || 0}
              onChange={(e) => setSettings({ ...settings, welcomeBonus: parseFloat(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* FaucetPay Quick Settings */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon"><ZapIcon /></span>
            FaucetPay Instant Withdrawals
          </h2>
        </div>
        <div className="form-group">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.faucetpayEnabled ?? false}
              onChange={(e) => setSettings({ ...settings, faucetpayEnabled: e.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
          <span style={{ marginLeft: '12px' }}>Enable FaucetPay Instant Withdrawals</span>
        </div>
        <p className="text-muted" style={{ fontSize: '13px', marginTop: '8px' }}>
          For full FaucetPay configuration (API key, currency, limits), go to the <strong>FaucetPay</strong> tab in the sidebar.
        </p>
        {settings.faucetpayEnabled && !settings.faucetpayApiKey && (
          <div className="error" style={{ marginTop: '8px' }}>
            ⚠️ FaucetPay is enabled but API key is not configured. Please configure it in the FaucetPay tab.
          </div>
        )}
      </div>

      {/* Platform & Adblocker Access Control */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">🛡️</span>
            Platform & Access Control
          </h2>
        </div>
        <p className="text-muted" style={{ fontSize: '13px', marginBottom: '20px' }}>
          Control which Telegram platforms can access your app and enforce adblocker restrictions. Changes apply immediately.
        </p>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '14px', color: 'var(--admin-text)' }}>
            📱 Telegram Platform Access
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--admin-card-hover)', borderRadius: '10px' }}>
              <label className="toggle-switch" style={{ marginRight: '14px' }}>
                <input
                  type="checkbox"
                  checked={settings.telegramWebEnabled ?? true}
                  onChange={(e) => setSettings({ ...settings, telegramWebEnabled: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
              <div>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>🌐 Telegram Web</div>
                <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                  Allow access from web.telegram.org and webk.telegram.org
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--admin-card-hover)', borderRadius: '10px' }}>
              <label className="toggle-switch" style={{ marginRight: '14px' }}>
                <input
                  type="checkbox"
                  checked={settings.telegramDesktopEnabled ?? true}
                  onChange={(e) => setSettings({ ...settings, telegramDesktopEnabled: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
              <div>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>💻 Telegram Desktop</div>
                <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                  Allow access from Telegram Desktop app (Windows, macOS, Linux)
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--admin-card-hover)', borderRadius: '10px' }}>
              <label className="toggle-switch" style={{ marginRight: '14px' }}>
                <input
                  type="checkbox"
                  checked={settings.telegramMobileEnabled ?? true}
                  onChange={(e) => setSettings({ ...settings, telegramMobileEnabled: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
              <div>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>📱 Telegram Mobile</div>
                <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                  Allow access from Telegram mobile apps (iOS, Android)
                </div>
              </div>
            </div>
          </div>
          <div className="error" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚠️ Warning: Disabling all platforms will block all users from accessing the app!
          </div>
        </div>

        <div style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border)' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '14px', color: 'var(--admin-text)' }}>
            🚫 Adblocker Enforcement
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--admin-card-hover)', borderRadius: '10px' }}>
            <label className="toggle-switch" style={{ marginRight: '14px' }}>
              <input
                type="checkbox"
                checked={settings.adblockerEnforcementEnabled ?? false}
                onChange={(e) => setSettings({ ...settings, adblockerEnforcementEnabled: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
            <div>
              <div style={{ fontWeight: '500', fontSize: '14px' }}>Block Users with Adblockers</div>
              <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                Users with adblockers enabled will see a full-screen message asking them to disable it
              </div>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: '12px', marginTop: '10px' }}>
            💡 Note: Adblocker detection works best on web platforms. Some mobile adblockers may not be detected.
          </p>
        </div>
      </div>

      {/* Social Media Links */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon"><LinkIcon /></span>
            Social Media Links
          </h2>
        </div>
        <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
          Add your social media links. These will be displayed on the user profile page.
        </p>
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#0088cc', display: 'flex' }}><TelegramIcon /></span>
              Telegram Channel/Group
            </label>
            <input
              type="text"
              className="form-control"
              value={settings.socialLinks?.telegram || settings.socialTelegram || ''}
              onChange={(e) => setSettings({ ...settings, socialTelegram: e.target.value })}
              placeholder="https://t.me/yourchannel"
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#000000', display: 'flex' }}><TwitterIcon /></span>
              Twitter/X
            </label>
            <input
              type="text"
              className="form-control"
              value={settings.socialLinks?.twitter || settings.socialTwitter || ''}
              onChange={(e) => setSettings({ ...settings, socialTwitter: e.target.value })}
              placeholder="https://twitter.com/yourprofile"
            />
          </div>
        </div>
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#FF0000', display: 'flex' }}><YouTubeIcon /></span>
              YouTube
            </label>
            <input
              type="text"
              className="form-control"
              value={settings.socialLinks?.youtube || settings.socialYoutube || ''}
              onChange={(e) => setSettings({ ...settings, socialYoutube: e.target.value })}
              placeholder="https://youtube.com/@yourchannel"
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#5865F2', display: 'flex' }}><DiscordIcon /></span>
              Discord
            </label>
            <input
              type="text"
              className="form-control"
              value={settings.socialLinks?.discord || settings.socialDiscord || ''}
              onChange={(e) => setSettings({ ...settings, socialDiscord: e.target.value })}
              placeholder="https://discord.gg/invite"
            />
          </div>
        </div>
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex' }}><InstagramIcon /></span>
              Instagram
            </label>
            <input
              type="text"
              className="form-control"
              value={settings.socialLinks?.instagram || settings.socialInstagram || ''}
              onChange={(e) => setSettings({ ...settings, socialInstagram: e.target.value })}
              placeholder="https://instagram.com/yourprofile"
            />
          </div>
        </div>
      </div>

      {/* Cloudflare Turnstile Settings */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">🛡️</span>
            Cloudflare Turnstile (Bot Protection)
          </h2>
        </div>
        <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
          Protect your faucet from bots using Cloudflare Turnstile. This adds CAPTCHA verification to critical actions like claiming rewards, submitting tasks, and withdrawals.
        </p>
        
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--admin-card-hover)', borderRadius: '10px', marginBottom: '20px' }}>
          <label className="toggle-switch" style={{ marginRight: '14px' }}>
            <input
              type="checkbox"
              checked={settings.turnstileEnabled ?? false}
              onChange={(e) => setSettings({ ...settings, turnstileEnabled: e.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
          <div>
            <div style={{ fontWeight: '500', fontSize: '14px' }}>Enable Turnstile Verification</div>
            <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
              Require bot verification for protected actions
            </div>
          </div>
        </div>

        <div className="settings-row">
          <div className="form-group">
            <label className="form-label">Site Key</label>
            <input
              type="text"
              className="form-control"
              value={settings.turnstileSiteKey || ''}
              onChange={(e) => setSettings({ ...settings, turnstileSiteKey: e.target.value })}
              placeholder="Enter your Turnstile Site Key"
            />
            <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
              Get this from the Cloudflare Dashboard → Turnstile
            </small>
          </div>
        </div>
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label">Secret Key</label>
            <input
              type="password"
              className="form-control"
              value={settings.turnstileSecretKey || ''}
              onChange={(e) => setSettings({ ...settings, turnstileSecretKey: e.target.value })}
              placeholder="Enter your Turnstile Secret Key"
            />
            <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
              Keep this secret! Used for server-side validation.
            </small>
          </div>
        </div>

        {settings.turnstileEnabled && (!settings.turnstileSiteKey || !settings.turnstileSecretKey) && (
          <div className="error" style={{ marginTop: '8px' }}>
            ⚠️ Turnstile is enabled but keys are not configured. Bot protection will not work until both keys are set.
          </div>
        )}

        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: 0, lineHeight: '1.5' }}>
            <strong>Protected Actions:</strong> Faucet claims, Task submissions, Manual withdrawals, FaucetPay withdrawals, Ad watching
          </p>
        </div>
      </div>

      {/* Legal Settings */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">📜</span>
            Legal & Policies
          </h2>
        </div>
        <p className="text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
          Add your privacy policy and terms & conditions. HTML formatting is supported.
        </p>
        <div className="form-group">
          <label className="form-label">Privacy Policy</label>
          <textarea
            className="form-control"
            value={settings.privacyPolicy || ''}
            onChange={(e) => setSettings({ ...settings, privacyPolicy: e.target.value })}
            placeholder="Enter your privacy policy content (HTML supported)..."
            rows={8}
            style={{ fontFamily: 'monospace', fontSize: '13px' }}
          />
          <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
            You can use HTML tags like &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt; for formatting.
          </small>
        </div>
        <div className="form-group" style={{ marginTop: '16px' }}>
          <label className="form-label">Terms & Conditions</label>
          <textarea
            className="form-control"
            value={settings.termsAndConditions || ''}
            onChange={(e) => setSettings({ ...settings, termsAndConditions: e.target.value })}
            placeholder="Enter your terms and conditions content (HTML supported)..."
            rows={8}
            style={{ fontFamily: 'monospace', fontSize: '13px' }}
          />
          <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
            You can use HTML tags like &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt; for formatting.
          </small>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ marginTop: '20px' }}>
        <button 
          className="btn btn-primary" 
          onClick={updateSettings} 
          disabled={saving}
          style={{ width: '100%' }}
        >
          {saving ? 'Saving...' : '💾 Save All Settings'}
        </button>
      </div>
    </div>
  );
}

/* ============================================
   NOTIFICATIONS TAB
   ============================================ */
function NotificationsTab() {
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('normal');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [excludeBlocked, setExcludeBlocked] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('send');
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastStats, setBroadcastStats] = useState(null);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const isMountedRef = useRef(true);

  // Fetch broadcast history
  const fetchBroadcasts = useCallback(async () => {
    setLoadingBroadcasts(true);
    try {
      const response = await axios.get('/admin/broadcasts');
      if (isMountedRef.current) {
        setBroadcasts(response.data.broadcasts || []);
        setBroadcastStats(response.data.stats);
      }
    } catch (err) {
      console.error('Fetch broadcasts error:', err);
    } finally {
      if (isMountedRef.current) {
        setLoadingBroadcasts(false);
      }
    }
  }, []);

  // Fetch broadcast estimate
  const fetchEstimate = useCallback(async () => {
    try {
      const response = await axios.get(`/admin/broadcasts/estimate?excludeBlocked=${excludeBlocked}`);
      if (isMountedRef.current) {
        setEstimate(response.data);
      }
    } catch (err) {
      console.error('Fetch estimate error:', err);
    }
  }, [excludeBlocked]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchBroadcasts();
    fetchEstimate();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchBroadcasts, fetchEstimate]);

  const sendBroadcast = async () => {
    if (!title.trim() || !message.trim()) {
      setError('Please enter both title and message');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await axios.post('/admin/notifications/broadcast', {
        title,
        message,
        priority,
        excludeBlocked
      });
      
      const result = response.data.telegram;
      if (result) {
        setSuccess(`Broadcast sent! ${result.sent || 0} delivered, ${result.failed || 0} failed${result.blocked ? `, ${result.blocked} blocked` : ''}`);
      } else {
        setSuccess('Broadcast notification saved!');
      }
      
      setTitle('');
      setMessage('');
      fetchBroadcasts(); // Refresh history
      fetchEstimate(); // Refresh estimate
      setTimeout(() => setSuccess(null), 8000);
    } catch (err) {
      console.error('Broadcast error:', err);
      setError(err.response?.data?.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: { class: 'success', label: 'Completed' },
      in_progress: { class: 'warning', label: 'In Progress' },
      failed: { class: 'danger', label: 'Failed' },
      pending: { class: 'secondary', label: 'Pending' },
      cancelled: { class: 'secondary', label: 'Cancelled' }
    };
    return badges[status] || { class: 'secondary', label: status };
  };

  return (
    <div>
      {/* Sub Tabs */}
      <div className="tab-container" style={{ marginBottom: '16px' }}>
        <button 
          className={`tab ${activeSubTab === 'send' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('send')}
        >
          <RadioIcon /> Send Broadcast
        </button>
        <button 
          className={`tab ${activeSubTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('history')}
        >
          <BarChartIcon /> Broadcast Analytics
        </button>
      </div>

      {activeSubTab === 'send' ? (
        <>
          {/* Broadcast Estimate Card */}
          {estimate && (
            <div className="card" style={{ marginBottom: '16px', background: 'var(--admin-card-bg)', border: '1px solid var(--admin-border)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px' }}>Eligible Users</div>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--admin-primary)' }}>{estimate.eligibleUsers?.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px' }}>Blocked Users</div>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#dc3545' }}>{estimate.blockedUsers?.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px' }}>Est. Time</div>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--admin-text)' }}>{estimate.estimate?.formatted}</div>
                </div>
                {estimate.estimate?.isLargeBroadcast && (
                  <div style={{ padding: '8px 12px', background: '#fff3cd', borderRadius: '6px', fontSize: '13px', color: '#856404' }}>
                    ⚠️ Large broadcast - using slower rate for Telegram compliance
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <span className="card-icon"><SendIcon /></span>
                Send Broadcast Notification
              </h2>
            </div>

            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}

            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                type="text"
                className="form-control"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea
                className="form-control"
                rows="4"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your broadcast message..."
              />
            </div>

            <div className="settings-row">
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select
                  className="form-control"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">Low (📌)</option>
                  <option value="normal">Normal (📢)</option>
                  <option value="high">High (⚠️)</option>
                  <option value="urgent">Urgent (🚨)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Options</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px' }}>
                  <input
                    type="checkbox"
                    id="excludeBlocked"
                    checked={excludeBlocked}
                    onChange={(e) => setExcludeBlocked(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <label htmlFor="excludeBlocked" style={{ margin: 0, fontSize: '14px' }}>
                    Exclude blocked users
                  </label>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={sendBroadcast}
              disabled={sending || !title.trim() || !message.trim()}
              style={{ marginTop: '8px' }}
            >
              {sending ? 'Sending...' : `Send Broadcast to ${estimate?.eligibleUsers?.toLocaleString() || 'All'} Users`}
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <span className="card-icon"><BellIcon /></span>
                Broadcast Tips
              </h2>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--admin-text-muted)' }}>
              <p style={{ marginBottom: '8px' }}>• Broadcasts are sent via Telegram to all active users</p>
              <p style={{ marginBottom: '8px' }}>• Large broadcasts (&gt;1000 users) use slower rate for Telegram compliance</p>
              <p style={{ marginBottom: '8px' }}>• Users who blocked the bot are automatically tracked and can be excluded</p>
              <p style={{ marginBottom: '8px' }}>• Use urgent priority sparingly for important updates</p>
              <p>• Check the Analytics tab to monitor delivery performance</p>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Broadcast Stats Summary */}
          {broadcastStats && (
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: '16px' }}>
              <div className="stat-card">
                <div className="stat-icon"><RadioIcon /></div>
                <div className="stat-value">{broadcastStats.totalBroadcasts || 0}</div>
                <div className="stat-label">Total Broadcasts</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><SendIcon /></div>
                <div className="stat-value">{(broadcastStats.totalMessagesSent || 0).toLocaleString()}</div>
                <div className="stat-label">Messages Sent</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><XCircleIcon /></div>
                <div className="stat-value">{(broadcastStats.totalMessagesFailed || 0).toLocaleString()}</div>
                <div className="stat-label">Failed</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"><CheckCircleIcon /></div>
                <div className="stat-value">{Math.round(broadcastStats.avgDeliveryRate || 0)}%</div>
                <div className="stat-label">Avg Delivery Rate</div>
              </div>
            </div>
          )}

          {/* Broadcast History */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <span className="card-icon"><HistoryIcon /></span>
                Broadcast History
              </h2>
              <button className="btn btn-secondary" onClick={fetchBroadcasts} style={{ width: 'auto', padding: '6px 12px' }}>
                Refresh
              </button>
            </div>

            {loadingBroadcasts ? (
              <div className="loading"><div className="loading-spinner"></div><p>Loading...</p></div>
            ) : broadcasts.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--admin-text-muted)', padding: '20px' }}>
                No broadcast history yet. Send your first broadcast!
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Sent</th>
                      <th>Failed</th>
                      <th>Rate</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadcasts.map((broadcast) => (
                      <tr 
                        key={broadcast._id} 
                        onClick={() => setSelectedBroadcast(broadcast)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{formatDate(broadcast.createdAt)}</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {broadcast.title}
                        </td>
                        <td>
                          <span className={`badge badge-${getStatusBadge(broadcast.status).class}`}>
                            {getStatusBadge(broadcast.status).label}
                          </span>
                        </td>
                        <td style={{ color: '#28a745' }}>{broadcast.stats?.totalSent || 0}</td>
                        <td style={{ color: '#dc3545' }}>{broadcast.stats?.totalFailed || 0}</td>
                        <td>{broadcast.stats?.deliveryRate || 0}%</td>
                        <td>{broadcast.durationSeconds ? `${broadcast.durationSeconds}s` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Broadcast Detail Modal */}
          {selectedBroadcast && (
            <div className="modal-overlay" onClick={() => setSelectedBroadcast(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                  <h2 className="modal-title">Broadcast Details</h2>
                  <button className="modal-close" onClick={() => setSelectedBroadcast(null)}>×</button>
                </div>
                <div className="modal-body">
                  <div style={{ marginBottom: '16px' }}>
                    <strong style={{ color: 'var(--admin-text-muted)', fontSize: '13px' }}>Title</strong>
                    <div style={{ marginTop: '4px', fontSize: '15px', color: 'var(--admin-text)' }}>{selectedBroadcast.title}</div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <strong style={{ color: 'var(--admin-text-muted)', fontSize: '13px' }}>Message</strong>
                    <div style={{ background: 'var(--admin-bg-tertiary)', padding: '12px', borderRadius: '8px', marginTop: '6px', whiteSpace: 'pre-wrap', fontSize: '14px', color: 'var(--admin-text)', border: '1px solid var(--admin-border)' }}>
                      {selectedBroadcast.message}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ textAlign: 'center', padding: '16px 12px', background: 'var(--admin-bg-tertiary)', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>{selectedBroadcast.stats?.totalSent || 0}</div>
                      <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>Sent</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px 12px', background: 'var(--admin-bg-tertiary)', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: '#ef4444' }}>{selectedBroadcast.stats?.totalFailed || 0}</div>
                      <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>Failed</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px 12px', background: 'var(--admin-bg-tertiary)', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>{selectedBroadcast.stats?.totalBlocked || 0}</div>
                      <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>Blocked</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px', padding: '16px', background: 'var(--admin-bg-tertiary)', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
                    <div><span style={{ color: 'var(--admin-text-muted)' }}>Status:</span> <span className={`badge badge-${getStatusBadge(selectedBroadcast.status).class}`}>{getStatusBadge(selectedBroadcast.status).label}</span></div>
                    <div><span style={{ color: 'var(--admin-text-muted)' }}>Priority:</span> <span style={{ color: 'var(--admin-text)', textTransform: 'capitalize' }}>{selectedBroadcast.priority}</span></div>
                    <div><span style={{ color: 'var(--admin-text-muted)' }}>Targeted:</span> <span style={{ color: 'var(--admin-text)' }}>{selectedBroadcast.stats?.totalTargeted || 0}</span></div>
                    <div><span style={{ color: 'var(--admin-text-muted)' }}>Delivery Rate:</span> <span style={{ color: 'var(--admin-text)', fontWeight: '600' }}>{selectedBroadcast.stats?.deliveryRate || 0}%</span></div>
                    <div><span style={{ color: 'var(--admin-text-muted)' }}>Duration:</span> <span style={{ color: 'var(--admin-text)' }}>{selectedBroadcast.durationSeconds ? `${selectedBroadcast.durationSeconds}s` : 'N/A'}</span></div>
                    <div><span style={{ color: 'var(--admin-text-muted)' }}>Date:</span> <span style={{ color: 'var(--admin-text)' }}>{formatDate(selectedBroadcast.createdAt)}</span></div>
                  </div>
                  {selectedBroadcast.errors && selectedBroadcast.errors.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <strong style={{ color: 'var(--admin-text-muted)', fontSize: '13px' }}>Sample Errors ({selectedBroadcast.errors.length})</strong>
                      <div style={{ maxHeight: '150px', overflow: 'auto', background: 'var(--admin-bg-tertiary)', padding: '12px', borderRadius: '8px', marginTop: '6px', fontSize: '12px', border: '1px solid var(--admin-border)' }}>
                        {selectedBroadcast.errors.slice(0, 10).map((err, idx) => (
                          <div key={idx} style={{ marginBottom: '6px', color: '#ef4444', fontFamily: 'monospace' }}>
                            {err.telegramId}: {err.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================
   ANALYTICS TAB
   ============================================ */
function AnalyticsTab() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const cacheKey = `admin/analytics?days=${days}`;
        
        const data = await cacheService.deduplicatedFetch(
          cacheKey,
          async () => {
            const response = await axios.get(`/admin/analytics?days=${days}`);
            return response.data;
          }
        );
        
        if (isMountedRef.current) {
          setAnalytics(data);
        }
      } catch (error) {
        console.error('Analytics error:', error);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };
    fetchAnalytics();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [days]);

  if (loading) {
    return <div className="loading"><div className="loading-spinner"></div><p>Loading analytics...</p></div>;
  }

  return (
    <div>
      {/* Period Selector */}
      <div className="card">
        <div style={{ display: 'flex', gap: '8px' }}>
          {[7, 14, 30].map(d => (
            <button
              key={d}
              className={`btn ${days === d ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDays(d)}
              style={{ width: 'auto' }}
            >
              Last {d} Days
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon"><TotalUsersIcon /></div>
          <div className="stat-value">{analytics?.summary?.newUsers || 0}</div>
          <div className="stat-label">New Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><EarningsIcon /></div>
          <div className="stat-value">{analytics?.summary?.totalEarnings?.toFixed(5) || '0.00000'}</div>
          <div className="stat-label">Total Earnings</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><TotalWithdrawalsIcon /></div>
          <div className="stat-value">{analytics?.summary?.totalWithdrawals?.toFixed(5) || '0.00000'}</div>
          <div className="stat-label">Withdrawals</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><AdsTodayIcon /></div>
          <div className="stat-value">{analytics?.summary?.adsWatched || 0}</div>
          <div className="stat-label">Ads Watched</div>
        </div>
      </div>

      {/* Top Referrers */}
      {analytics?.topReferrers && analytics.topReferrers.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon"><AwardIcon /></span>
              Top Referrers
            </h2>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>User</th>
                  <th>Referrals</th>
                  <th>Earnings</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topReferrers.map((user, index) => (
                  <tr key={user._id}>
                    <td>#{index + 1}</td>
                    <td>{user.username || user.telegramId}</td>
                    <td>{user.referralCount}</td>
                    <td>{user.referralEarnings?.toFixed(5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Earners */}
      {analytics?.topEarners && analytics.topEarners.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon"><TargetIcon /></span>
              Top Earners
            </h2>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>User</th>
                  <th>Total Earnings</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topEarners.map((user, index) => (
                  <tr key={user._id}>
                    <td>#{index + 1}</td>
                    <td>{user.username || user.telegramId}</td>
                    <td>{user.totalEarnings?.toFixed(5)}</td>
                    <td>{user.balance?.toFixed(5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily Stats */}
      {analytics?.dailyStats && analytics.dailyStats.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon">📊</span>
              Daily Breakdown
            </h2>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>New Users</th>
                  <th>Earnings</th>
                  <th>Withdrawals</th>
                  <th>Ads</th>
                </tr>
              </thead>
              <tbody>
                {analytics.dailyStats.map((day, index) => (
                  <tr key={index}>
                    <td>{new Date(day.date).toLocaleDateString()}</td>
                    <td>{day.users || 0}</td>
                    <td>{day.earnings?.toFixed(5) || '0.00000'}</td>
                    <td>{day.withdrawals?.toFixed(5) || '0.00000'}</td>
                    <td>{day.ads || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
