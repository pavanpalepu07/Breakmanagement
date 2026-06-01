import React, { useState, useEffect } from 'react';
import AgentView from './views/AgentView.jsx';
import ManagerView from './views/ManagerView.jsx';
import DashboardView from './views/DashboardView.jsx';
import AdminView from './views/AdminView.jsx';

const VIEWS = [
  { id: 'agent', label: 'Agent Break Tool', icon: '👤' },
  { id: 'manager', label: 'Floor Manager', icon: '📊' },
  { id: 'dashboard', label: 'Dashboard', icon: '📈' },
  { id: 'admin', label: 'Admin Panel', icon: '⚙️' },
];

function getViewFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  return VIEWS.find(v => v.id === view) ? view : 'agent';
}

export default function App() {
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Bar */}
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
              {VIEWS.map(view => (
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
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderView()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-3 text-center text-xs text-gray-500">
        Break Management System &mdash; Embeddable in SharePoint via iframe
      </footer>
    </div>
  );
}
