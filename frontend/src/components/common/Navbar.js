import React from 'react';
import { useAuth, useSettings } from '../../context/AuthContext';

// Premium SVG Icons
const LogoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const WalletIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

// Get Telegram user photo URL
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

function Navbar() {
  const { user } = useAuth();
  const { settings } = useSettings();
  
  const appName = settings?.appName || 'Earning App';
  const telegramPhotoUrl = getTelegramPhotoUrl();

  const getInitials = () => {
    return user?.firstName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U';
  };

  return (
    <div className="navbar">
      <div className="navbar-content">
        <div className="navbar-title">
          <span className="navbar-logo"><LogoIcon /></span>
          {appName}
        </div>
        <div className="navbar-user">
          <div className="navbar-balance">
            <span className="navbar-balance-icon"><WalletIcon /></span>
            <span style={{ fontWeight: '600' }}>{user?.balance?.toFixed(5) || '0.00000'}</span>
          </div>
          <div className="navbar-avatar" style={telegramPhotoUrl ? { padding: 0, overflow: 'hidden' } : {}}>
            {telegramPhotoUrl ? (
              <img 
                src={telegramPhotoUrl} 
                alt="Profile" 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  borderRadius: '50%'
                }} 
              />
            ) : (
              getInitials()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Navbar;
