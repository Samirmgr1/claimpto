import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminTheme } from '../../context/AdminThemeContext';
import { useAuth } from '../../context/AuthContext';
import { validateLicense, clearLicenseCache, LicenseError } from '../../services/licenseService';
import './UserDetails.css';

// ============================================
// SVG ICONS
// ============================================
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

const UserIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const DollarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const WithdrawalIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const AlertTriangleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const DeviceIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
);

const GlobeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const TaskIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const TvIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
    <polyline points="17 2 12 7 7 2"/>
  </svg>
);

const ActivityIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const XCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

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

const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

// Sidebar Navigation Icons
const DashboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
  </svg>
);

const TasksIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);

const WithdrawalsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const FaucetPayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const NotificationsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const AnalyticsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

// ============================================
// UTILITY FUNCTIONS
// ============================================
const formatDate = (date) => {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDateShort = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const getStatusColor = (status) => {
  switch (status) {
    case 'active': return 'success';
    case 'suspended': return 'warning';
    case 'banned': return 'danger';
    case 'approved': return 'success';
    case 'pending': return 'warning';
    case 'rejected': return 'danger';
    case 'completed': return 'success';
    default: return 'secondary';
  }
};

const getTrustScoreColor = (score) => {
  if (score >= 75) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
};

const getSeverityColor = (severity) => {
  switch (severity) {
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    case 'low': return '#3b82f6';
    case 'info': return '#6b7280';
    default: return '#6b7280';
  }
};

// ============================================
// MAIN COMPONENT
// ============================================
function UserDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { admin, logout } = useAuth();
  const { toggleTheme, isDark } = useAdminTheme();
  
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // License state
  const [licenseStatus, setLicenseStatus] = useState({
    checking: true,
    valid: false,
    error: null
  });

  // Check license
  useEffect(() => {
    if (!admin) {
      navigate('/admin/login');
      return;
    }

    const checkLicense = async () => {
      try {
        const result = await validateLicense(false);
        setLicenseStatus({
          checking: false,
          valid: result.valid,
          error: result.error
        });
      } catch (err) {
        setLicenseStatus({
          checking: false,
          valid: false,
          error: 'VALIDATION_ERROR'
        });
      }
    };
    checkLicense();
  }, [admin, navigate]);

  // Fetch user details
  const fetchUserDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/admin/users/${id}/details`);
      setUserData(response.data);
    } catch (err) {
      console.error('Failed to fetch user details:', err);
      setError(err.response?.data?.message || 'Failed to load user details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (licenseStatus.valid) {
      fetchUserDetails();
    }
  }, [fetchUserDetails, licenseStatus.valid]);

  const handleLogout = () => {
    logout();
    clearLicenseCache();
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  const handleBack = () => {
    navigate('/admin');
  };

  const updateUserStatus = async (status, reason = '') => {
    setActionLoading(true);
    try {
      await axios.patch(`/admin/users/${id}/status`, { status, reason });
      await fetchUserDetails();
      setShowStatusModal(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const adjustBalance = async (amount, type, reason) => {
    setActionLoading(true);
    try {
      await axios.patch(`/admin/users/${id}/balance`, { amount, type, reason });
      await fetchUserDetails();
      setShowBalanceModal(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to adjust balance');
    } finally {
      setActionLoading(false);
    }
  };

  const resetCooldown = async () => {
    if (!window.confirm('Reset faucet cooldown for this user?')) return;
    setActionLoading(true);
    try {
      await axios.patch(`/admin/users/${id}/reset-cooldown`);
      await fetchUserDetails();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reset cooldown');
    } finally {
      setActionLoading(false);
    }
  };

  // License check loading
  if (licenseStatus.checking) {
    return null;
  }

  // License invalid
  if (!licenseStatus.valid) {
    const errorInfo = LicenseError[licenseStatus.error] || LicenseError.VALIDATION_ERROR;
    return (
      <div className="user-details-license-error">
        <div className="license-error-card">
          <h2>{errorInfo.title}</h2>
          <p>{errorInfo.message}</p>
          <button className="btn btn-primary" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'overview', label: 'Overview', icon: <UserIcon /> },
    { id: 'earnings', label: 'Earnings', icon: <DollarIcon /> },
    { id: 'withdrawals', label: 'Withdrawals', icon: <WithdrawalIcon /> },
    { id: 'security', label: 'Security', icon: <ShieldIcon /> },
    { id: 'tasks', label: 'Tasks', icon: <TaskIcon /> },
    { id: 'referrals', label: 'Referrals', icon: <UsersIcon /> },
    { id: 'ads', label: 'Ads', icon: <TvIcon /> },
  ];

  // Sidebar navigation tabs (same as AdminDashboard)
  const sidebarTabs = [
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

  const handleSidebarNavClick = (tabId) => {
    // Navigate back to admin dashboard with the selected tab
    navigate('/admin', { state: { activeTab: tabId } });
  };

  return (
    <div className={`admin-layout ${isDark ? 'dark-theme' : ''}`}>
      {/* Sidebar */}
      <div className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <FaucetPayIcon />
            <span>Admin Panel</span>
          </div>
        </div>
        <nav className="admin-nav">
          {sidebarTabs.map(tab => (
            <button
              key={tab.id}
              className={`admin-nav-item ${tab.id === 'users' ? 'active' : ''}`}
              onClick={() => handleSidebarNavClick(tab.id)}
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
            <button className="btn-back" onClick={handleBack}>
              <ArrowLeftIcon />
              <span>Back to Users</span>
            </button>
          </div>
          <div className="admin-header-actions">
            <button className="header-action-btn" onClick={() => fetchUserDetails()} title="Refresh">
              <RefreshIcon />
            </button>
            <button className="header-action-btn theme-toggle" onClick={toggleTheme} title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </header>

        <div className="admin-content">
          {/* Loading / Error States */}
          {loading && (
            <div className="user-details-loading">
              <div className="loading-spinner"></div>
              <p>Loading user details...</p>
            </div>
          )}

          {error && (
            <div className="user-details-error">
              <AlertTriangleIcon />
              <h3>Error Loading User</h3>
              <p>{error}</p>
              <button className="btn btn-primary" onClick={fetchUserDetails}>Retry</button>
            </div>
          )}

          {/* Main Content */}
          {!loading && !error && userData && (
            <div className="user-details-content">
          {/* User Profile Header */}
          <div className="user-profile-header">
            <div className="user-avatar">
              {userData.profile.firstName?.[0] || userData.profile.username?.[0] || 'U'}
            </div>
            <div className="user-info">
              <h1>{userData.profile.username || `${userData.profile.firstName || ''} ${userData.profile.lastName || ''}`.trim() || 'Unknown User'}</h1>
              <p className="user-telegram-id">Telegram ID: {userData.profile.telegramId}</p>
              <div className="user-badges">
                <span className={`badge badge-${getStatusColor(userData.profile.status)}`}>
                  {userData.profile.status}
                </span>
                <span className={`badge trust-badge trust-${userData.trustIndicators.level}`}>
                  Trust: {userData.trustIndicators.score}%
                </span>
              </div>
            </div>
            <div className="user-actions">
              <button className="btn btn-primary" onClick={() => setShowBalanceModal(true)}>
                Adjust Balance
              </button>
              <button className="btn btn-secondary" onClick={() => setShowStatusModal(true)}>
                Change Status
              </button>
              <button className="btn btn-outline" onClick={resetCooldown} disabled={actionLoading}>
                Reset Cooldown
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="quick-stats">
            <div className="stat-box">
              <div className="stat-label">Balance</div>
              <div className="stat-value">{userData.profile.balance?.toFixed(5) || '0.00000'}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Total Earned</div>
              <div className="stat-value">{userData.profile.totalEarnings?.toFixed(5) || '0.00000'}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Total Withdrawn</div>
              <div className="stat-value">{userData.withdrawals.totalWithdrawn?.toFixed(5) || '0.00000'}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Referrals</div>
              <div className="stat-value">{userData.referrals.count}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Joined</div>
              <div className="stat-value">{formatDateShort(userData.profile.createdAt)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Last Login</div>
              <div className="stat-value">{formatDateShort(userData.profile.lastLogin)}</div>
            </div>
          </div>

          {/* Section Navigation */}
          <div className="section-nav">
            {sections.map(section => (
              <button
                key={section.id}
                className={`section-nav-btn ${activeSection === section.id ? 'active' : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            ))}
          </div>

          {/* Section Content */}
          <div className="section-content">
            {activeSection === 'overview' && <OverviewSection data={userData} />}
            {activeSection === 'earnings' && <EarningsSection data={userData.earnings} />}
            {activeSection === 'withdrawals' && <WithdrawalsSection data={userData.withdrawals} />}
            {activeSection === 'security' && <SecuritySection data={userData.security} trust={userData.trustIndicators} />}
            {activeSection === 'tasks' && <TasksSection data={userData.tasks} />}
            {activeSection === 'referrals' && <ReferralsSection data={userData.referrals} />}
            {activeSection === 'ads' && <AdsSection data={userData.ads} />}
              </div>
            </div>
          )}

          {/* Modals */}
          {showBalanceModal && (
            <BalanceModal 
              onClose={() => setShowBalanceModal(false)}
              onSubmit={adjustBalance}
              loading={actionLoading}
              currentBalance={userData?.profile.balance || 0}
            />
          )}
          {showStatusModal && (
            <StatusModal 
              onClose={() => setShowStatusModal(false)}
              onSubmit={updateUserStatus}
              loading={actionLoading}
              currentStatus={userData?.profile.status}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// SECTION COMPONENTS
// ============================================

function OverviewSection({ data }) {
  return (
    <div className="overview-section">
      {/* Trust Indicators */}
      <div className="card trust-card">
        <div className="card-header">
          <h3><ShieldIcon /> Trust & Risk Assessment</h3>
        </div>
        <div className="card-body">
          <div className="trust-score-display">
            <div 
              className="trust-score-circle"
              style={{ 
                borderColor: getTrustScoreColor(data.trustIndicators.score),
                color: getTrustScoreColor(data.trustIndicators.score)
              }}
            >
              {data.trustIndicators.score}
            </div>
            <div className="trust-details">
              <span className={`trust-level trust-level-${data.trustIndicators.level}`}>
                {data.trustIndicators.level.toUpperCase()} TRUST
              </span>
              <div className="trust-metrics">
                <span>Activity: {data.trustIndicators.metrics.activityConsistency}%</span>
                <span>Last seen: {data.trustIndicators.metrics.daysSinceLastLogin}d ago</span>
                <span>Shared IP users: {data.trustIndicators.metrics.usersWithSameIP}</span>
              </div>
            </div>
          </div>

          {data.trustIndicators.flags.length > 0 && (
            <div className="trust-flags">
              <h4>Flags & Warnings</h4>
              <div className="flags-list">
                {data.trustIndicators.flags.map((flag, i) => (
                  <div key={i} className="flag-item" style={{ borderLeftColor: getSeverityColor(flag.severity) }}>
                    <AlertTriangleIcon />
                    <div className="flag-content">
                      <span className="flag-name">{flag.flag.replace(/_/g, ' ')}</span>
                      <span className="flag-detail">{flag.detail}</span>
                    </div>
                    <span className={`flag-severity severity-${flag.severity}`}>{flag.severity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.trustIndicators.flags.length === 0 && (
            <div className="no-flags">
              <CheckCircleIcon /> No suspicious activity detected
            </div>
          )}
        </div>
      </div>

      {/* Profile Details */}
      <div className="card">
        <div className="card-header">
          <h3><UserIcon /> Profile Details</h3>
        </div>
        <div className="card-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Username</span>
              <span className="detail-value">{data.profile.username || 'Not set'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">First Name</span>
              <span className="detail-value">{data.profile.firstName || 'Not set'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Last Name</span>
              <span className="detail-value">{data.profile.lastName || 'Not set'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Telegram ID</span>
              <span className="detail-value">{data.profile.telegramId}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Referral Code</span>
              <span className="detail-value code">{data.profile.referralCode}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Referred By</span>
              <span className="detail-value">
                {data.profile.referredBy 
                  ? `${data.profile.referredBy.username || data.profile.referredBy.telegramId}`
                  : 'None'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Account Created</span>
              <span className="detail-value">{formatDate(data.profile.createdAt)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Last Login</span>
              <span className="detail-value">{formatDate(data.profile.lastLogin)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Last Faucet Claim</span>
              <span className="detail-value">{formatDate(data.profile.lastFaucetClaim)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Current IP</span>
              <span className="detail-value code">{data.profile.currentIP || 'Unknown'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Earnings Summary by Type */}
      <div className="card">
        <div className="card-header">
          <h3><ActivityIcon /> Earnings by Type</h3>
        </div>
        <div className="card-body">
          <div className="earnings-summary-grid">
            {data.earnings.summary.map((item, i) => (
              <div key={i} className="earning-type-card">
                <div className="earning-type-name">{item._id}</div>
                <div className="earning-type-value">{item.total?.toFixed(5)}</div>
                <div className="earning-type-count">{item.count} transactions</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EarningsSection({ data }) {
  const [filter, setFilter] = useState('all');
  
  const filteredEarnings = filter === 'all' 
    ? data.recent 
    : data.recent.filter(e => e.type === filter);

  const earningTypes = ['all', ...new Set(data.recent.map(e => e.type))];

  return (
    <div className="earnings-section">
      <div className="card">
        <div className="card-header">
          <h3><DollarIcon /> Recent Earnings</h3>
          <select 
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {earningTypes.map(type => (
              <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredEarnings.map((earning, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`badge badge-${earning.type}`}>{earning.type}</span>
                    </td>
                    <td>{earning.description || earning.taskId?.title || '-'}</td>
                    <td className="amount-cell">+{earning.amount?.toFixed(5)}</td>
                    <td><ClockIcon /> {formatDate(earning.createdAt)}</td>
                  </tr>
                ))}
                {filteredEarnings.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-row">No earnings found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Daily Earnings Chart */}
      <div className="card">
        <div className="card-header">
          <h3><ActivityIcon /> Daily Earnings (Last 30 Days)</h3>
        </div>
        <div className="card-body">
          <div className="daily-chart">
            {data.dailyHistory.slice(0, 14).map((day, i) => (
              <div key={i} className="chart-bar-container">
                <div 
                  className="chart-bar"
                  style={{ 
                    height: `${Math.min(100, (day.total / (Math.max(...data.dailyHistory.map(d => d.total)) || 1)) * 100)}%`
                  }}
                  title={`${day._id}: ${day.total?.toFixed(5)} (${day.count} txns)`}
                ></div>
                <span className="chart-label">{new Date(day._id).getDate()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WithdrawalsSection({ data }) {
  return (
    <div className="withdrawals-section">
      {/* Summary Cards */}
      <div className="summary-cards">
        {data.summary.map((item, i) => (
          <div key={i} className={`summary-card summary-${item._id}`}>
            <div className="summary-status">{item._id}</div>
            <div className="summary-amount">{item.total?.toFixed(5)}</div>
            <div className="summary-count">{item.count} requests</div>
          </div>
        ))}
      </div>

      {/* Withdrawal History */}
      <div className="card">
        <div className="card-header">
          <h3><WithdrawalIcon /> Withdrawal History</h3>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Processed</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((w, i) => (
                  <tr key={i}>
                    <td className="amount-cell">{w.amount?.toFixed(5)}</td>
                    <td>{w.withdrawalMethod?.name || w.method || 'N/A'}</td>
                    <td>
                      <span className={`badge badge-${getStatusColor(w.status)}`}>{w.status}</span>
                    </td>
                    <td>{formatDate(w.requestedAt)}</td>
                    <td>{w.processedAt ? formatDate(w.processedAt) : '-'}</td>
                  </tr>
                ))}
                {data.history.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-row">No withdrawals found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecuritySection({ data, trust }) {
  return (
    <div className="security-section">
      {/* Device Information */}
      <div className="card">
        <div className="card-header">
          <h3><DeviceIcon /> Devices Used ({data.devices.length})</h3>
        </div>
        <div className="card-body">
          <div className="devices-list">
            {data.devices.map((device, i) => (
              <div key={i} className="device-item">
                <div className="device-icon">
                  {device.deviceType === 'Mobile' ? '📱' : device.deviceType === 'Tablet' ? '📱' : '💻'}
                </div>
                <div className="device-info">
                  <div className="device-name">{device.browser} on {device.os}</div>
                  <div className="device-details">
                    <span>{device.deviceType}</span>
                    <span>Used {device.usageCount} times</span>
                    <span>From {device.uniqueIPs} IPs</span>
                  </div>
                  <div className="device-last-used">
                    <ClockIcon /> Last used: {formatDate(device.lastUsed)}
                  </div>
                </div>
              </div>
            ))}
            {data.devices.length === 0 && (
              <div className="empty-message">No device information available</div>
            )}
          </div>
        </div>
      </div>

      {/* IP History */}
      <div className="card">
        <div className="card-header">
          <h3><GlobeIcon /> IP Address History ({data.ipHistory.length})</h3>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>Usage Count</th>
                  <th>First Seen</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {data.ipHistory.map((ip, i) => (
                  <tr key={i}>
                    <td className="code">{ip._id}</td>
                    <td>{ip.count} times</td>
                    <td>{formatDate(ip.firstUsed)}</td>
                    <td>{formatDate(ip.lastUsed)}</td>
                  </tr>
                ))}
                {data.ipHistory.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-row">No IP history available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Security Metrics */}
      <div className="card">
        <div className="card-header">
          <h3><ShieldIcon /> Security Metrics</h3>
        </div>
        <div className="card-body">
          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">Unique IPs</span>
              <span className="metric-value">{data.uniqueIPCount}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Unique Devices</span>
              <span className="metric-value">{data.uniqueDeviceCount}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Current IP</span>
              <span className="metric-value code">{data.currentIP || 'Unknown'}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Users on Same IP</span>
              <span className={`metric-value ${trust.metrics.usersWithSameIP > 1 ? 'warning' : ''}`}>
                {trust.metrics.usersWithSameIP}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TasksSection({ data }) {
  const getTaskStatusStats = () => {
    const stats = { pending: 0, approved: 0, rejected: 0 };
    data.stats.forEach(s => {
      if (stats.hasOwnProperty(s._id)) {
        stats[s._id] = s.count;
      }
    });
    return stats;
  };

  const stats = getTaskStatusStats();

  return (
    <div className="tasks-section">
      {/* Stats */}
      <div className="task-stats">
        <div className="task-stat-card stat-pending">
          <div className="stat-icon"><ClockIcon /></div>
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="task-stat-card stat-approved">
          <div className="stat-icon"><CheckCircleIcon /></div>
          <div className="stat-value">{stats.approved}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="task-stat-card stat-rejected">
          <div className="stat-icon"><XCircleIcon /></div>
          <div className="stat-value">{stats.rejected}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {/* Task Submissions */}
      <div className="card">
        <div className="card-header">
          <h3><TaskIcon /> Task Submissions</h3>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Reward</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {data.submissions.map((sub, i) => (
                  <tr key={i}>
                    <td>{sub.task?.title || 'Unknown Task'}</td>
                    <td>{sub.task?.reward?.toFixed(5) || '0'}</td>
                    <td>
                      <span className={`badge badge-${getStatusColor(sub.status)}`}>{sub.status}</span>
                    </td>
                    <td>{formatDate(sub.submittedAt || sub.createdAt)}</td>
                  </tr>
                ))}
                {data.submissions.length === 0 && (
                  <tr>
                    <td colSpan="4" className="empty-row">No task submissions found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReferralsSection({ data }) {
  return (
    <div className="referrals-section">
      {/* Summary */}
      <div className="referral-summary">
        <div className="summary-card">
          <div className="summary-label">Total Referrals</div>
          <div className="summary-value">{data.count}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Referral Earnings</div>
          <div className="summary-value">{data.totalEarnings?.toFixed(5) || '0.00000'}</div>
        </div>
      </div>

      {/* Referral List */}
      <div className="card">
        <div className="card-header">
          <h3><UsersIcon /> Referred Users</h3>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Telegram ID</th>
                  <th>Status</th>
                  <th>Total Earned</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.list.map((ref, i) => (
                  <tr key={i}>
                    <td>{ref.username || `${ref.firstName || ''} ${ref.lastName || ''}`.trim() || 'Unknown'}</td>
                    <td>{ref.telegramId}</td>
                    <td>
                      <span className={`badge badge-${getStatusColor(ref.status)}`}>{ref.status}</span>
                    </td>
                    <td>{ref.totalEarnings?.toFixed(5) || '0'}</td>
                    <td>{formatDateShort(ref.createdAt)}</td>
                  </tr>
                ))}
                {data.list.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-row">No referrals found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdsSection({ data }) {
  // Group stats by provider
  const providerStats = {};
  data.stats.forEach(s => {
    const provider = s._id.provider;
    if (!providerStats[provider]) {
      providerStats[provider] = { completed: 0, failed: 0, totalReward: 0 };
    }
    if (s._id.status === 'completed') {
      providerStats[provider].completed = s.count;
      providerStats[provider].totalReward = s.totalReward;
    } else if (s._id.status === 'failed') {
      providerStats[provider].failed = s.count;
    }
  });

  return (
    <div className="ads-section">
      <div className="card">
        <div className="card-header">
          <h3><TvIcon /> Ad Statistics by Provider</h3>
        </div>
        <div className="card-body">
          <div className="ads-provider-grid">
            {Object.entries(providerStats).map(([provider, stats]) => (
              <div key={provider} className="provider-card">
                <div className="provider-name">{provider}</div>
                <div className="provider-stats">
                  <div className="provider-stat">
                    <span className="stat-label">Completed</span>
                    <span className="stat-value success">{stats.completed}</span>
                  </div>
                  <div className="provider-stat">
                    <span className="stat-label">Failed</span>
                    <span className="stat-value danger">{stats.failed}</span>
                  </div>
                  <div className="provider-stat">
                    <span className="stat-label">Total Earned</span>
                    <span className="stat-value">{stats.totalReward?.toFixed(5)}</span>
                  </div>
                </div>
              </div>
            ))}
            {Object.keys(providerStats).length === 0 && (
              <div className="empty-message">No ad activity found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MODAL COMPONENTS
// ============================================

function BalanceModal({ onClose, onSubmit, loading, currentBalance }) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('add');
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) < 0) return;
    onSubmit(parseFloat(amount), type, reason);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Adjust Balance</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="current-balance">Current Balance: <strong>{currentBalance?.toFixed(5)}</strong></p>
            
            <div className="form-group">
              <label>Action</label>
              <select 
                className="form-control"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="add">Add Balance</option>
                <option value="subtract">Subtract Balance</option>
                <option value="set">Set Balance To</option>
              </select>
            </div>

            <div className="form-group">
              <label>Amount</label>
              <input
                type="number"
                className="form-control"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00000"
                step="0.00001"
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label>Reason (optional)</label>
              <input
                type="text"
                className="form-control"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Admin adjustment"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !amount}>
              {loading ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatusModal({ onClose, onSubmit, loading, currentStatus }) {
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(status, reason);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Change User Status</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p>Current Status: <span className={`badge badge-${getStatusColor(currentStatus)}`}>{currentStatus}</span></p>
            
            <div className="form-group">
              <label>New Status</label>
              <div className="status-buttons">
                <button
                  type="button"
                  className={`status-btn status-active ${status === 'active' ? 'selected' : ''}`}
                  onClick={() => setStatus('active')}
                >
                  Active
                </button>
                <button
                  type="button"
                  className={`status-btn status-suspended ${status === 'suspended' ? 'selected' : ''}`}
                  onClick={() => setStatus('suspended')}
                >
                  Suspended
                </button>
                <button
                  type="button"
                  className={`status-btn status-banned ${status === 'banned' ? 'selected' : ''}`}
                  onClick={() => setStatus('banned')}
                >
                  Banned
                </button>
              </div>
            </div>

            {status !== 'active' && (
              <div className="form-group">
                <label>Reason</label>
                <textarea
                  className="form-control"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide a reason for this action..."
                  rows="3"
                />
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button 
              type="submit" 
              className={`btn btn-${status === 'active' ? 'success' : status === 'suspended' ? 'warning' : 'danger'}`}
              disabled={loading || status === currentStatus}
            >
              {loading ? 'Processing...' : `Set to ${status}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UserDetails;
