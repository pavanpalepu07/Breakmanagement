import React, { useState, useEffect, useCallback } from 'react';
import { format, subDays, parseISO, startOfDay } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { useAuth } from '../auth.jsx';
import { getConfig } from '../config.js';
import { BREAK_LIMITS, BREAK_TYPE_LABELS, computeStats, filterBreaks, getHistory } from '../breaks.js';

const TEAMS = getConfig().teams;



const CHART_COLORS = {
  qbb: '#3b82f6',
  short: '#8b5cf6',
  lunch: '#f97316',
};

function toLocalDateString(date) {
  return format(date, 'yyyy-MM-dd');
}

function SummaryCard({ value, label, color = 'text-gray-900', sub }) {
  return (
    <div className="stat-card">
      <div className={`stat-value ${color}`}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill || p.color }}>
          {p.name}: <strong>{p.value}</strong>
          {p.unit || ''}
        </p>
      ))}
    </div>
  );
};

export default function DashboardView() {
  const { email, role } = useAuth();
  const isAgent = role === 'agent';
  const [from, setFrom] = useState(toLocalDateString(subDays(new Date(), 6)));
  const [to, setTo] = useState(toLocalDateString(new Date()));
  const [agentFilter, setAgentFilter] = useState(isAgent ? email : '');
  const [teamFilter, setTeamFilter] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const agentId = isAgent ? email : agentFilter;
      const data = await getHistory({ from, to, agentId });
      setStats(computeStats(filterBreaks(data, { team: teamFilter })));
    } catch (err) {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [from, to, agentFilter, teamFilter, isAgent, email]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function applyMyHistory() {
    setAgentFilter(email);
    setTeamFilter('');
  }

  // Chart data
  const breakTypeChartData = stats
    ? Object.entries(BREAK_TYPE_LABELS).map(([type, label]) => ({
        name: label,
        count: stats.byType[type] || 0,
        fill: CHART_COLORS[type],
      }))
    : [];

  const avgDurationChartData = stats
    ? Object.entries(BREAK_TYPE_LABELS).map(([type, label]) => ({
        name: label,
        avg: stats.avgDurationByType[type] || 0,
        limit: BREAK_LIMITS[type],
        fill: CHART_COLORS[type],
      }))
    : [];

  const byTeamChartData = stats
    ? stats.byTeam.sort((a, b) => b.count - a.count)
    : [];

  const byHourChartData = stats
    ? stats.byHour.filter(h => h.count > 0 || (h.hour >= 7 && h.hour <= 22)).map(h => ({
        hour: `${h.hour === 0 ? 12 : h.hour > 12 ? h.hour - 12 : h.hour}${h.hour < 12 ? 'am' : 'pm'}`,
        count: h.count,
      }))
    : [];

  // If no data, show all hours 7am-10pm
  const hourRange = Array.from({ length: 16 }, (_, i) => {
    const h = i + 7;
    const label = `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? 'am' : 'pm'}`;
    const found = (stats?.byHour || []).find(x => x.hour === h);
    return { hour: label, count: found ? found.count : 0 };
  });

  const mostUsedLabel = stats
    ? BREAK_TYPE_LABELS[stats.mostUsedBreakType] || stats.mostUsedBreakType
    : '-';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Historical Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">{isAgent ? 'Your personal break history and trends' : 'Analytics and trends for break activity'}</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 flex-wrap">
          <div>
            <label className="label">From Date</label>
            <input
              type="date"
              className="input w-40"
              value={from}
              max={to}
              onChange={e => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label">To Date</label>
            <input
              type="date"
              className="input w-40"
              value={to}
              min={from}
              max={toLocalDateString(new Date())}
              onChange={e => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Team</label>
            <select
              className="select w-36"
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
            >
              <option value="">All Teams</option>
              {TEAMS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            {!isAgent && (
              <button onClick={applyMyHistory} className="btn-secondary text-xs">
                My History
              </button>
            )}
            {!isAgent && agentFilter && (
              <button
                onClick={() => setAgentFilter('')}
                className="btn-secondary text-xs"
              >
                Clear Agent Filter
              </button>
            )}
            <button onClick={fetchStats} className="btn-primary text-xs">
              Apply
            </button>
          </div>
        </div>
        {agentFilter && (
          <div className="mt-3 text-xs text-blue-600 bg-blue-50 rounded px-3 py-1.5 inline-block">
            {isAgent ? 'Showing your own break history' : <>Filtered to agent: <strong>{agentFilter}</strong></>}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card text-center py-16 text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">📊</div>
          <p>Loading dashboard data...</p>
        </div>
      ) : stats ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard
              value={stats.todayCount}
              label="Breaks Today"
              color="text-blue-600"
            />
            <SummaryCard
              value={stats.totalBreaks}
              label="Total in Range"
              color="text-purple-600"
            />
            <SummaryCard
              value={mostUsedLabel}
              label="Most Used Type"
              color="text-green-700"
            />
            <SummaryCard
              value={stats.topTeam === 'N/A' ? '-' : stats.topTeam}
              label="Top Team"
              color="text-orange-600"
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Breaks by Type */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Break Count by Type</h3>
              {stats.totalBreaks === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No data for this range</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={breakTypeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="count" name="Breaks" radius={[4, 4, 0, 0]}>
                      {breakTypeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Average Duration vs Limit */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-1">Avg Duration vs Limit</h3>
              <p className="text-xs text-gray-400 mb-4">Dashed line = break limit</p>
              {stats.totalBreaks === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No data for this range</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={avgDurationChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      label={{ value: 'min', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10 } }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = avgDurationChartData.find(x => x.name === label);
                        return (
                          <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-3 text-sm">
                            <p className="font-semibold text-gray-800 mb-1">{label}</p>
                            <p style={{ color: d?.fill }}>Avg: <strong>{payload[0]?.value} min</strong></p>
                            <p className="text-gray-500">Limit: {d?.limit} min</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="avg" name="Avg Duration" radius={[4, 4, 0, 0]}>
                      {avgDurationChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {/* Show limits as a legend */}
              <div className="flex flex-wrap gap-3 mt-3">
                {avgDurationChartData.map(d => (
                  <span key={d.name} className="text-xs text-gray-500">
                    <span style={{ color: d.fill }} className="font-semibold">{d.name}</span> limit: {d.limit} min
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Breaks by Team */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Breaks by Team</h3>
              {byTeamChartData.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No data for this range</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={byTeamChartData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    layout="horizontal"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="team" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="count" name="Breaks" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Breaks by Hour */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Break Frequency by Hour</h3>
              {stats.totalBreaks === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No data for this range</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hourRange} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 9 }}
                      interval={1}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar
                      dataKey="count"
                      name="Breaks"
                      radius={[3, 3, 0, 0]}
                    >
                      {hourRange.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.count === 0 ? '#e5e7eb' : entry.count >= 5 ? '#ef4444' : entry.count >= 3 ? '#f97316' : '#3b82f6'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="flex gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded bg-blue-400 inline-block"></span> Low
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded bg-orange-400 inline-block"></span> Medium (3-4)
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded bg-red-400 inline-block"></span> High (5+)
                </span>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
