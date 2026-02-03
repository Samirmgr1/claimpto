import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Navbar from '../common/Navbar';
import BottomNav from '../common/BottomNav';
import Turnstile, { useTurnstile } from '../common/Turnstile';
import { useAuth, useSettings, useData } from '../../context/AuthContext';
import './Withdrawals.css';

// Premium SVG Icons
const WalletIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
    <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/>
  </svg>
);

const CreditCardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <line x1="2" y1="10" x2="22" y2="10"/>
  </svg>
);

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
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

const HistoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M12 7v5l4 2"/>
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

const BoltIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4"/>
    <path d="M12 8h.01"/>
  </svg>
);

const EmptyIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <path d="M22 10H2"/>
    <path d="M6 14h4"/>
  </svg>
);

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

const WalletAddressIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
    <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/>
  </svg>
);

function Withdrawals() {
  const { user, updateUser } = useAuth();
  const { settings } = useSettings();
  const { 
    withdrawalMethods: cachedMethods, 
    faucetPayInfo: cachedFaucetPayInfo,
    fetchWithdrawalMethods: fetchCachedMethods,
    fetchFaucetPayInfo: fetchCachedFaucetPayInfo
  } = useData();
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalMethods, setWithdrawalMethods] = useState(cachedMethods || []);
  const [loading, setLoading] = useState(!cachedMethods);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    customFields: {}
  });
  
  // FaucetPay instant withdrawal states
  const [faucetPayInfo, setFaucetPayInfo] = useState(cachedFaucetPayInfo);
  const [showFaucetPay, setShowFaucetPay] = useState(false);
  const [faucetPayForm, setFaucetPayForm] = useState({ amount: '', address: '' });
  const [faucetPaySubmitting, setFaucetPaySubmitting] = useState(false);
  
  // Tab state for payment methods
  const [activeTab, setActiveTab] = useState('instant'); // 'instant' or 'manual'
  
  // Turnstile state for security verification
  const turnstile = useTurnstile(settings?.turnstile?.siteKey);

  const currencyName = settings?.currencyName || 'Coins';

  const fetchWithdrawals = useCallback(async () => {
    try {
      const response = await axios.get('/withdrawals/history');
      setWithdrawals(response.data.withdrawals || []);
      setError(null);
    } catch (error) {
      console.error('Withdrawals error:', error);
      try {
        const fallbackResponse = await axios.get('/user/withdrawals?page=1&limit=20');
        setWithdrawals(fallbackResponse.data.withdrawals || []);
      } catch (fallbackError) {
        setError('Failed to load withdrawals. Please try again.');
      }
    }
  }, []);

  const fetchWithdrawalMethods = useCallback(async () => {
    try {
      const data = await fetchCachedMethods();
      if (data) {
        setWithdrawalMethods(data);
      }
    } catch (error) {
      console.error('Withdrawal methods error:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchCachedMethods]);
  
  const fetchFaucetPayInfo = useCallback(async () => {
    try {
      const data = await fetchCachedFaucetPayInfo();
      if (data) {
        setFaucetPayInfo(data);
      }
    } catch (error) {
      console.error('FaucetPay info error:', error);
    }
  }, [fetchCachedFaucetPayInfo]);

  useEffect(() => {
    // Use cached data immediately
    if (cachedMethods) {
      setWithdrawalMethods(cachedMethods);
      setLoading(false);
    }
    if (cachedFaucetPayInfo) {
      setFaucetPayInfo(cachedFaucetPayInfo);
    }
    // Fetch fresh data
    fetchWithdrawals();
    fetchWithdrawalMethods();
    fetchFaucetPayInfo();
  }, [fetchWithdrawals, fetchWithdrawalMethods, fetchFaucetPayInfo, cachedMethods, cachedFaucetPayInfo]);

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    setShowFaucetPay(false);
    setFormData({ amount: '', customFields: {} });
    setError(null);
    setSuccess(null);
  };
  
  const handleFaucetPaySelect = () => {
    setShowFaucetPay(true);
    setSelectedMethod(null);
    setFaucetPayForm({ amount: '', address: '' });
    setError(null);
    setSuccess(null);
  };

  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      customFields: { ...prev.customFields, [fieldName]: value }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMethod) return;
    
    // Check Turnstile verification if enabled
    if (settings?.turnstile?.enabled && !turnstile.token) {
      setError('Please complete the security verification first');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await axios.post('/withdrawals/request', {
        methodId: selectedMethod._id,
        amount: parseFloat(formData.amount),
        submittedFields: formData.customFields,
        turnstileToken: turnstile.token
      });
      setSuccess('Withdrawal request submitted successfully! You will be notified once processed.');
      setSelectedMethod(null);
      setFormData({ amount: '', customFields: {} });
      fetchWithdrawals();
      const userResponse = await axios.get('/user/dashboard');
      updateUser(userResponse.data.user);
      // Reset Turnstile for next action
      turnstile.reset();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to submit withdrawal request');
      // Reset Turnstile if there was a verification error
      if (error.response?.data?.turnstileRequired) {
        turnstile.reset();
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleFaucetPaySubmit = async (e) => {
    e.preventDefault();
    if (!faucetPayInfo?.enabled) return;
    
    // Check Turnstile verification if enabled
    if (settings?.turnstile?.enabled && !turnstile.token) {
      setError('Please complete the security verification first');
      return;
    }

    setFaucetPaySubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await axios.post('/faucetpay/withdraw', {
        amount: parseFloat(faucetPayForm.amount),
        address: faucetPayForm.address.trim(),
        turnstileToken: turnstile.token
      });
      
      if (response.data.success) {
        const payment = response.data.payment;
        const cryptoAmount = payment.cryptoAmount?.toFixed(8) || payment.netAmount;
        setSuccess(`🎉 Withdrawal successful! ${cryptoAmount} ${payment.currency} has been sent to your FaucetPay account instantly!`);
        setShowFaucetPay(false);
        setFaucetPayForm({ amount: '', address: '' });
        fetchWithdrawals();
        fetchFaucetPayInfo();
        const userResponse = await axios.get('/user/dashboard');
        updateUser(userResponse.data.user);
        // Reset Turnstile for next action
        turnstile.reset();
      }
    } catch (error) {
      console.error('FaucetPay withdrawal error:', error.response?.data?.message || error.message);
      setError('Something went wrong. Please try again later.');
      // Reset Turnstile if there was a verification error
      if (error.response?.data?.turnstileRequired) {
        turnstile.reset();
      }
    } finally {
      setFaucetPaySubmitting(false);
    }
  };
  
  const setFaucetPayMaxAmount = () => {
    if (!faucetPayInfo) return;
    const maxAmount = Math.min(user?.balance || 0, faucetPayInfo.maxWithdrawal || user?.balance || 0);
    setFaucetPayForm(prev => ({ ...prev, amount: maxAmount.toString() }));
  };
  
  const calculateFaucetPayFee = () => {
    if (!faucetPayInfo || !faucetPayForm.amount) return 0;
    const amount = parseFloat(faucetPayForm.amount) || 0;
    if (faucetPayInfo.feeType === 'percentage') {
      return (amount * faucetPayInfo.fee / 100);
    }
    return faucetPayInfo.fee || 0;
  };
  
  const getFaucetPayNetAmount = () => {
    const amount = parseFloat(faucetPayForm.amount) || 0;
    return Math.max(0, amount - calculateFaucetPayFee());
  };
  
  // Calculate USD equivalent of the net amount (after fee)
  const getFaucetPayUsdAmount = () => {
    const netAmount = getFaucetPayNetAmount();
    if (isPointsMode && netAmount > 0) {
      return pointsToUSD(netAmount);
    }
    return netAmount; // Already in USD if fiat mode
  };
  
  // Calculate crypto amount based on exchange rate
  const getFaucetPayCryptoAmount = () => {
    if (!faucetPayInfo?.currentCoinRate || faucetPayInfo.currentCoinRate <= 0) return 0;
    const usdAmount = getFaucetPayUsdAmount();
    // currentCoinRate = USD per 1 coin, so crypto = usd / rate
    return usdAmount / faucetPayInfo.currentCoinRate;
  };

  const setMaxAmount = () => {
    if (!selectedMethod) return;
    const maxAmount = Math.min(user?.balance || 0, selectedMethod.maxAmount || user?.balance || 0);
    setFormData(prev => ({ ...prev, amount: maxAmount.toString() }));
  };

  const calculateFee = () => {
    if (!selectedMethod || !formData.amount) return 0;
    const amount = parseFloat(formData.amount) || 0;
    if (selectedMethod.feeType === 'percentage') {
      return (amount * selectedMethod.fee / 100);
    }
    return selectedMethod.fee || 0;
  };

  const getNetAmount = () => {
    const amount = parseFloat(formData.amount) || 0;
    return Math.max(0, amount - calculateFee());
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending: { class: 'status-pending', icon: <ClockIcon />, label: 'Pending' },
      approved: { class: 'status-approved', icon: <CheckCircleIcon />, label: 'Approved' },
      rejected: { class: 'status-rejected', icon: <XCircleIcon />, label: 'Rejected' },
      processing: { class: 'status-processing', icon: <ClockIcon />, label: 'Processing' }
    };
    return configs[status] || { class: 'status-pending', icon: <ClockIcon />, label: status };
  };

  const canWithdraw = (method) => user?.balance >= (method.minAmount || 0);
  const withdrawalsEnabled = settings?.withdrawalEnabled !== false;

  // Currency conversion helper
  const isPointsMode = settings?.currencyMode === 'points';
  const exchangeRate = settings?.pointsExchangeRate || 1000;
  
  const pointsToUSD = (points) => {
    return points / exchangeRate;
  };
  
  const formatUSD = (amount) => {
    return `$${amount.toFixed(5)}`;
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="withdrawals-page">
          <div className="withdrawals-loading">
            <div className="loading-spinner-wrapper">
              <div className="loading-spinner"></div>
            </div>
            <p>Loading withdrawals...</p>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="withdrawals-page">
        <div className="withdrawals-container">
          
          {/* Alerts */}
          {error && (
            <div className="alert alert-error">
              <XCircleIcon />
              <span>{error}</span>
              <button className="alert-close" onClick={() => setError(null)}>×</button>
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              <CheckCircleIcon />
              <span>{success}</span>
              <button className="alert-close" onClick={() => setSuccess(null)}>×</button>
            </div>
          )}

          {/* Balance Card */}
          <div className="balance-card">
            <div className="balance-card-bg"></div>
            <div className="balance-card-content">
              <div className="balance-icon-wrapper">
                <WalletIcon />
              </div>
              <div className="balance-info">
                <span className="balance-label">Available Balance</span>
                <div className="balance-amount">
                  <span className="balance-value">{user?.balance?.toFixed(5) || '0.00000'}</span>
                  <span className="balance-currency">{currencyName}</span>
                </div>
                {isPointsMode && user?.balance > 0 && (
                  <div className="balance-usd-equivalent">
                    ≈ {formatUSD(pointsToUSD(user?.balance || 0))}
                  </div>
                )}
              </div>
              {!withdrawalsEnabled && (
                <div className="withdrawals-disabled-badge">
                  <ShieldIcon />
                  <span>Withdrawals Paused</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Methods Selection */}
          {withdrawalsEnabled && !selectedMethod && !showFaucetPay && (
            <div className="methods-section">
              <div className="section-header">
                <CreditCardIcon />
                <h2>Select Payment Method</h2>
              </div>
              
              {/* Tabs */}
              <div className="methods-tabs">
                <button 
                  className={`methods-tab ${activeTab === 'instant' ? 'active' : ''}`}
                  onClick={() => setActiveTab('instant')}
                >
                  <BoltIcon />
                  <span>Instant</span>
                </button>
                <button 
                  className={`methods-tab ${activeTab === 'manual' ? 'active' : ''}`}
                  onClick={() => setActiveTab('manual')}
                >
                  <ClockIcon />
                  <span>Manual</span>
                </button>
              </div>

              {/* Instant Tab Content - FaucetPay */}
              {activeTab === 'instant' && (
                <div className="tab-content">
                  {faucetPayInfo?.enabled ? (
                    <div 
                      className={`method-card method-card-featured ${user?.balance < faucetPayInfo.minWithdrawal ? 'method-disabled' : ''}`}
                      onClick={() => user?.balance >= faucetPayInfo.minWithdrawal && handleFaucetPaySelect()}
                    >
                      <div className="method-card-inner">
                        <div className="method-icon method-icon-featured">
                          <BoltIcon />
                        </div>
                        <div className="method-details">
                          <h3 className="method-name">FaucetPay</h3>
                          <span className="method-min">Min: {faucetPayInfo.minWithdrawal} {currencyName}</span>
                        </div>
                        <div className="method-arrow">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18l6-6-6-6"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state-mini">
                      <BoltIcon />
                      <p>Instant withdrawal is not available</p>
                    </div>
                  )}
                  
                  {faucetPayInfo?.enabled && (
                    <div className="info-note">
                      <InfoIcon />
                      <span>Instant withdrawals are processed immediately to your FaucetPay wallet</span>
                    </div>
                  )}
                </div>
              )}

              {/* Manual Tab Content - API Payment Methods */}
              {activeTab === 'manual' && (
                <div className="tab-content">
                  {withdrawalMethods.length === 0 ? (
                    <div className="empty-state-mini">
                      <CreditCardIcon />
                      <p>No manual withdrawal methods available</p>
                    </div>
                  ) : (
                    <div className="methods-grid">
                      {withdrawalMethods.map((method) => (
                        <div 
                          key={method._id} 
                          className={`method-card ${!canWithdraw(method) ? 'method-disabled' : ''}`}
                          onClick={() => canWithdraw(method) && handleMethodSelect(method)}
                        >
                          <div className="method-card-inner">
                            <div className="method-icon">
                              {method.logo ? (
                                <img src={method.logo} alt={method.name} />
                              ) : (
                                <CreditCardIcon />
                              )}
                            </div>
                            <div className="method-details">
                              <h3 className="method-name">{method.name}</h3>
                              <span className="method-min">Min: {method.minAmount} {method.currency}</span>
                            </div>
                            <div className="method-arrow">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 18l6-6-6-6"/>
                              </svg>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {withdrawalMethods.length > 0 && (
                    <div className="info-note">
                      <ClockIcon />
                      <span>Manual withdrawals require admin approval and may take 24-48 hours</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Standard Withdrawal Form */}
          {withdrawalsEnabled && selectedMethod && (
            <div className="form-section">
              <div className="form-header">
                <button className="back-btn" onClick={() => setSelectedMethod(null)}>
                  <ArrowLeftIcon />
                </button>
                <div className="form-title">
                  <h2>Withdraw via {selectedMethod.name}</h2>
                  <p>{selectedMethod.currency}</p>
                </div>
              </div>

              <form className="withdrawal-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Amount ({currencyName})</label>
                  <div className="input-with-button">
                    <input
                      type="number"
                      className="form-input"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      step="0.01"
                      min={selectedMethod.minAmount || 1}
                      max={Math.min(user?.balance || 0, selectedMethod.maxAmount || Infinity)}
                      placeholder={`Min: ${selectedMethod.minAmount || 0}`}
                      required
                    />
                    <button type="button" className="max-btn" onClick={setMaxAmount}>MAX</button>
                  </div>
                  
                  {formData.amount && (
                    <div className="amount-breakdown">
                      {selectedMethod.fee > 0 && (
                        <div className="breakdown-item">
                          <span>Fee ({selectedMethod.fee}{selectedMethod.feeType === 'percentage' ? '%' : ' fixed'})</span>
                          <span className="breakdown-value negative">-{calculateFee().toFixed(5)}</span>
                        </div>
                      )}
                      <div className="breakdown-item breakdown-total">
                        <span>You'll receive</span>
                        <span className="breakdown-value positive">{getNetAmount().toFixed(5)} {currencyName}</span>
                      </div>
                      {isPointsMode && getNetAmount() > 0 && (
                        <div className="breakdown-item usd-equivalent">
                          <span>USD Equivalent</span>
                          <span className="breakdown-value">{formatUSD(pointsToUSD(getNetAmount()))}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {selectedMethod.customFields?.map((field) => (
                  <div key={field.name} className="form-group">
                    <label className="form-label">
                      {field.label}
                      {field.required && <span className="required">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        className="form-input form-textarea"
                        value={formData.customFields[field.name] || ''}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        rows={3}
                      />
                    ) : (
                      <div className="input-with-icon">
                        <div className="input-icon">
                          {field.type === 'email' ? <MailIcon /> : <WalletAddressIcon />}
                        </div>
                        <input
                          type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                          className="form-input form-input-with-icon"
                          value={formData.customFields[field.name] || ''}
                          onChange={(e) => handleFieldChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                      </div>
                    )}
                    {field.hint && <span className="form-hint">{field.hint}</span>}
                  </div>
                ))}

                {selectedMethod.processingTime && (
                  <div className="processing-info">
                    <ClockIcon />
                    <span>Processing time: {selectedMethod.processingTime}</span>
                  </div>
                )}

                {/* Turnstile Security Verification - only show when not yet verified */}
                {settings?.turnstile?.enabled && settings?.turnstile?.siteKey && !turnstile.isVerified && (
                  <div className="turnstile-section">
                    <Turnstile {...turnstile.turnstileProps} />
                  </div>
                )}

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={
                    submitting || 
                    parseFloat(formData.amount) > (user?.balance || 0) || 
                    parseFloat(formData.amount) < (selectedMethod.minAmount || 0) ||
                    (settings?.turnstile?.enabled && !turnstile.isVerified)
                  }
                >
                  {submitting ? (
                    <>
                      <div className="btn-spinner"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <SendIcon />
                      <span>Withdraw {formData.amount || 0} {currencyName}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* FaucetPay Withdrawal Form */}
          {withdrawalsEnabled && showFaucetPay && faucetPayInfo?.enabled && (
            <div className="form-section form-section-featured">
              <div className="form-header">
                <button className="back-btn" onClick={() => setShowFaucetPay(false)}>
                  <ArrowLeftIcon />
                </button>
                <div className="form-title">
                  <h2>
                    <BoltIcon />
                    FaucetPay Instant Withdrawal
                  </h2>
                  <p>{faucetPayInfo.currency}</p>
                </div>
              </div>

              {/* FaucetPay Info Banner */}
              <div className="info-banner">
                <div className="info-banner-icon">
                  <InfoIcon />
                </div>
                <div className="info-banner-content">
                  <strong>Instant Withdrawal</strong>
                  <p>Funds are sent directly to your FaucetPay account. No approval required!</p>
                  {faucetPayInfo.dailyLimit > 0 && (
                    <span className="daily-limit">
                      Daily limit: {faucetPayInfo.remainingToday}/{faucetPayInfo.dailyLimit} remaining
                    </span>
                  )}
                </div>
              </div>

              <form className="withdrawal-form" onSubmit={handleFaucetPaySubmit}>
                <div className="form-group">
                  <label className="form-label">Amount ({currencyName})</label>
                  <div className="input-with-button">
                    <input
                      type="number"
                      className="form-input"
                      value={faucetPayForm.amount}
                      onChange={(e) => setFaucetPayForm(prev => ({ ...prev, amount: e.target.value }))}
                      step="0.00000001"
                      min={faucetPayInfo.minWithdrawal || 0}
                      max={Math.min(user?.balance || 0, faucetPayInfo.maxWithdrawal || Infinity)}
                      placeholder={`Min: ${faucetPayInfo.minWithdrawal || 0}`}
                      required
                    />
                    <button type="button" className="max-btn" onClick={setFaucetPayMaxAmount}>MAX</button>
                  </div>
                  
                  {faucetPayForm.amount && (
                    <div className="amount-breakdown">
                      {faucetPayInfo.fee > 0 && (
                        <div className="breakdown-item">
                          <span>Fee ({faucetPayInfo.fee}{faucetPayInfo.feeType === 'percentage' ? '%' : ' fixed'})</span>
                          <span className="breakdown-value negative">-{calculateFaucetPayFee().toFixed(5)} {currencyName}</span>
                        </div>
                      )}
                      <div className="breakdown-item">
                        <span>Net Amount</span>
                        <span className="breakdown-value">{getFaucetPayNetAmount().toFixed(5)} {currencyName}</span>
                      </div>
                      {isPointsMode && getFaucetPayNetAmount() > 0 && (
                        <div className="breakdown-item usd-equivalent">
                          <span>USD Value</span>
                          <span className="breakdown-value">{formatUSD(getFaucetPayUsdAmount())}</span>
                        </div>
                      )}
                      {faucetPayInfo.currentCoinRate > 0 && getFaucetPayCryptoAmount() > 0 && (
                        <div className="breakdown-item breakdown-total">
                          <span>You'll receive</span>
                          <span className="breakdown-value positive">
                            {getFaucetPayCryptoAmount().toFixed(8)} {faucetPayInfo.currency}
                          </span>
                        </div>
                      )}
                      {(!faucetPayInfo.currentCoinRate || faucetPayInfo.currentCoinRate <= 0) && (
                        <div className="breakdown-item" style={{ color: 'var(--danger-color)' }}>
                          <span>⚠️ Exchange rate not configured</span>
                        </div>
                      )}
                      {faucetPayInfo.currentCoinRate > 0 && (
                        <div className="breakdown-item" style={{ fontSize: '11px', opacity: 0.7 }}>
                          <span>Rate: 1 {faucetPayInfo.currency} = ${faucetPayInfo.currentCoinRate.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    FaucetPay Email / Linked Address
                    <span className="required">*</span>
                  </label>
                  <div className="input-with-icon">
                    <div className="input-icon">
                      <MailIcon />
                    </div>
                    <input
                      type="text"
                      className="form-input form-input-with-icon"
                      value={faucetPayForm.address}
                      onChange={(e) => setFaucetPayForm(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="email@example.com or crypto address"
                      required
                    />
                  </div>
                  <span className="form-hint">
                    <InfoIcon /> Use your FaucetPay registered email or linked wallet address
                  </span>
                </div>

                <div className="processing-info">
                  <ClockIcon />
                  <span>Processing time: {faucetPayInfo.processingTime || 'Instant'}</span>
                </div>

                {/* Turnstile Security Verification - only show when not yet verified */}
                {settings?.turnstile?.enabled && settings?.turnstile?.siteKey && !turnstile.isVerified && (
                  <div className="turnstile-section">
                    <Turnstile {...turnstile.turnstileProps} />
                  </div>
                )}

                <button
                  type="submit"
                  className="submit-btn submit-btn-featured"
                  disabled={
                    faucetPaySubmitting || 
                    parseFloat(faucetPayForm.amount) > (user?.balance || 0) || 
                    parseFloat(faucetPayForm.amount) < (faucetPayInfo.minWithdrawal || 0) ||
                    !faucetPayForm.address.trim() ||
                    (faucetPayInfo.dailyLimit > 0 && faucetPayInfo.remainingToday <= 0) ||
                    (settings?.turnstile?.enabled && !turnstile.isVerified) ||
                    !faucetPayInfo.currentCoinRate || faucetPayInfo.currentCoinRate <= 0
                  }
                >
                  {faucetPaySubmitting ? (
                    <>
                      <div className="btn-spinner"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <BoltIcon />
                      <span>
                        Withdraw {getFaucetPayCryptoAmount() > 0 ? getFaucetPayCryptoAmount().toFixed(8) : faucetPayForm.amount || 0} {faucetPayInfo.currency} Instantly
                      </span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Withdrawal History */}
          <div className="history-section">
            <div className="section-header">
              <HistoryIcon />
              <h2>Withdrawal History</h2>
            </div>

            {withdrawals.length === 0 ? (
              <div className="empty-state">
                <EmptyIcon />
                <h3>No Withdrawals Yet</h3>
                <p>Your withdrawal history will appear here.</p>
              </div>
            ) : (
              <div className="history-list">
                {withdrawals.map((withdrawal) => {
                  const statusConfig = getStatusConfig(withdrawal.status);
                  return (
                    <div key={withdrawal._id} className="history-item">
                      <div className="history-item-icon">
                        <SendIcon />
                      </div>
                      <div className="history-item-details">
                        <div className="history-item-amount">
                          {withdrawal.amount?.toFixed(5)} {currencyName}
                        </div>
                        <div className="history-item-method">{withdrawal.method || 'Unknown'}</div>
                        <div className="history-item-date">
                          {new Date(withdrawal.requestedAt || withdrawal.createdAt).toLocaleString()}
                        </div>
                        {withdrawal.transactionId && (
                          <div className="history-item-tx">TX: {withdrawal.transactionId}</div>
                        )}
                        {withdrawal.rejectionReason && (
                          <div className="history-item-reason">Reason: {withdrawal.rejectionReason}</div>
                        )}
                        {withdrawal.fee > 0 && (
                          <div className="history-item-fee">
                            Fee: {withdrawal.fee?.toFixed(5)} • Net: {withdrawal.netAmount?.toFixed(5)}
                          </div>
                        )}
                      </div>
                      <div className={`history-item-status ${statusConfig.class}`}>
                        {statusConfig.icon}
                        <span>{statusConfig.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
      <BottomNav />
    </>
  );
}

export default Withdrawals;
