// contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { useRouter } from 'next/navigation';
import {  baseSepolia } from 'wagmi/chains'; 


interface User {
  address?: string;
  chainId?: number;
  isConnected? : boolean;
  isConnecting: boolean;
}

interface AuthContextData {
  isAuthenticated: boolean;
  user?: User;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User>({} as User);
  const router = useRouter();
  const {connect, connectors} = useConnect()
  const {address, isConnected, isConnecting} = useAccount()
  const account = useAccount();


  useEffect(() => {
    const checkAuthenticationStatus = () => {
      
      if (account?.isConnected) {
        setIsAuthenticated(true);
        setUser({
          address: account.address,
          chainId: account.chainId,
          isConnecting: account.isConnecting,
          isConnected: account.isConnected
        });
      } else {
        setIsAuthenticated(false);
        setUser({} as User);
        router.push('/')
      }
    };

    checkAuthenticationStatus();
  }, [isAuthenticated,address, isConnected, isConnecting ]);

  const login = async () => {
    try {
        await connect({chainId: baseSepolia.id, connector: connectors[0]})
    } catch (error) {
        console.log(error)
    }
  };

  const logout = () => {
    // useDisconnect();
    setIsAuthenticated(false);
    setUser({} as User);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};