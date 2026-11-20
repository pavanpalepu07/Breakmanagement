import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { getConfig } from './config.js';

const SCOPES = ['User.Read', 'Sites.ReadWrite.All'];
let msal = null;
let currentAccount = null;

function appBaseUrl() {
  return window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
}

export async function getToken() {
  const request = { scopes: SCOPES, account: currentAccount };
  try {
    return (await msal.acquireTokenSilent(request)).accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      return (await msal.acquireTokenPopup(request)).accessToken;
    }
    throw err;
  }
}

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const cfg = getConfig();
    msal = new PublicClientApplication({
      auth: {
        clientId: cfg.clientId,
        authority: `https://login.microsoftonline.com/${cfg.tenantId}`,
        redirectUri: `${appBaseUrl()}redirect.html`,
      },
      cache: { cacheLocation: 'localStorage' },
    });
    msal.initialize().then(() => {
      const acc = msal.getAllAccounts()[0] || null;
      currentAccount = acc;
      setAccount(acc);
      setReady(true);
    });
  }, []);

  const signIn = useCallback(async () => {
    setError('');
    try {
      const res = await msal.loginPopup({ scopes: SCOPES });
      currentAccount = res.account;
      setAccount(res.account);
    } catch (err) {
      setError(err.message || 'Sign-in failed');
    }
  }, []);

  const signOut = useCallback(async () => {
    const acc = currentAccount;
    currentAccount = null;
    setAccount(null);
    await msal.clearCache({ account: acc });
  }, []);

  const email = (account?.username || '').toLowerCase();
  const cfg = getConfig();
  const lower = list => (list || []).map(e => e.toLowerCase());
  const role = lower(cfg.adminEmails).includes(email)
    ? 'admin'
    : lower(cfg.managerEmails).includes(email)
    ? 'manager'
    : 'agent';

  const value = {
    ready,
    signedIn: !!account,
    email,
    name: account?.name || email,
    role,
    error,
    signIn,
    signOut,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
