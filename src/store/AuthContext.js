import React, { createContext, useState, useEffect, useContext } from 'react';
import { checkLoginStatus, logoutUser } from './expenseStore';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = async () => {
    try {
      const u = await checkLoginStatus();
      setUser(u);
    } catch {
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const login = (u) => {
    setUser(u);
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser: checkStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
