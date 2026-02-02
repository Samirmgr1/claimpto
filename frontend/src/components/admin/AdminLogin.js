import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useAdminTheme } from '../../context/AdminThemeContext';

// ============================================
// LICENSE ENFORCEMENT - ADMIN LOGIN GATE
// ============================================
// SECURITY: Admin login will fail if the license is invalid.
// The server validates the license before issuing an admin token.
// License errors are displayed with specific messaging.
// ============================================

// Icons
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

const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

const UserPlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="8.5" cy="7" r="4"/>
    <line x1="20" y1="8" x2="20" y2="14"/>
    <line x1="23" y1="11" x2="17" y2="11"/>
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

function AdminLogin() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [error, setError] = useState(null);
  const [licenseError, setLicenseError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAdminEmpty, setIsAdminEmpty] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const { loginAdmin } = useAuth();
  const { isDark, toggleTheme } = useAdminTheme();
  const navigate = useNavigate();

  // Check if admin collection is empty on mount
  useEffect(() => {
    const checkAdminEmpty = async () => {
      try {
        const response = await axios.get('/admin/check-empty');
        setIsAdminEmpty(response.data.isEmpty);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdminEmpty(false);
      } finally {
        setCheckingAdmin(false);
      }
    };
    checkAdminEmpty();
  }, []);

  const handleCreateAdmin = async () => {
    setCreatingAdmin(true);
    setError(null);
    try {
      const response = await axios.post('/admin/init-admin');
      if (response.data.success) {
        setAdminCredentials(response.data.credentials);
        setIsAdminEmpty(false);
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create admin user');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleCopyCredentials = () => {
    const text = `Username: ${adminCredentials.username}\nPassword: ${adminCredentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinueToLogin = () => {
    setFormData({ 
      username: adminCredentials.username, 
      password: adminCredentials.password 
    });
    setAdminCredentials(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLicenseError(null);

    try {
      const payload = { ...formData };
      if (twoFactorRequired && twoFactorCode) {
        payload.twoFactorCode = twoFactorCode;
      }
      
      const response = await axios.post('/admin/login', payload);
      
      // Check if 2FA is required
      if (response.data.twoFactorRequired) {
        setTwoFactorRequired(true);
        setLoading(false);
        return;
      }
      
      localStorage.setItem('adminToken', response.data.token);
      loginAdmin(response.data.admin);
      navigate('/admin');
    } catch (error) {
      const data = error.response?.data || {};
      
      // Check if this is a license error
      if (data.licenseError || data.error?.includes('LICENSE') || data.error?.includes('license')) {
        setLicenseError({
          error: data.error || 'LICENSE_INVALID',
          message: data.message || 'License validation failed. Admin access denied.'
        });
      } else if (data.twoFactorRequired) {
        // 2FA code was invalid
        setError(data.message || 'Invalid two-factor authentication code');
      } else {
        setError(data.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setTwoFactorRequired(false);
    setTwoFactorCode('');
    setError(null);
  };

  return (
    <div className={`admin-login-wrapper ${isDark ? 'dark-theme' : ''}`}>
      <button className="admin-login-theme-toggle" onClick={toggleTheme}>
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
      
      <div className="admin-login-card">
        {/* Loading State */}
        {checkingAdmin ? (
          <div className="admin-login-header">
            <div className="admin-login-icon">⏳</div>
            <h2>Loading...</h2>
            <p>Checking admin status</p>
          </div>
        ) : adminCredentials ? (
          /* Admin Credentials Display */
          <>
            <div className="admin-login-header">
              <div className="admin-login-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                ✅
              </div>
              <h2>Admin Created!</h2>
              <p>Save these credentials securely</p>
            </div>
            
            <div className="admin-credentials-display">
              <div className="credential-item">
                <label>Username</label>
                <div className="credential-value">{adminCredentials.username}</div>
              </div>
              <div className="credential-item">
                <label>Password</label>
                <div className="credential-value" style={{ fontFamily: 'monospace', letterSpacing: '1px' }}>
                  {adminCredentials.password}
                </div>
              </div>
              
              <button 
                type="button" 
                className="btn btn-secondary admin-login-btn"
                onClick={handleCopyCredentials}
                style={{ marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <CopyIcon /> {copied ? 'Copied!' : 'Copy Credentials'}
              </button>
              
              <button 
                type="button" 
                className="btn btn-primary admin-login-btn"
                onClick={handleContinueToLogin}
                style={{ marginTop: '10px' }}
              >
                🔐 Continue to Login
              </button>
            </div>
            
            <div className="admin-login-warning" style={{ 
              marginTop: '20px', 
              padding: '12px', 
              background: isDark ? 'rgba(234, 179, 8, 0.1)' : 'rgba(234, 179, 8, 0.15)', 
              borderRadius: '8px',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              fontSize: '13px',
              color: isDark ? '#fbbf24' : '#b45309'
            }}>
              ⚠️ <strong>Important:</strong> Save these credentials now. The password cannot be recovered!
            </div>
          </>
        ) : isAdminEmpty ? (
          /* Create Admin UI */
          <>
            <div className="admin-login-header">
              <div className="admin-login-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
                <UserPlusIcon />
              </div>
              <h2>Setup Admin</h2>
              <p>No admin user found. Create one to get started.</p>
            </div>
            
            {error && (
              <div className="admin-login-error">
                <span>❌</span> {error}
              </div>
            )}
            
            <button 
              type="button" 
              className="btn btn-primary admin-login-btn"
              onClick={handleCreateAdmin}
              disabled={creatingAdmin}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {creatingAdmin ? (
                <>
                  <div className="loading-spinner" style={{ width: '18px', height: '18px' }}></div>
                  Creating Admin...
                </>
              ) : (
                <>
                  <UserPlusIcon /> Create Admin User
                </>
              )}
            </button>
            
            <p className="admin-login-footer">
              🔒 A secure password will be generated automatically
            </p>
          </>
        ) : (
          /* Normal Login UI */
          <>
            <div className="admin-login-header">
              {twoFactorRequired ? (
                <>
                  <div className="admin-login-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                    <ShieldIcon />
                  </div>
                  <h2>Two-Factor Authentication</h2>
                  <p>Enter the code from your authenticator app</p>
                </>
              ) : (
                <>
                  <div className="admin-login-icon">⚡</div>
                  <h2>Admin Login</h2>
                  <p>Sign in to access the admin panel</p>
                </>
              )}
            </div>
            
            {/* License Error Display */}
            {licenseError && (
              <div className="admin-login-license-error">
                <div className="license-error-icon">🚫</div>
                <h3>License Error</h3>
                <p>{licenseError.message}</p>
                <small>Error Code: {licenseError.error}</small>
              </div>
            )}
            
            {/* Regular Login Error */}
            {error && !licenseError && (
              <div className="admin-login-error">
                <span>❌</span> {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
          {!twoFactorRequired ? (
            <>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Enter your username"
                  required
                  disabled={licenseError !== null}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter your password"
                  required
                  disabled={licenseError !== null}
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Authentication Code</label>
                <input
                  type="text"
                  className="form-control"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\s/g, ''))}
                  placeholder="Enter 6-digit code"
                  maxLength={8}
                  autoFocus
                  style={{ 
                    textAlign: 'center', 
                    fontSize: '20px', 
                    letterSpacing: '8px',
                    fontFamily: 'monospace'
                  }}
                />
                <small className="text-muted" style={{ display: 'block', marginTop: '8px', textAlign: 'center' }}>
                  Enter the code from Google Authenticator or a backup code
                </small>
              </div>
            </>
          )}
          
          <button 
            type="submit" 
            className="btn btn-primary admin-login-btn" 
            disabled={loading || licenseError !== null}
          >
            {loading ? (
              <>
                <div className="loading-spinner" style={{ width: '18px', height: '18px', marginRight: '8px' }}></div>
                {twoFactorRequired ? 'Verifying...' : 'Signing in...'}
              </>
            ) : licenseError ? (
              <>🚫 Access Denied</>
            ) : twoFactorRequired ? (
              <>🔐 Verify & Sign In</>
            ) : (
              <>🔐 Sign In</>
            )}
          </button>
          
          {twoFactorRequired && (
            <button 
              type="button"
              className="btn btn-secondary admin-login-btn"
              onClick={handleBackToLogin}
              style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <BackIcon /> Back to Login
            </button>
          )}
        </form>
        
        <p className="admin-login-footer">
          🔒 Protected Admin Area
        </p>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminLogin;
