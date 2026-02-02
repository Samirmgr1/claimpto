import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// Premium SVG Icons
const HomeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9,22 9,12 15,12 15,22"/>
  </svg>
);

const EarningsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v12"/>
    <path d="M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5"/>
  </svg>
);

const TasksIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);

const AdsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <path d="M8 21h8"/>
    <path d="M12 17v4"/>
    <polygon points="10,8 10,12 14,10"/>
  </svg>
);

const ReferralsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const WithdrawIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
    <path d="M12 15l3-3m0 0l-3-3m3 3H9"/>
  </svg>
);

const ProfileIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

function BottomNav() {
  const location = useLocation();

  return (
    <div className="bottom-nav">
      <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
        <div className="nav-icon"><HomeIcon /></div>
        <div>Home</div>
      </Link>
      <Link to="/earnings" className={`nav-item ${location.pathname === '/earnings' ? 'active' : ''}`}>
        <div className="nav-icon"><EarningsIcon /></div>
        <div>Earn</div>
      </Link>
      <Link to="/tasks" className={`nav-item ${location.pathname === '/tasks' ? 'active' : ''}`}>
        <div className="nav-icon"><TasksIcon /></div>
        <div>Tasks</div>
      </Link>
      <Link to="/ads" className={`nav-item ${location.pathname === '/ads' ? 'active' : ''}`}>
        <div className="nav-icon"><AdsIcon /></div>
        <div>Ads</div>
      </Link>
      <Link to="/referrals" className={`nav-item ${location.pathname === '/referrals' ? 'active' : ''}`}>
        <div className="nav-icon"><ReferralsIcon /></div>
        <div>Invite</div>
      </Link>
      <Link to="/withdrawals" className={`nav-item ${location.pathname === '/withdrawals' ? 'active' : ''}`}>
        <div className="nav-icon"><WithdrawIcon /></div>
        <div>Wallet</div>
      </Link>
      <Link to="/profile" className={`nav-item ${location.pathname === '/profile' ? 'active' : ''}`}>
        <div className="nav-icon"><ProfileIcon /></div>
        <div>Profile</div>
      </Link>
    </div>
  );
}

export default BottomNav;
