import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO, subDays } from 'date-fns';

const TEAMS = ['', 'Sales', 'Support', 'Tech', 'Billing', 'Collections'];
const BREAK_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'qbb', label: 'QBB' },
  { value: 'short', label: 'Short Break' },
  { value: 'lunch', label: 'Lunch/Dinner' },
];
const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'exceeded', label: 'Exceeded' },
];
const BREAK_TYPE_LABELS = { qbb: 'QBB', short: 'Short Break', lunch: 'Lunch/Dinner' };
const PAGE_SIZE = 25;

function toLocalDateString(date) {
  return format(date, 'yyyy-MM-dd');
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

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
      <p className="text-sm text-gray-500">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPage(1)}
          disabled={page === 1}
          className="btn-secondary px-2 py-1 text-xs disabled:opacity-40"
        >
          «
        </button>
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="btn-secondary px-2 py-1 text-xs disabled:opacity-40"
        >
          ‹
        </button>
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              p === page
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="btn-secondary px-2 py-1 text-xs disabled:opacity-40"
        >
          ›
        </button>
        <button
          onClick={() => onPage(totalPages)}
          disabled={page === totalPages}
          className="btn-secondary px-2 py-1 text-xs disabled:opacity-40"
        >
          »
        </button>
      </div>
    </div>
  );
}

export default function AdminView() {
  const [from, setFrom] = useState(toLocalDateString(subDays(new Date(), 29)));
  const [to, setTo] = useState(toLocalDateString(new Date()));
  const [agentSearch, setAgentSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [breakTypeFilter, setBreakTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [breaks, setBreaks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  function buildParams() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (teamFilter) params.set('team', teamFilter);
    if (breakTypeFilter) params.set('breakType', breakTypeFilter);
    return params;
  }

  const fetchBreaks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = buildParams();
      const [histRes, statsRes] = await Promise.all([
        fetch(`/api/breaks/history?${params.toString()}`),
        fetch(`/api/breaks/stats?${params.toString()}`),
      ]);
      if (!histRes.ok) throw new Error('Failed to fetch breaks');
      if (!statsRes.ok) throw new Error('Failed to fetch stats');

      const histData = await histRes.json();
      const statsData = await statsRes.json();
      setBreaks(histData);
      setStats(statsData);
      setPage(1);
    } catch (err) {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [from, to, teamFilter, breakTypeFilter]);

  useEffect(() => {
    fetchBreaks();
  }, [fetchBreaks]);

  // Client-side filter by agent name search and status
  const filtered = breaks.filter(b => {
    if (agentSearch && !b.agentName.toLowerCase().includes(agentSearch.toLowerCase())) return false;
    if (statusFilter && b.status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleExportCSV() {
    const params = buildParams();
    window.open(`/api/breaks/export?${params.toString()}`, '_blank');
  }

  function handleApplyFilters(e) {
    e.preventDefault();
    fetchBreaks();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500 mt-0.5">Full break history with filtering and export</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="btn-secondary flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export to CSV
        </button>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="stat-value text-blue-600">{stats.totalBreaks}</div>
            <div className="stat-label">Total Breaks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-green-600">
              {stats.byType?.qbb || 0}
            </div>
            <div className="stat-label">QBB</div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-purple-600">
              {stats.byType?.short || 0}
            </div>
            <div className="stat-label">Short Breaks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value text-orange-600">
              {stats.byType?.lunch || 0}
            </div>
            <div className="stat-label">Lunch / Dinner</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <form onSubmit={handleApplyFilters} className="card">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm">Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div>
            <label className="label">From Date</label>
            <input
              type="date"
              className="input"
              value={from}
              max={to}
              onChange={e => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label">To Date</label>
            <input
              type="date"
              className="input"
              value={to}
              min={from}
              max={toLocalDateString(new Date())}
              onChange={e => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Agent Name</label>
            <input
              type="text"
              className="input"
              value={agentSearch}
              onChange={e => { setAgentSearch(e.target.value); setPage(1); }}
              placeholder="Search by name..."
            />
          </div>
          <div>
            <label className="label">Team</label>
            <select
              className="select"
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
            >
              <option value="">All Teams</option>
              {TEAMS.filter(Boolean).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Break Type</label>
            <select
              className="select"
              value={breakTypeFilter}
              onChange={e => setBreakTypeFilter(e.target.value)}
            >
              {BREAK_TYPES.map(bt => (
                <option key={bt.value} value={bt.value}>{bt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="select"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
            <button type="submit" className="btn-primary flex-1">
              Apply Filters
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setFrom(toLocalDateString(subDays(new Date(), 29)));
                setTo(toLocalDateString(new Date()));
                setAgentSearch('');
                setTeamFilter('');
                setBreakTypeFilter('');
                setStatusFilter('');
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-700">
            {loading ? 'Loading...' : `${filtered.length} records`}
          </h3>
          <p className="text-xs text-gray-400">Showing {PAGE_SIZE} per page</p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-3xl mb-3 animate-pulse">⏳</div>
            <p className="text-sm">Loading break data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-medium text-gray-600">No records found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="table-header">Date</th>
                  <th className="table-header">Agent</th>
                  <th className="table-header">Team</th>
                  <th className="table-header">Break Type</th>
                  <th className="table-header">Start</th>
                  <th className="table-header">End</th>
                  <th className="table-header">Duration</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell text-gray-500 text-xs whitespace-nowrap">
                      {format(parseISO(b.startTime), 'MMM d, yyyy')}
                    </td>
                    <td className="table-cell font-medium text-gray-900">
                      {b.agentName}
                    </td>
                    <td className="table-cell">
                      <span className="badge-blue">{b.team}</span>
                    </td>
                    <td className="table-cell text-gray-700">
                      {BREAK_TYPE_LABELS[b.breakType] || b.breakType}
                    </td>
                    <td className="table-cell text-gray-500 text-xs whitespace-nowrap">
                      {format(parseISO(b.startTime), 'h:mm a')}
                    </td>
                    <td className="table-cell text-gray-500 text-xs whitespace-nowrap">
                      {b.endTime ? format(parseISO(b.endTime), 'h:mm a') : (
                        <span className="text-blue-500">Active</span>
                      )}
                    </td>
                    <td className="table-cell text-gray-700">
                      {b.durationMinutes !== null
                        ? `${b.durationMinutes} min`
                        : <span className="text-gray-400">-</span>
                      }
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-4">
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
