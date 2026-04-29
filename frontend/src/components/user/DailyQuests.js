import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Navbar from '../common/Navbar';
import BottomNav from '../common/BottomNav';
import AdSlot from '../common/AdSlot';
import { useAuth, useSettings } from '../../context/AuthContext';
import './DailyQuests.css';

const FireIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>
);

const TrophyIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const GiftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const StarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const LockIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

function DailyQuests() {
  const { user, updateUser } = useAuth();
  const { settings } = useSettings();
  const [questData, setQuestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [claimingMilestone, setClaimingMilestone] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [countdown, setCountdown] = useState('');
  const countdownRef = useRef(null);
  const resetInRef = useRef(0);
  const currencyName = settings?.currencyName || 'Coins';

  const fetchQuests = useCallback(async () => {
    try {
      const response = await axios.get('/daily-quests');
      setQuestData(response.data);
      resetInRef.current = response.data.resetIn || 0;
      setError(null);
    } catch (err) {
      setError('Failed to load daily quests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (resetInRef.current <= 0) { setCountdown('00:00:00'); return; }
      resetInRef.current = Math.max(0, resetInRef.current - 1000);
      const ms = resetInRef.current;
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setCountdown(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'));
      if (ms <= 0) fetchQuests();
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [questData, fetchQuests]);

  useEffect(() => { fetchQuests(); }, [fetchQuests]);

  const handleClaimQuest = async (questId) => {
    setClaimingId(questId); setError(null); setSuccess(null);
    try {
      const startRes = await axios.post('/daily-quests/' + questId + '/claim/start');
      const { token, minTimeSeconds } = startRes.data;
      if (minTimeSeconds > 0) await new Promise(r => setTimeout(r, minTimeSeconds * 1000 + 200));
      const claimRes = await axios.post('/daily-quests/' + questId + '/claim', { actionToken: token });
      setSuccess(claimRes.data.message || 'Quest reward claimed!');
      if (claimRes.data.balance !== undefined) updateUser({ ...user, balance: claimRes.data.balance });
      await fetchQuests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to claim quest reward');
    } finally { setClaimingId(null); }
  };

  const handleClaimMilestone = async (milestone) => {
    setClaimingMilestone(milestone); setError(null); setSuccess(null);
    try {
      const res = await axios.post('/daily-quests/streak-bonus/claim', { milestone });
      setSuccess(res.data.message);
      if (res.data.balance !== undefined) updateUser({ ...user, balance: res.data.balance });
      await fetchQuests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to claim streak bonus');
    } finally { setClaimingMilestone(null); }
  };

  if (loading) return (
    <><Navbar /><div className="dq-page"><div className="dq-loading"><div className="dq-loading-spinner"></div><p>Loading daily quests...</p></div></div><BottomNav /></>
  );

  if (error && !questData) return (
    <><Navbar /><div className="dq-page"><div className="dq-disabled"><LockIcon /><h3>Failed to Load</h3><p>{error}</p><button onClick={() => { setLoading(true); setError(null); fetchQuests(); }} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6c5ce7', color: '#fff', cursor: 'pointer' }}>Retry</button></div></div><BottomNav /></>
  );

  if (!questData?.enabled) return (
    <><Navbar /><div className="dq-page"><div className="dq-disabled"><LockIcon /><h3>Daily Quests Unavailable</h3><p>Daily quests are not currently active.</p></div></div><BottomNav /></>
  );

  const { quests, streak, summary, milestones } = questData;
  const progressPct = summary.total > 0 ? (summary.completed / summary.total) * 100 : 0;

  return (
    <><Navbar />
    <div className="dq-page"><div className="dq-container">
      {error && <div className="dq-alert dq-alert-error"><span>{error}</span><button onClick={() => setError(null)}>&times;</button></div>}
      {success && <div className="dq-alert dq-alert-success"><span>{success}</span><button onClick={() => setSuccess(null)}>&times;</button></div>}

      <AdSlot slotId="quests_top" />

      <div className="dq-header-card">
        <div className="dq-header-bg"></div>
        <div className="dq-header-content">
          <div className="dq-header-top">
            <div className="dq-header-title"><TrophyIcon size={28} /><div><h1>Daily Quests</h1><p className="dq-header-subtitle">Complete quests to earn rewards</p></div></div>
            <div className="dq-reset-timer"><ClockIcon /><span>{countdown}</span></div>
          </div>
          <div className="dq-overall-progress">
            <div className="dq-progress-header"><span>{summary.completed}/{summary.total} completed</span><span>{Math.round(progressPct)}%</span></div>
            <div className="dq-progress-bar-container"><div className="dq-progress-bar-fill" style={{ width: progressPct + '%' }}></div></div>
          </div>
        </div>
      </div>

      <div className="dq-streak-card">
        <div className="dq-streak-header">
          <div className="dq-streak-fire"><FireIcon size={32} /><div className="dq-streak-count">{streak.currentStreak}</div></div>
          <div className="dq-streak-info"><h3>Day Streak</h3><p>Best: {streak.longestStreak} days</p></div>
        </div>
        <div className="dq-milestones">
          {milestones.map((ml) => (
            <div key={ml.days} className={'dq-milestone ' + (ml.claimed ? 'claimed' : ml.available ? 'available' : streak.currentStreak >= ml.days ? 'reached' : 'locked')}>
              <div className="dq-milestone-dot">{ml.claimed ? <CheckCircleIcon /> : ml.available ? <GiftIcon /> : <span>{ml.days}</span>}</div>
              <div className="dq-milestone-label">{ml.days}d</div>
              <div className="dq-milestone-reward">{ml.reward} {currencyName}</div>
              {ml.available && !ml.claimed && (
                <button className="dq-milestone-claim-btn" onClick={() => handleClaimMilestone(ml.days)} disabled={claimingMilestone === ml.days}>
                  {claimingMilestone === ml.days ? '...' : 'Claim'}
                </button>
              )}
            </div>
          ))}
          <div className="dq-milestone-line"><div className="dq-milestone-line-fill" style={{ width: Math.min(100, (streak.currentStreak / 30) * 100) + '%' }}></div></div>
        </div>
      </div>

      <div className="dq-quests-section">
        <h2 className="dq-section-title"><StarIcon /> Today's Quests</h2>
        {quests.length === 0 ? (
          <div className="dq-empty"><TrophyIcon size={48} /><h3>No Quests Available</h3><p>Check back later for new daily quests!</p></div>
        ) : (
          <div className="dq-quests-list">
            {quests.map((q) => {
              const qp = Math.min(q.progress, q.targetCount);
              const qPct = (qp / q.targetCount) * 100;
              const isClaiming = claimingId === q._id;
              return (
                <div key={q._id} className={'dq-quest-card ' + (q.claimed ? 'claimed' : q.completed ? 'completed' : '')}>
                  <div className="dq-quest-icon"><span>{q.icon}</span></div>
                  <div className="dq-quest-content">
                    <div className="dq-quest-header"><h3 className="dq-quest-title">{q.title}</h3><div className="dq-quest-reward">+{q.reward} {currencyName}</div></div>
                    {q.description && <p className="dq-quest-desc">{q.description}</p>}
                    <div className="dq-quest-progress">
                      <div className="dq-quest-progress-bar"><div className="dq-quest-progress-fill" style={{ width: qPct + '%' }}></div></div>
                      <span className="dq-quest-progress-text">{qp}/{q.targetCount}</span>
                    </div>
                  </div>
                  <div className="dq-quest-action">
                    {q.claimed ? (
                      <div className="dq-quest-done"><CheckCircleIcon /><span>Done</span></div>
                    ) : q.completed ? (
                      <button className="dq-claim-btn" onClick={() => handleClaimQuest(q._id)} disabled={isClaiming}>
                        {isClaiming ? <div className="dq-btn-spinner"></div> : <><GiftIcon /><span>Claim</span></>}
                      </button>
                    ) : (
                      <div className="dq-quest-in-progress"><ClockIcon /></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AdSlot slotId="quests_bottom" />
    </div></div>
    <BottomNav /></>
  );
}

export default DailyQuests;
