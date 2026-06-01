import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO, differenceInSeconds } from 'date-fns';

const BREAK_TYPE_LABELS = {
  qbb: 'QBB',
  short: 'Short Break',
  lunch: 'Lunch/Dinner',
};

const BREAK_LIMITS = { qbb: 5, short: 15, lunch: 30 };

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function BreakRow({ breakRecord, now }) {
  const start = parseISO(breakRecord.startTime);
  const elapsed = differenceInSeconds(now, start);
  const limit = BREAK_LIMITS[breakRecord.breakType] || 30;
  const limitSecs = limit * 60;
  const percent = (elapsed / limitSecs) * 100;

  const isExceeded = percent > 100;
  const isApproaching = !isExceeded && percent >= 75;

  const rowBg = isExceeded
    ? 'bg-red-50 border-l-4 border-red-400'
    : isApproaching
    ? 'bg-orange-50 border-l-4 border-orange-400'
    : 'bg-green-50 border-l-4 border-green-400';

  const statusBadge = isExceeded
    ? <span className="badge-red">Exceeded</span>
    : isApproaching
    ? <span className="badge-orange">Approaching</span>
    : <span className="badge-green">On Time</span>;

  const timerColor = isExceeded
    ? 'text-red-700 font-bold'
    : isApproaching
    ? 'text-orange-700 font-semibold'
    : 'text-green-700';

  const progressColor = isExceeded
    ? 'bg-red-400'
    : isApproaching
    ? 'bg-orange-400'
    : 'bg-green-400';

  return (
    <tr className={`${rowBg} transition-colors duration-300`}>
      <td className="table-cell font-semibold text-gray-900">{breakRecord.agentName}</td>
      <td className="table-cell">
        <span className="badge-blue">{breakRecord.team}</span>
      </td>
      <td className="table-cell">
        <span className="font-medium text-gray-700">
          {BREAK_TYPE_LABELS[breakRecord.breakType] || breakRecord.breakType}
        </span>
      </td>
      <td className="table-cell">
        <div className="flex flex-col gap-1">
          <span className={`font-mono text-base ${timerColor}`}>
            {formatElapsed(elapsed)}
          </span>
          <div className="w-24 bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-1000 ${progressColor}`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">
            Limit: {limit} min
          </span>
        </div>
      </td>
      <td className="table-cell text-gray-500 text-xs">
        {format(start, 'h:mm a')}
      </td>
      <td className="table-cell">{statusBadge}</td>
    </tr>
  );
}

function BreakCard({ breakRecord, now }) {
  const start = parseISO(breakRecord.startTime);
  const elapsed = differenceInSeconds(now, start);
  const limit = BREAK_LIMITS[breakRecord.breakType] || 30;
  const limitSecs = limit * 60;
  const percent = (elapsed / limitSecs) * 100;

  const isExceeded = percent > 100;
  const isApproaching = !isExceeded && percent >= 75;

  const cardBorder = isExceeded
    ? 'border-red-300 bg-red-50'
    : isApproaching
    ? 'border-orange-300 bg-orange-50'
    : 'border-green-300 bg-green-50';

  const timerColor = isExceeded
    ? 'text-red-700'
    : isApproaching
    ? 'text-orange-600'
    : 'text-green-700';

  const progressColor = isExceeded ? 'bg-red-400' : isApproaching ? 'bg-orange-400' : 'bg-green-400';

  const statusLabel = isExceeded ? '⚠️ Exceeded' : isApproaching ? '🟡 Approaching' : '✅ On Time';

  return (
    <div className={`rounded-xl border-2 p-4 ${cardBorder}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-gray-900">{breakRecord.agentName}</p>
          <span className="badge-blue mt-0.5">{breakRecord.team}</span>
        </div>
        <span className="text-xs font-medium text-gray-500">{statusLabel}</span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">
          {BREAK_TYPE_LABELS[breakRecord.breakType] || breakRecord.breakType}
        </span>
        <span className={`font-mono text-xl font-bold ${timerColor}`}>
          {formatElapsed(elapsed)}
        </span>
      </div>
      <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ${progressColor}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">
        Started {format(start, 'h:mm a')} · Limit {limit} min
      </p>
    </div>
  );
}

export default function ManagerView() {
  const [activeBreaks, setActiveBreaks] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const now = useNow();

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch('/api/breaks/active');
      if (!res.ok) throw new Error('Failed to fetch active breaks');
      const data = await res.json();
      setActiveBreaks(data);
      setLastRefresh(new Date());
      setError('');
    } catch (err) {
      setError('Unable to load active breaks. Retrying...');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActive();
    const interval = setInterval(fetchActive, 15000);
    return () => clearInterval(interval);
  }, [fetchActive]);

  // Counts by break type
  const counts = activeBreaks.reduce(
    (acc, b) => {
      acc[b.breakType] = (acc[b.breakType] || 0) + 1;
      return acc;
    },
    {}
  );

  const exceededCount = activeBreaks.filter(b => {
    const elapsed = differenceInSeconds(now, parseISO(b.startTime));
    const limit = BREAK_LIMITS[b.breakType] || 30;
    return elapsed > limit * 60;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Floor Manager View</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Live agent break status — auto-refreshes every 15 seconds
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-800">{format(now, 'h:mm:ss a')}</p>
            <p className="text-xs text-gray-400">{format(now, 'EEEE, MMM d')}</p>
          </div>
          <button
            onClick={fetchActive}
            disabled={loading}
            className="btn-secondary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {lastRefresh && (
        <p className="text-xs text-gray-400 -mt-3">
          Last updated: {format(lastRefresh, 'h:mm:ss a')}
        </p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-value text-blue-600">{activeBreaks.length}</div>
          <div className="stat-label">Agents on Break</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-green-600">{counts.qbb || 0}</div>
          <div className="stat-label">QBB</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-purple-600">{(counts.short || 0) + (counts.lunch || 0)}</div>
          <div className="stat-label">Short / Lunch</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-red-600">{exceededCount}</div>
          <div className="stat-label">Limit Exceeded</div>
        </div>
      </div>

      {/* Break Type Summary Bar */}
      {activeBreaks.length > 0 && (
        <div className="card flex flex-wrap gap-4">
          <span className="text-sm font-medium text-gray-600">Breakdown:</span>
          {Object.entries(counts).map(([type, count]) => (
            <span key={type} className="badge-blue">
              {BREAK_TYPE_LABELS[type] || type}: <strong>{count}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">⏳</div>
          <p>Loading active breaks...</p>
        </div>
      ) : activeBreaks.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🟢</div>
          <h3 className="text-xl font-semibold text-gray-700">All agents are available</h3>
          <p className="text-gray-400 mt-2 text-sm">No one is currently on break</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="card p-0 overflow-hidden hidden md:block">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-700">
                Active Breaks ({activeBreaks.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="table-header">Agent</th>
                    <th className="table-header">Team</th>
                    <th className="table-header">Break Type</th>
                    <th className="table-header">Elapsed / Progress</th>
                    <th className="table-header">Started</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeBreaks.map(b => (
                    <BreakRow key={b.id} breakRecord={b} now={now} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
            {activeBreaks.map(b => (
              <BreakCard key={b.id} breakRecord={b} now={now} />
            ))}
          </div>
        </>
      )}

      {/* Legend */}
      <div className="card py-3 px-4 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="font-medium">Color Guide:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-400 inline-block"></span>
          &lt; 75% of limit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-orange-400 inline-block"></span>
          75–100% of limit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400 inline-block"></span>
          Exceeded limit
        </span>
      </div>
    </div>
  );
}
