import React, { useState } from 'react';
import Navbar from '../common/Navbar';
import BottomNav from '../common/BottomNav';
import { useAuth, useSettings, useTheme } from '../../context/AuthContext';

// SVG Icons
const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const FileTextIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const TelegramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const YoutubeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const DiscordIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

function Profile() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { theme, toggleTheme } = useTheme();
  const [showModal, setShowModal] = useState(null);

  const currencyName = settings?.currencyName || 'Coins';
  
  // Social media links from settings
  const socialLinks = settings?.socialLinks || {};
  const privacyPolicy = settings?.privacyPolicy || '';
  const termsAndConditions = settings?.termsAndConditions || '';

  // Get Telegram user photo URL (if available from WebApp)
  const getTelegramPhotoUrl = () => {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user?.photo_url) {
        return tg.initDataUnsafe.user.photo_url;
      }
    } catch (e) {
      console.log('Could not get Telegram photo');
    }
    return null;
  };

  const telegramPhotoUrl = getTelegramPhotoUrl();

  const getInitials = () => {
    const first = user?.firstName?.[0] || '';
    const last = user?.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'U';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getSocialIcon = (platform) => {
    const icons = {
      telegram: <TelegramIcon />,
      twitter: <TwitterIcon />,
      youtube: <YoutubeIcon />,
      discord: <DiscordIcon />,
      instagram: <InstagramIcon />
    };
    return icons[platform] || <ExternalLinkIcon />;
  };

  const getSocialColor = (platform) => {
    const colors = {
      telegram: '#0088cc',
      twitter: '#000000',
      youtube: '#FF0000',
      discord: '#5865F2',
      instagram: '#E4405F'
    };
    return colors[platform] || '#666666';
  };

  const activeSocialLinks = Object.entries(socialLinks).filter(([_, url]) => url && url.trim());

  return (
    <>
      <Navbar />
      <div className="container page-content">
        {/* User Profile Card */}
        <div className="card card-gradient" style={{ 
          padding: '20px',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
          borderRadius: '20px'
        }}>
          {/* Top row: Avatar + Name + Theme Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div className="profile-avatar" style={{ 
              width: '52px',
              height: '52px',
              minWidth: '52px',
              borderRadius: '14px',
              background: telegramPhotoUrl ? 'transparent' : 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255,255,255,0.3)',
              overflow: 'hidden'
            }}>
              {telegramPhotoUrl ? (
                <img 
                  src={telegramPhotoUrl} 
                  alt="Profile" 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover' 
                  }} 
                />
              ) : (
                <span style={{ 
                  color: '#fff', 
                  fontSize: '18px', 
                  fontWeight: '700' 
                }}>
                  {getInitials()}
                </span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ 
                color: '#fff', 
                marginBottom: '2px', 
                fontSize: '17px', 
                fontWeight: '700',
                wordBreak: 'break-word'
              }}>
                {user?.firstName} {user?.lastName}
              </h2>
              {user?.username && (
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', margin: 0 }}>
                  @{user.username}
                </p>
              )}
            </div>
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              style={{
                width: '40px',
                height: '40px',
                minWidth: '40px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#fff',
                transition: 'all 0.2s ease'
              }}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
          </div>
          {/* Bottom row: Stats */}
          <div style={{ 
            display: 'flex', 
            gap: '12px',
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#fff', fontWeight: '700', fontSize: '16px', lineHeight: 1.2 }}>
                {user?.balance?.toFixed(2) || '0.00'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{currencyName}</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#fff', fontWeight: '700', fontSize: '16px', lineHeight: 1.2 }}>
                {user?.referralCount || 0}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Referrals</div>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="card" style={{ 
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px'
        }}>
          <div className="card-header" style={{ 
            paddingBottom: '14px', 
            marginBottom: '0',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <h2 className="card-title" style={{ 
              fontSize: '15px', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
                color: 'var(--primary-color)'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              Account Information
            </h2>
          </div>
          <div className="stats-list" style={{ padding: '4px 0' }}>
            <div className="stats-list-item" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <span className="stats-list-label" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>User ID</span>
              <span className="stats-list-value" style={{ fontSize: '13px', fontWeight: '500', fontFamily: 'monospace' }}>{user?.telegramId || 'N/A'}</span>
            </div>
            <div className="stats-list-item" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <span className="stats-list-label" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Joined</span>
              <span className="stats-list-value" style={{ fontSize: '13px', fontWeight: '500' }}>{formatDate(user?.createdAt)}</span>
            </div>
            <div className="stats-list-item" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <span className="stats-list-label" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Earnings</span>
              <span className="stats-list-value" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--success-color)' }}>{user?.totalEarnings?.toFixed(5) || '0.00000'} {currencyName}</span>
            </div>
            <div className="stats-list-item" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <span className="stats-list-label" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Referral Earnings</span>
              <span className="stats-list-value" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary-color)' }}>{user?.referralEarnings?.toFixed(5) || '0.00000'} {currencyName}</span>
            </div>
            <div className="stats-list-item" style={{ padding: '12px 0', borderBottom: 'none' }}>
              <span className="stats-list-label" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Status</span>
              <span className={`badge ${user?.status === 'active' ? 'badge-success' : 'badge-error'}`} style={{ padding: '4px 10px', fontSize: '11px' }}>
                {user?.status || 'active'}
              </span>
            </div>
          </div>
        </div>

        {/* Social Media Links */}
        {activeSocialLinks.length > 0 && (
          <div className="card" style={{ 
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px'
          }}>
            <div className="card-header" style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
              <h2 className="card-title" style={{ fontSize: '15px', fontWeight: '600' }}>
                Follow Us
              </h2>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {activeSocialLinks.map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: getSocialColor(platform),
                    color: '#fff',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'transform 0.2s, opacity 0.2s, box-shadow 0.2s',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
                >
                  {getSocialIcon(platform)}
                  <span style={{ textTransform: 'capitalize' }}>{platform}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Legal Links */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ fontSize: '16px' }}>
              Legal & Information
            </h2>
          </div>
          
          {privacyPolicy && (
            <div 
              className="menu-item"
              onClick={() => setShowModal('privacy')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 0',
                cursor: 'pointer',
                borderBottom: termsAndConditions ? '1px solid var(--border-color)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '8px', 
                  background: 'rgba(66, 133, 244, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary-color)'
                }}>
                  <ShieldIcon />
                </div>
                <span>Privacy Policy</span>
              </div>
              <ChevronRightIcon />
            </div>
          )}

          {termsAndConditions && (
            <div 
              className="menu-item"
              onClick={() => setShowModal('terms')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 0',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '8px', 
                  background: 'rgba(52, 168, 83, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#34a853'
                }}>
                  <FileTextIcon />
                </div>
                <span>Terms & Conditions</span>
              </div>
              <ChevronRightIcon />
            </div>
          )}

          {!privacyPolicy && !termsAndConditions && (
            <p className="text-muted" style={{ fontSize: '14px' }}>
              No legal documents available at this time.
            </p>
          )}

          {/* Contact Developer */}
          <div 
            className="menu-item"
            onClick={() => window.open('https://t.me/gemifs', '_blank')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 0',
              cursor: 'pointer',
              borderTop: (privacyPolicy || termsAndConditions) ? '1px solid var(--border-color)' : 'none',
              marginTop: (privacyPolicy || termsAndConditions) ? '0' : '0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '8px', 
                background: 'rgba(0, 136, 204, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0088cc'
              }}>
                <TelegramIcon />
              </div>
              <span>Contact Developer</span>
            </div>
            <ChevronRightIcon />
          </div>
        </div>

        {/* App Info */}
        <div className="card">
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <p className="text-muted" style={{ fontSize: '13px', marginBottom: '4px' }}>
              {settings?.appName || 'MiniFaucet'}
            </p>
            <p className="text-muted" style={{ fontSize: '12px' }}>
              Version 1.0.0
            </p>
          </div>
        </div>
      </div>

      {/* Modal for Privacy Policy / Terms */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div 
            className="modal legal-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '600px', 
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div className="modal-header" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <h3 style={{ margin: 0 }}>
                {showModal === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
              </h3>
              <button 
                onClick={() => setShowModal(null)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex'
                }}
              >
                <CloseIcon />
              </button>
            </div>
            <div 
              className="modal-content legal-content"
              style={{ 
                padding: '20px',
                overflowY: 'auto',
                flex: 1,
                fontSize: '14px',
                lineHeight: '1.6'
              }}
              dangerouslySetInnerHTML={{ 
                __html: showModal === 'privacy' ? privacyPolicy : termsAndConditions 
              }}
            />
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}

export default Profile;
