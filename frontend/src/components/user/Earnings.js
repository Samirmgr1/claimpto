import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Navbar from '../common/Navbar';
import BottomNav from '../common/BottomNav';
import { useData } from '../../context/AuthContext';

// Premium SVG Icons
const FaucetIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6"/>
    <path d="M12 3v12"/>
    <path d="M5 21h14"/>
  </svg>
);

const TaskIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);

const ReferralIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const AdsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <path d="M8 21h8"/>
    <path d="M12 17v4"/>
    <polygon points="10,8 10,12 14,10"/>
  </svg>
);

const BonusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12v10H4V12"/>
    <path d="M2 7h20v5H2z"/>
    <path d="M12 22V7"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
);

const AdjustIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const CoinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v12"/>
    <path d="M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5"/>
  </svg>
);

const TrendUpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
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

function Earnings() {
  const { earningsData: cachedEarnings, fetchEarningsData } = useData();
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const fetchEarnings = useCallback(async (pageNum = 1, reset = false) => {
    // For first page, try to use cache
    if (pageNum === 1) {
      // Check if we have cached data for this filter
      const cached = cachedEarnings?.[filter];
      if (cached && !reset) {
        setEarnings(cached.earnings || []);
        setStats(cached.stats || null);
        if (cached.pagination) {
          setHasMore(cached.pagination.page < cached.pagination.pages);
        }
        setLoading(false);
        return;
      }
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      // For first page, use cached fetch
      if (pageNum === 1) {
        const data = await fetchEarningsData(filter);
        if (data) {
          setEarnings(data.earnings || []);
          setStats(data.stats || null);
          if (data.pagination) {
            setHasMore(data.pagination.page < data.pagination.pages);
          }
        }
      } else {
        // For subsequent pages, fetch directly (no caching for pagination)
        const params = new URLSearchParams({
          page: pageNum,
          limit: 20
        });
        if (filter !== 'all') {
          params.append('type', filter);
        }

        const response = await axios.get(`/user/earnings?${params}`);
        
        setEarnings(prev => [...prev, ...(response.data.earnings || [])]);
        
        if (response.data.pagination) {
          setHasMore(response.data.pagination.page < response.data.pagination.pages);
        }
        setStats(response.data.stats || null);
      }
    } catch (error) {
      console.error('Earnings error:', error);
      setError(error.response?.data?.message || 'Failed to load earnings. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, cachedEarnings, fetchEarningsData]);

  useEffect(() => {
    // Use cached data immediately if available
    const cached = cachedEarnings?.[filter];
    if (cached) {
      setEarnings(cached.earnings || []);
      setStats(cached.stats || null);
      if (cached.pagination) {
        setHasMore(cached.pagination.page < cached.pagination.pages);
      }
      setLoading(false);
    }
    
    setPage(1);
    fetchEarnings(1, !cached);
  }, [filter, fetchEarnings, cachedEarnings]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchEarnings(nextPage);
  };

  const getEarningIcon = (type) => {
    const icons = {
      faucet: <FaucetIcon />,
      task: <TaskIcon />,
      referral: <ReferralIcon />,
      ads: <AdsIcon />,
      bonus: <BonusIcon />,
      adjustment: <AdjustIcon />
    };
    return icons[type] || <CoinIcon />;
  };

  const getEarningColor = (type) => {
    const colors = {
      faucet: '#17a2b8',
      task: '#28a745',
      referral: '#6f42c1',
      ads: '#fd7e14',
      bonus: '#e83e8c',
      adjustment: '#6c757d'
    };
    return colors[type] || '#28a745';
  };

  const filters = [
    { id: 'all', label: 'All', icon: null },
    { id: 'faucet', label: 'Faucet', icon: <FaucetIcon /> },
    { id: 'task', label: 'Tasks', icon: <TaskIcon /> },
    { id: 'ads', label: 'Ads', icon: <AdsIcon /> },
    { id: 'referral', label: 'Referral', icon: <ReferralIcon /> }
  ];

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container page-content">
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading earnings...</p>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  if (error && earnings.length === 0) {
    return (
      <>
        <Navbar />
        <div className="container page-content">
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ marginBottom: '16px', color: 'var(--warning-color)' }}><AlertIcon /></div>
            <h3 style={{ marginBottom: '12px' }}>Failed to Load Earnings</h3>
            <p className="text-muted" style={{ marginBottom: '20px' }}>{error}</p>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchEarnings(1, true);
              }}
            >
              <RefreshIcon /> Try Again
            </button>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container page-content">
        {error && (
          <div className="error" style={{ marginBottom: '16px' }}>
            {error}
            <button 
              className="btn btn-sm"
              onClick={() => fetchEarnings(1, true)}
              style={{ marginLeft: '10px' }}
            >
              Retry
            </button>
          </div>
        )}
        
        {/* Header */}
        <div className="card card-gradient">
          <h2 style={{ color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CoinIcon /> Earnings History
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
            View all your earning transactions
          </p>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-icon"><TrendUpIcon /></div>
              <div className="stat-value">{stats.totalEarnings?.toFixed(5) || '0.00000'}</div>
              <div className="stat-label">Total Earned</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><CalendarIcon /></div>
              <div className="stat-value">{stats.todayEarnings?.toFixed(5) || '0.00000'}</div>
              <div className="stat-label">Today</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card" style={{ padding: '12px' }}>
          <div className="filter-tabs">
            {filters.map(f => (
              <button
                key={f.id}
                className={`filter-tab ${filter === f.id ? 'active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.icon && <span className="filter-tab-icon">{f.icon}</span>}
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Earnings List */}
        {earnings.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon"><CoinIcon /></div>
              <h3 className="empty-state-title">No Earnings Yet</h3>
              <p className="empty-state-description">
                {filter === 'all' 
                  ? 'Start earning by claiming faucet, completing tasks, or watching ads!'
                  : `No ${filter} earnings found.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="earnings-list">
              {earnings.map((earning) => (
                <div key={earning._id} className="earning-item">
                  <div 
                    className="earning-icon"
                    style={{ background: `${getEarningColor(earning.type)}15` }}
                  >
                    {getEarningIcon(earning.type)}
                  </div>
                  <div className="earning-details">
                    <div className="earning-description">
                      {earning.description || earning.type.charAt(0).toUpperCase() + earning.type.slice(1)}
                    </div>
                    <div className="earning-date">
                      {new Date(earning.createdAt).toLocaleString()}
                    </div>
                    {earning.taskId && (
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        Task: {earning.taskId.title}
                      </div>
                    )}
                    {earning.referralUserId && (
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        From: {earning.referralUserId.username || earning.referralUserId.firstName}
                      </div>
                    )}
                  </div>
                  <div 
                    className="earning-amount"
                    style={{ color: getEarningColor(earning.type) }}
                  >
                    +{earning.amount.toFixed(5)}
                  </div>
                </div>
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <button
                  className="btn btn-secondary"
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{ width: 'auto', padding: '12px 32px' }}
                >
                  {loadingMore ? (
                    <>
                      <div className="loading-spinner" style={{ width: '18px', height: '18px', marginRight: '8px' }}></div>
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </>
  );
}

export default Earnings;
