import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO, differenceInSeconds } from 'date-fns';
import { useAuth } from '../auth.jsx';
import { getConfig } from '../config.js';
import { endBreak, getTodayBreaks, startBreak } from '../breaks.js';

const TEAMS = getConfig().teams;


const BREAK_TYPES = [
  { id: 'qbb', label: 'QBB', sublabel: 'Quick Bio Break', limit: 5, color: 'blue' },
  { id: 'short', label: 'Short Break', sublabel: '15 minutes', limit: 15, color: 'purple' },
  { id: 'lunch', label: 'Lunch / Dinner', sublabel: '30 minutes', limit: 30, color: 'orange' },
];

const BREAK_TYPE_MAP = {
  qbb: { label: 'QBB', limitMinutes: 5 },
  short: { label: 'Short Break', limitMinutes: 15 },
  lunch: { label: 'Lunch/Dinner', limitMinutes: 30 },
};

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return '-';
  if (minutes < 1) return '< 1 min';
  return `${minutes} min`;
}

function StatusBadge({ status }) {
  const map = {
    active: 'badge-blue',
    completed: 'badge-green',
    exceeded: 'badge-red',
  };
  const labels = { active: 'Active', completed: 'Completed', exceeded: 'Exceeded' };
  return <span className={map[status] || 'badge-gray'}>{labels[status] || status}</span>;
}

