import React, { useState, useEffect } from 'react';
import AgentView from './views/AgentView.jsx';
import ManagerView from './views/ManagerView.jsx';
import DashboardView from './views/DashboardView.jsx';
import AdminView from './views/AdminView.jsx';
import { useAuth } from './auth.jsx';

const VIEWS = [
  { id: 'agent', label: 'Agent Break Tool', icon: '👤', roles: ['agent', 'manager', 'admin'] },
  { id: 'manager', label: 'Floor Manager', icon: '📊', roles: ['manager', 'admin'] },
  { id: 'dashboard', label: 'Dashboard', icon: '📈', roles: ['agent', 'manager', 'admin'] },
  { id: 'admin', label: 'Admin Panel', icon: '⚙️', roles: ['admin'] },
];

function getViewFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  return VIEWS.find(v => v.id === view) ? view : 'agent';
}

const showNav = new URLSearchParams(window.location.search).get('nav') !== '0';

export default function App() {
  const auth = useAuth();
  const [currentView, setCurrentView] = useState(getViewFromUrl);

  // Keep URL in sync with current view
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', currentView);
    window.history.replaceState({}, '', url.toString());
  }, [currentView]);

  // Listen for browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(getViewFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function renderView() {
    const allowed = VIEWS.find(v => v.id === currentView)?.roles.includes(auth.role);
    if (!allowed) {
      return (
        <div className="max-w-md mx-auto mt-12 card text-center">
          <div className="text-4xl mb-2">🔒</div>
          <p className="font-semibold text-gray-900">You don't have access to this view.</p>
          <p className="text-sm text-gray-500 mt-1">Ask an admin to add your email to the manager or admin list.</p>
        </div>
      );
    }
    switch (currentView) {
      case 'agent':
        return <AgentView />;
      case 'manager':
        return <ManagerView />;
      case 'dashboard':
        return <DashboardView />;
      case 'admin':
        return <AdminView />;
      default:
        return <AgentView />;
    }
  }

  if (!auth.ready) {
    return <div className="p-12 text-center text-gray-400">Loading…</div>;
  }

  if (!auth.signedIn) {
    return (
      <div className="max-w-md mx-auto mt-16 card text-center">
        <div className="text-5xl mb-3">☕</div>
        <h1 className="text-2xl font-bold text-gray-900">Break Management</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">Sign in with your work Microsoft account to continue.</p>
        {auth.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg mb-4">
            {auth.error}
          </div>
        )}
        <button onClick={auth.signIn} className="btn-primary w-full py-2.5">Sign in with Microsoft</button>
        <p className="text-xs text-gray-400 mt-3">A sign-in popup will open. Allow popups if prompted.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Bar */}
      {showNav && (
      <nav className="bg-blue-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo / Brand */}
            <div className="flex items-center gap-2">
              <span className="text-white text-xl">☕</span>
              <span className="text-white font-bold text-lg hidden sm:block">Break Management</span>
            </div>

            {/* Nav Links */}
            <div className="flex items-center gap-1">
              {VIEWS.filter(v => v.roles.includes(auth.role)).map(view => (
                <button
                  key={view.id}
                  onClick={() => setCurrentView(view.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    currentView === view.id
                      ? 'bg-white text-blue-600'
                      : 'text-blue-100 hover:bg-blue-500 hover:text-white'
                  }`}
                >
                  <span className="hidden sm:inline">{view.icon}</span>
                  <span className="hidden md:inline">{view.label}</span>
                  <span className="md:hidden">{view.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            <button onClick={auth.signOut} className="text-blue-100 hover:text-white text-xs ml-2">
              Sign out
            </button>
          </div>
        </div>
      </nav>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderView()}
      </main>

    </div>
  );
}
