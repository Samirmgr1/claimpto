import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../common/Navbar';
import BottomNav from '../common/BottomNav';
import { useAuth, useData } from '../../context/AuthContext';

// Premium SVG Icons
const UsersIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const UsersSmallIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const CoinIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v12"/>
    <path d="M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5"/>
  </svg>
);

const LinkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

const HelpCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const TrophyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const BOT_USERNAME = process.env.REACT_APP_TELEGRAM_BOT_USERNAME || 'miniFaucet_bot';
const MINI_APP_NAME = process.env.REACT_APP_MINI_APP_NAME || 'miniFaucet';

function Referrals() {
  const { user } = useAuth();
  const { referralStats: cachedStats, fetchReferralStats } = useData();
  const [stats, setStats] = useState(cachedStats);
  const [loading, setLoading] = useState(!cachedStats);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchReferralStats();
      if (data) {
        setStats(data);
      }
    } catch (error) {
      console.error('Referral stats error:', error);
      setError(error.response?.data?.message || 'Failed to load referral data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchReferralStats]);

  useEffect(() => {
    // Use cached data immediately if available
    if (cachedStats) {
      setStats(cachedStats);
      setLoading(false);
    }
    // Fetch fresh data
    fetchStats();
  }, [fetchStats, cachedStats]);

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const shareToTelegram = () => {
    const link = stats?.referralLink || `https://t.me/${BOT_USERNAME}/${MINI_APP_NAME}?startapp=${user?.referralCode}`;
    const text = encodeURIComponent(`🎉 Join me on this awesome earning app and start earning today! Use my referral link:`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${text}`, '_blank');
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container page-content">
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading referrals...</p>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  if (error && !stats) {
    return (
      <>
        <Navbar />
        <div className="container page-content">
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div className="empty-state-icon" style={{ background: 'rgba(234, 67, 53, 0.1)' }}><AlertIcon /></div>
            <h3 style={{ marginBottom: '12px' }}>Failed to Load Referral Data</h3>
            <p className="text-muted" style={{ marginBottom: '20px' }}>{error}</p>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchStats();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <RefreshIcon /> Try Again
            </button>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  const referralLink = stats?.referralLink || `https://t.me/${BOT_USERNAME}/${MINI_APP_NAME}?startapp=${user?.referralCode}`;

  return (
    <>
      <Navbar />
      <div className="container page-content">
        {error && (
          <div className="error" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertIcon /> {error}
            <button 
              className="btn btn-sm"
              onClick={() => { setLoading(true); fetchStats(); }}
              style={{ marginLeft: 'auto' }}
            >
              Retry
            </button>
          </div>
        )}
        
        {/* Header */}
        <div className="card card-gradient" style={{ 
          padding: '24px',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
          borderRadius: '20px',
          border: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              width: '56px', 
              height: '56px', 
              minWidth: '56px',
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255,255,255,0.3)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ color: '#fff', marginBottom: '4px', fontSize: '18px', fontWeight: '700' }}>
                Referral Program
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', margin: 0 }}>
                Earn {stats?.commission || 10}% commission on friend's earnings
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <div className="stat-card" style={{ 
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '16px'
          }}>
            <div className="stat-icon" style={{ 
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
              borderRadius: '10px',
              width: '42px',
              height: '42px',
              color: 'var(--primary-color)'
            }}><UsersSmallIcon /></div>
            <div className="stat-value" style={{ fontSize: '24px', marginTop: '8px' }}>{stats?.referralCount || 0}</div>
            <div className="stat-label" style={{ fontSize: '11px' }}>Total Referrals</div>
          </div>
          <div className="stat-card" style={{ 
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '16px'
          }}>
            <div className="stat-icon" style={{ 
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(251, 191, 36, 0.12) 100%)',
              borderRadius: '10px',
              width: '42px',
              height: '42px',
              color: '#f59e0b'
            }}><CoinIcon /></div>
            <div className="stat-value" style={{ fontSize: '24px', marginTop: '8px', color: 'var(--success-color)' }}>{stats?.referralEarnings?.toFixed(5) || '0.00000'}</div>
            <div className="stat-label" style={{ fontSize: '11px' }}>Referral Earnings</div>
          </div>
        </div>

        {/* Referral Link */}
        <div className="card" style={{ 
          background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px'
        }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <h2 className="card-title">
              <span className="card-icon" style={{ 
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
                borderRadius: '10px',
                padding: '8px',
                color: 'var(--primary-color)'
              }}><LinkIcon /></span>
              Your Referral Link
            </h2>
          </div>
          
          {/* Referral Link */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '10px'
            }}>Invite Link</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
              <input
                type="text"
                className="form-control"
                value={referralLink}
                readOnly
                style={{ 
                  flex: 1, 
                  fontSize: '13px',
                  padding: '12px 14px',
                  background: 'var(--bg-primary)',
                  border: '2px solid var(--border-color)',
                  borderRadius: '10px',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              />
              <button 
                className={`btn ${copied === 'link' ? 'btn-success' : 'btn-primary'}`}
                onClick={() => copyToClipboard(referralLink, 'link')}
                style={{ 
                  width: 'auto', 
                  minWidth: '90px',
                  whiteSpace: 'nowrap', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '12px 16px',
                  margin: 0,
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
              >
                {copied === 'link' ? '✓ Copied!' : <><CopyIcon /> Copy</>}
              </button>
            </div>
          </div>

          {/* Share Button */}
          <button 
            className="btn btn-primary" 
            onClick={shareToTelegram}
            style={{ 
              width: '100%', 
              marginTop: '4px', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px',
              padding: '14px 20px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            <ShareIcon /> Share on Telegram
          </button>
        </div>

        {/* How It Works */}
        <div className="card" style={{ 
          background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px'
        }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <h2 className="card-title">
              <span className="card-icon" style={{ 
                background: 'linear-gradient(135deg, rgba(52, 168, 83, 0.15) 0%, rgba(34, 197, 94, 0.15) 100%)',
                borderRadius: '10px',
                padding: '8px',
                color: '#22c55e'
              }}><HelpCircleIcon /></span>
              How It Works
            </h2>
          </div>
          <div className="stats-list" style={{ padding: '8px 0' }}>
            <div className="stats-list-item" style={{ padding: '14px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '14px',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                }}>1</div>
                <div>
                  <strong style={{ fontSize: '14px', fontWeight: '600' }}>Share Your Link</strong>
                  <p className="text-muted" style={{ fontSize: '12px', margin: '2px 0 0', color: 'var(--text-secondary)' }}>
                    Send your referral link to friends
                  </p>
                </div>
              </div>
            </div>
            <div className="stats-list-item" style={{ padding: '14px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '14px',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                }}>2</div>
                <div>
                  <strong style={{ fontSize: '14px', fontWeight: '600' }}>Friends Join</strong>
                  <p className="text-muted" style={{ fontSize: '12px', margin: '2px 0 0', color: 'var(--text-secondary)' }}>
                    They sign up using your link
                  </p>
                </div>
              </div>
            </div>
            <div className="stats-list-item" style={{ padding: '14px 0', borderBottom: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981 0%, #22c55e 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '14px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                }}>3</div>
                <div>
                  <strong style={{ fontSize: '14px', fontWeight: '600' }}>Earn Commission</strong>
                  <p className="text-muted" style={{ fontSize: '12px', margin: '2px 0 0', color: 'var(--text-secondary)' }}>
                    Get {stats?.commission || 10}% of their earnings forever
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Referral List */}
        {stats?.referredUsers && stats.referredUsers.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <span className="card-icon" style={{ background: 'rgba(251, 188, 4, 0.1)' }}><TrophyIcon /></span>
                Your Referrals ({stats.referredUsers.length})
              </h2>
            </div>
            <div className="earnings-list">
              {stats.referredUsers.map((refUser) => (
                <div key={refUser._id} className="earning-item">
                  <div 
                    className="earning-icon"
                    style={{ background: 'var(--primary-color)', color: '#fff', fontSize: '16px' }}
                  >
                    {refUser.firstName?.[0]?.toUpperCase() || refUser.username?.[0]?.toUpperCase() || '👤'}
                  </div>
                  <div className="earning-details">
                    <div className="earning-description">
                      {refUser.username || `${refUser.firstName || ''} ${refUser.lastName || ''}`.trim() || 'User'}
                    </div>
                    <div className="earning-date">
                      Joined {new Date(refUser.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '600', color: 'var(--success-color)', fontSize: '14px' }}>
                      {refUser.totalEarnings?.toFixed(5) || '0.00000'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999' }}>Earned</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!stats?.referredUsers || stats.referredUsers.length === 0) && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon"><UsersIcon /></div>
              <h3 className="empty-state-title">No Referrals Yet</h3>
              <p className="empty-state-description">
                Share your referral link to start earning commission!
              </p>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </>
  );
}

export default Referrals;
