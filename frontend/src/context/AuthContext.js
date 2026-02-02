import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import cacheService from '../services/cacheService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Settings context for app-wide settings
const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  return context || {};
};

// Theme context
const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  return context || { theme: 'light', toggleTheme: () => {} };
};

// Global Data Context for cached data
const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  return context || {};
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    // Default to 'light', check localStorage for saved preference
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'light';
  });
  const [settings, setSettings] = useState({
    appName: 'MiniFaucet',
    currencySymbol: '₮',
    currencyName: 'Coins',
    faucetEnabled: true,
    withdrawalEnabled: true,
    minWithdrawal: 1,
    referralEnabled: true,
    referralCommission: 10,
    maintenanceMode: false
  });

  // Global cached data store
  const [globalData, setGlobalData] = useState({
    referralStats: null,
    withdrawalMethods: null,
    faucetPayInfo: null,
    adProviders: null,
    tasks: null,
    faucetStatus: null,
    earningsData: null
  });

  // Fetch app settings with caching
  const fetchSettings = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'settings/public';
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        setSettings(cached);
        return cached;
      }
    }

    try {
      const response = await axios.get('/settings/public');
      cacheService.set(cacheKey, response.data);
      setSettings(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      return null;
    }
  }, []);

  // Generic cached fetch function
  const fetchWithCache = useCallback(async (endpoint, options = {}) => {
    const { params = null } = options;
    const cacheKey = cacheService.getCacheKey(endpoint, params);

    return cacheService.deduplicatedFetch(cacheKey, async () => {
      const url = params ? `${endpoint}?${params}` : endpoint;
      const response = await axios.get(url);
      return response.data;
    });
  }, []);

  // Fetch dashboard data (user balance etc.)
  const fetchDashboard = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'user/dashboard';
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        setUser(cached.user);
        return cached;
      }
    }

    try {
      const data = await cacheService.deduplicatedFetch(cacheKey, async () => {
        const response = await axios.get('/user/dashboard');
        return response.data;
      });
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data;
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      return null;
    }
  }, []);

  // Fetch referral stats
  const fetchReferralStats = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'referrals/stats';
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        setGlobalData(prev => ({ ...prev, referralStats: cached }));
        return cached;
      }
    }

    try {
      const data = await cacheService.deduplicatedFetch(cacheKey, async () => {
        const response = await axios.get('/referrals/stats');
        return response.data;
      });
      setGlobalData(prev => ({ ...prev, referralStats: data }));
      return data;
    } catch (error) {
      console.error('Failed to fetch referral stats:', error);
      return null;
    }
  }, []);

  // Fetch faucet status
  const fetchFaucetStatus = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'earnings/faucet/status';
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        setGlobalData(prev => ({ ...prev, faucetStatus: cached }));
        return cached;
      }
    }

    try {
      const data = await cacheService.deduplicatedFetch(cacheKey, async () => {
        const response = await axios.get('/earnings/faucet/status');
        return response.data;
      });
      setGlobalData(prev => ({ ...prev, faucetStatus: data }));
      return data;
    } catch (error) {
      console.error('Failed to fetch faucet status:', error);
      return null;
    }
  }, []);

  // Fetch withdrawal methods
  const fetchWithdrawalMethods = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'withdrawals/methods';
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        setGlobalData(prev => ({ ...prev, withdrawalMethods: cached }));
        return cached;
      }
    }

    try {
      const methods = await cacheService.deduplicatedFetch(cacheKey, async () => {
        const response = await axios.get('/withdrawals/methods');
        // Return only the methods array to be cached
        return response.data.methods || [];
      });
      setGlobalData(prev => ({ ...prev, withdrawalMethods: methods }));
      return methods;
    } catch (error) {
      console.error('Failed to fetch withdrawal methods:', error);
      return [];
    }
  }, []);

  // Fetch FaucetPay info
  const fetchFaucetPayInfo = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'faucetpay/info';
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        setGlobalData(prev => ({ ...prev, faucetPayInfo: cached }));
        return cached;
      }
    }

    try {
      const data = await cacheService.deduplicatedFetch(cacheKey, async () => {
        const response = await axios.get('/faucetpay/info');
        return response.data;
      });
      setGlobalData(prev => ({ ...prev, faucetPayInfo: data }));
      return data;
    } catch (error) {
      console.error('Failed to fetch faucetpay info:', error);
      return null;
    }
  }, []);

  // Fetch available tasks
  const fetchTasks = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'tasks/available';
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        setGlobalData(prev => ({ ...prev, tasks: cached }));
        return cached;
      }
    }

    try {
      const tasks = await cacheService.deduplicatedFetch(cacheKey, async () => {
        const response = await axios.get('/tasks/available');
        // Return only the tasks array to be cached
        return response.data.tasks || [];
      });
      setGlobalData(prev => ({ ...prev, tasks: tasks }));
      return tasks;
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      return [];
    }
  }, []);

  // Fetch ad providers - returns full ads info object
  const fetchAdProviders = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'ads/providers';
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        setGlobalData(prev => ({ ...prev, adProviders: cached }));
        return cached;
      }
    }

    try {
      const adsInfo = await cacheService.deduplicatedFetch(cacheKey, async () => {
        const response = await axios.get('/ads/providers');
        // Return the full response (enabled, providers, dailyLimit, etc.)
        return response.data;
      });
      setGlobalData(prev => ({ ...prev, adProviders: adsInfo }));
      return adsInfo;
    } catch (error) {
      console.error('Failed to fetch ad providers:', error);
      return null;
    }
  }, []);

  // Fetch earnings data with caching (first page only for initial load)
  const fetchEarningsData = useCallback(async (filter = 'all', forceRefresh = false) => {
    const cacheKey = `user/earnings?filter=${filter}`;
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        setGlobalData(prev => ({ ...prev, earningsData: { ...prev.earningsData, [filter]: cached } }));
        return cached;
      }
    }

    try {
      const params = new URLSearchParams({ page: 1, limit: 20 });
      if (filter !== 'all') {
        params.append('type', filter);
      }
      
      const data = await cacheService.deduplicatedFetch(cacheKey, async () => {
        const response = await axios.get(`/user/earnings?${params}`);
        return response.data;
      });
      setGlobalData(prev => ({ ...prev, earningsData: { ...prev.earningsData, [filter]: data } }));
      return data;
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
      return null;
    }
  }, []);

  // Invalidate cache for specific data type
  const invalidateCache = useCallback((pattern) => {
    cacheService.invalidatePattern(pattern);
  }, []);

  // Clear all cache
  const clearCache = useCallback(() => {
    cacheService.clear();
  }, []);

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    // Load user from localStorage
    const storedUser = localStorage.getItem('user');
    const storedAdmin = localStorage.getItem('admin');
    
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing user:', error);
      }
    }
    
    if (storedAdmin) {
      try {
        setAdmin(JSON.parse(storedAdmin));
      } catch (error) {
        console.error('Error parsing admin:', error);
      }
    }
    
    // Fetch settings
    fetchSettings();
    
    setLoading(false);
  }, [fetchSettings]);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const loginAdmin = (adminData) => {
    setAdmin(adminData);
    localStorage.setItem('admin', JSON.stringify(adminData));
  };

  const logout = () => {
    setUser(null);
    setAdmin(null);
    localStorage.removeItem('user');
    localStorage.removeItem('admin');
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    clearCache();
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    // Also update cache
    cacheService.invalidate('user/dashboard');
  };

  const refreshSettings = () => {
    fetchSettings(true);
  };

  // Data context value with all fetch functions
  const dataContextValue = {
    ...globalData,
    fetchDashboard,
    fetchReferralStats,
    fetchFaucetStatus,
    fetchWithdrawalMethods,
    fetchFaucetPayInfo,
    fetchTasks,
    fetchAdProviders,
    fetchEarningsData,
    fetchWithCache,
    invalidateCache,
    clearCache
  };

  return (
    <AuthContext.Provider value={{
      user,
      admin,
      loading,
      login,
      loginAdmin,
      logout,
      updateUser
    }}>
      <SettingsContext.Provider value={{ settings, refreshSettings }}>
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
          <DataContext.Provider value={dataContextValue}>
            {children}
          </DataContext.Provider>
        </ThemeContext.Provider>
      </SettingsContext.Provider>
    </AuthContext.Provider>
  );
};
