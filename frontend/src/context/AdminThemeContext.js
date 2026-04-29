import React, { createContext, useContext, useState, useEffect } from 'react';

const AdminThemeContext = createContext();

export const useAdminTheme = () => {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error('useAdminTheme must be used within AdminThemeProvider');
  }
  return context;
};

export const AdminThemeProvider = ({ children }) => {
  // Default to light mode for admin dashboard
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('adminTheme');
    return savedTheme || 'light';
  });

  useEffect(() => {
    localStorage.setItem('adminTheme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light'
  };

  return (
    <AdminThemeContext.Provider value={value}>
      {children}
    </AdminThemeContext.Provider>
  );
};

export default AdminThemeContext;