export default function AgentView() {
  const { email: agentId, name: savedName } = useAuth();
  const [savedTeam, setSavedTeam] = useState(() => localStorage.getItem('bm_agent_team') || '');
  const [teamInput, setTeamInput] = useState(TEAMS[0]);
  const isIdentified = !!savedTeam;

  const [activeBreak, setActiveBreak] = useState(null);
  const [todayBreaks, setTodayBreaks] = useState([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startingBreak, setStartingBreak] = useState('');

  const fetchTodayBreaks = useCallback(async () => {
    if (!agentId) return;
    try {
      const data = await getTodayBreaks(agentId);
      setTodayBreaks(data);
      // Find active break
      const active = data.find(b => !b.endTime);
      setActiveBreak(active || null);
    } catch (err) {
      console.error('Error fetching today breaks:', err);
    }
  }, [agentId]);

  // Poll today's breaks
  useEffect(() => {
    if (!isIdentified || !agentId) return;
    fetchTodayBreaks();
    const interval = setInterval(fetchTodayBreaks, 15000);
    return () => clearInterval(interval);
  }, [isIdentified, agentId, fetchTodayBreaks]);

  // Live elapsed timer
  useEffect(() => {
    if (!activeBreak) {
      setElapsedSeconds(0);
      return;
    }
    const compute = () => {
      const start = parseISO(activeBreak.startTime);
      setElapsedSeconds(differenceInSeconds(new Date(), start));
    };
    compute();
    const timer = setInterval(compute, 1000);
    return () => clearInterval(timer);
  }, [activeBreak]);

  function handleSetIdentity(e) {
    e.preventDefault();
    setSavedTeam(teamInput);
    localStorage.setItem('bm_agent_team', teamInput);
  }

  function handleChangeTeam() {
    setSavedTeam('');
    localStorage.removeItem('bm_agent_team');
  }

  async function handleStartBreak(breakType) {
    if (!agentId || loading) return;
    setStartingBreak(breakType);
    setLoading(true);
    setError('');
    try {
      const created = await startBreak({ email: agentId, name: savedName, team: savedTeam, breakType });
      setActiveBreak(created);
      await fetchTodayBreaks();
    } catch (err) {
      setError(err.message || 'Failed to start break');
    } finally {
      setLoading(false);
      setStartingBreak('');
    }
  }

  async function handleEndBreak() {
    if (!activeBreak || loading) return;
    setLoading(true);
    setError('');
    try {
      await endBreak(activeBreak);
      setActiveBreak(null);
      await fetchTodayBreaks();
    } catch (err) {
      setError(err.message || 'Failed to end break');
    } finally {
      setLoading(false);
    }
  }

  // ─── Identification form ─────────────────────────────────────────────────
  if (!isIdentified) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="card">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">☕</div>
            <h1 className="text-2xl font-bold text-gray-900">Break Management</h1>
            <p className="text-gray-500 mt-1 text-sm">Welcome, {savedName}. Pick your team to get started</p>
          </div>

          <form onSubmit={handleSetIdentity} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="label">Team</label>
              <select
                className="select"
                value={teamInput}
                onChange={e => setTeamInput(e.target.value)}
              >
                {TEAMS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn-primary w-full py-2.5">
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Agent Dashboard ──────────────────────────────────────────────────────
  const activeMeta = activeBreak ? BREAK_TYPE_MAP[activeBreak.breakType] : null;
  const limitSecs = activeMeta ? activeMeta.limitMinutes * 60 : 0;
  const percentUsed = limitSecs > 0 ? Math.min((elapsedSeconds / limitSecs) * 100, 100) : 0;
  const isOverLimit = elapsedSeconds > limitSecs && limitSecs > 0;
  const isApproaching = !isOverLimit && percentUsed >= 75;

  const progressColor = isOverLimit
    ? 'bg-red-500'
    : isApproaching
    ? 'bg-orange-400'
    : 'bg-green-500';

  const statusColor = isOverLimit
    ? 'text-red-600'
    : isApproaching
    ? 'text-orange-500'
    : activeBreak
    ? 'text-green-600'
    : 'text-gray-500';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Agent Header */}
      <div className="card flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Agent</p>
          <h2 className="text-xl font-bold text-gray-900">{savedName}</h2>
          <span className="badge badge-blue mt-1">{savedTeam}</span>
        </div>
        <button
          onClick={handleChangeTeam}
          className="btn-secondary text-xs"
        >
          Change Team
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Current Status */}
      <div className={`card border-2 ${activeBreak ? (isOverLimit ? 'border-red-300 bg-red-50' : isApproaching ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50') : 'border-gray-200'}`}>
        <div className="text-center">
          <div className={`text-4xl mb-2`}>
            {activeBreak ? (isOverLimit ? '⚠️' : '⏸️') : '✅'}
          </div>
          <p className={`text-lg font-semibold ${statusColor}`}>
            {activeBreak
              ? `On ${activeMeta?.label || 'Break'}`
              : 'Available'}
          </p>

          {activeBreak && (
            <>
              <div className="mt-4">
                <div className="text-5xl font-mono font-bold text-gray-800">
                  {formatElapsed(elapsedSeconds)}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Limit: {activeMeta?.limitMinutes} min
                  {isOverLimit && <span className="text-red-600 font-semibold ml-2">— Limit exceeded!</span>}
                  {isApproaching && !isOverLimit && <span className="text-orange-500 font-semibold ml-2">— Approaching limit</span>}
                </p>
              </div>

              {/* Progress bar */}
              <div className="mt-4 bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-1000 ${progressColor}`}
                  style={{ width: `${Math.min(percentUsed, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{Math.round(percentUsed)}% of limit used</p>

              <button
                onClick={handleEndBreak}
                disabled={loading}
                className="btn-danger mt-5 px-8 py-2.5"
              >
                {loading ? 'Ending...' : 'End Break'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Break Buttons */}
      {!activeBreak && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Start a Break</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {BREAK_TYPES.map(bt => {
              const colorMap = {
                blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-800',
                purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-800',
                orange: 'bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-800',
              };
              const isStarting = startingBreak === bt.id && loading;
              return (
                <button
                  key={bt.id}
                  onClick={() => handleStartBreak(bt.id)}
                  disabled={loading}
                  className={`flex flex-col items-center p-5 rounded-xl border-2 font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${colorMap[bt.color]}`}
                >
                  <span className="text-2xl mb-1">
                    {bt.id === 'qbb' ? '🚶' : bt.id === 'short' ? '☕' : '🍽️'}
                  </span>
                  <span className="font-bold">{bt.label}</span>
                  <span className="text-xs opacity-70 mt-0.5">{bt.sublabel}</span>
                  <span className="text-xs font-normal mt-1 opacity-60">({bt.limit} min limit)</span>
                  {isStarting && <span className="text-xs mt-1">Starting...</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's History */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Today's Break History</h3>

        {todayBreaks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm">No breaks taken today</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header">Type</th>
                  <th className="table-header">Start</th>
                  <th className="table-header">End</th>
                  <th className="table-header">Duration</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {todayBreaks.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">
                      {BREAK_TYPE_MAP[b.breakType]?.label || b.breakType}
                    </td>
                    <td className="table-cell text-gray-600">
                      {format(parseISO(b.startTime), 'h:mm a')}
                    </td>
                    <td className="table-cell text-gray-600">
                      {b.endTime ? format(parseISO(b.endTime), 'h:mm a') : <span className="text-blue-500 font-medium">Active</span>}
                    </td>
                    <td className="table-cell">
                      {b.endTime ? formatDuration(b.durationMinutes) : formatElapsed(elapsedSeconds)}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Daily Summary */}
        {todayBreaks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xl font-bold text-gray-800">{todayBreaks.length}</div>
              <div className="text-xs text-gray-500">Total Breaks</div>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800">
                {todayBreaks.filter(b => b.endTime).reduce((sum, b) => sum + (b.durationMinutes || 0), 0)} min
              </div>
              <div className="text-xs text-gray-500">Total Time</div>
            </div>
            <div>
              <div className="text-xl font-bold text-red-600">
                {todayBreaks.filter(b => b.status === 'exceeded').length}
              </div>
              <div className="text-xs text-gray-500">Exceeded</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
