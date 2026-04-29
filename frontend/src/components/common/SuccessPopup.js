import React from 'react';

// Icons
const CoinIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v12"/>
    <path d="M15 9.5c0-1.38-1.34-2.5-3-2.5s-3 1.12-3 2.5 1.34 2.5 3 2.5 3 1.12 3 2.5-1.34 2.5-3 2.5"/>
  </svg>
);

const HourglassIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 22h14"/>
    <path d="M5 2h14"/>
    <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
    <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
  </svg>
);

const PartyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5.8 11.3 2 22l10.7-3.79"/>
    <path d="M4 3h.01"/>
    <path d="M22 8h.01"/>
    <path d="M15 2h.01"/>
    <path d="M22 20h.01"/>
    <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/>
    <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17"/>
    <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7"/>
    <path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>
  </svg>
);

/**
 * Professional Success Popup Component
 * 
 * @param {Object} props
 * @param {boolean} props.show - Whether to show the popup
 * @param {Function} props.onClose - Callback when closing
 * @param {string} props.type - 'faucet' | 'ads' | 'task' | 'pending'
 * @param {number} props.reward - Amount earned
 * @param {string} props.currencyName - Currency name (e.g., 'Coins')
 * @param {number} props.newBalance - New balance after earning
 * @param {string} props.title - Optional custom title
 * @param {string} props.subtitle - Optional subtitle text
 * @param {string} props.message - Optional message text
 * @param {string} props.taskTitle - Task title (for task type)
 */
function SuccessPopup({
  show,
  onClose,
  type = 'task',
  reward = 0,
  currencyName = 'Coins',
  newBalance,
  title,
  subtitle,
  message,
  taskTitle
}) {
  if (!show) return null;

  const isPending = type === 'pending';
  
  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'faucet':
        return 'Faucet Claimed!';
      case 'ads':
        return 'Ad Completed!';
      case 'peered':
        return 'Bundle Completed!';
      case 'pending':
        return 'Submitted for Review!';
      case 'task':
      default:
        return 'Task Completed!';
    }
  };

  const getSubtitle = () => {
    if (subtitle) return subtitle;
    switch (type) {
      case 'faucet':
        return 'Your faucet reward has been added';
      case 'ads':
        return 'Thanks for watching!';
      case 'peered':
        return 'All ads in the bundle watched!';
      case 'pending':
        return taskTitle ? `"${taskTitle}"` : 'Awaiting admin approval';
      case 'task':
      default:
        return taskTitle ? `"${taskTitle}"` : 'Great job!';
    }
  };

  const getMessage = () => {
    if (message) return message;
    if (isPending) {
      return 'Your submission is being reviewed. You\'ll be rewarded once approved by an admin.';
    }
    return null;
  };

  const confettiColors = ['#10b981', '#6366f1', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'];

  return (
    <div className="success-popup-overlay" onClick={onClose}>
      <div 
        className={`success-popup ${isPending ? 'pending' : ''}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Confetti Animation */}
        {!isPending && (
          <div className="success-popup-confetti">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${Math.random() * 100}%`,
                  backgroundColor: confettiColors[i % confettiColors.length],
                  animationDelay: `${Math.random() * 0.5}s`,
                  transform: `rotate(${Math.random() * 360}deg)`
                }}
              />
            ))}
          </div>
        )}

        {/* Icon */}
        <div className="success-popup-icon">
          {isPending ? <HourglassIcon /> : <PartyIcon />}
        </div>

        {/* Title */}
        <h2 className="success-popup-title">{getTitle()}</h2>

        {/* Subtitle */}
        <p className="success-popup-subtitle">{getSubtitle()}</p>

        {/* Reward Amount - Only show if not pending */}
        {!isPending && reward > 0 && (
          <div className="success-popup-reward">
            <div className="success-popup-reward-label">You Earned</div>
            <div className="success-popup-reward-amount">
              <CoinIcon />
              <span>+{reward.toFixed ? reward.toFixed(5) : reward}</span>
            </div>
            <span className="success-popup-reward-currency">{currencyName}</span>
          </div>
        )}

        {/* Message for pending */}
        {getMessage() && (
          <p className="success-popup-message">{getMessage()}</p>
        )}

        {/* New Balance - Only show if provided and not pending */}
        {!isPending && newBalance !== undefined && (
          <div className="success-popup-balance">
            <span className="success-popup-balance-label">New Balance:</span>
            <span className="success-popup-balance-value">
              {newBalance.toFixed ? newBalance.toFixed(5) : newBalance} {currencyName}
            </span>
          </div>
        )}

        {/* Close Button */}
        <button className="success-popup-btn" onClick={onClose}>
          {isPending ? 'Got it!' : 'Awesome!'}
        </button>
      </div>
    </div>
  );
}

export default SuccessPopup;
