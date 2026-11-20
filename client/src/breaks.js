import { differenceInSeconds, endOfDay, format, parseISO, startOfDay } from 'date-fns';
import { createItem, escapeOData, queryItems, updateItem } from './graph.js';

export const BREAK_LIMITS = { qbb: 5, short: 15, lunch: 30 };
export const BREAK_TYPE_LABELS = { qbb: 'QBB', short: 'Short Break', lunch: 'Lunch/Dinner' };

function enrich(f) {
  const limit = BREAK_LIMITS[f.BreakType] || 30;
  const active = !f.EndTime;
  const elapsedSec = active ? differenceInSeconds(new Date(), parseISO(f.StartTime)) : null;
  const elapsedMinutes = active ? Math.floor(elapsedSec / 60) : f.DurationMinutes;
  let status = f.Status;
  if (active) status = elapsedSec > limit * 60 ? 'exceeded' : 'active';
  return {
    id: f.id,
    agentId: (f.AgentEmail || '').toLowerCase(),
    agentName: f.Title || f.AgentEmail,
    team: f.Team || 'Unknown',
    breakType: f.BreakType,
    startTime: f.StartTime,
    endTime: f.EndTime || null,
    durationMinutes: f.DurationMinutes ?? null,
    status,
    elapsedMinutes,
    limitMinutes: limit,
    percentUsed: active ? Math.round((elapsedSec / (limit * 60)) * 100) : null,
  };
}

const bySoonest = (a, b) => new Date(b.startTime) - new Date(a.startTime);

export async function getActiveBreaks() {
  const items = await queryItems("fields/Status eq 'active'");
  return items.filter(i => !i.EndTime).map(enrich).sort(bySoonest);
}

export async function getMyActiveBreak(email) {
  const items = await queryItems(`fields/AgentEmail eq '${escapeOData(email)}' and fields/Status eq 'active'`);
  const open = items.filter(i => !i.EndTime).map(enrich);
  return open[0] || null;
}

export async function getHistory({ from, to, agentId } = {}) {
  const parts = [];
  if (from) parts.push(`fields/StartTime ge '${startOfDay(parseISO(from)).toISOString()}'`);
  if (to) parts.push(`fields/StartTime le '${endOfDay(parseISO(to)).toISOString()}'`);
  if (agentId) parts.push(`fields/AgentEmail eq '${escapeOData(agentId)}'`);
  const items = await queryItems(parts.join(' and '));
  return items.map(enrich).sort(bySoonest);
}

export async function getTodayBreaks(email) {
  const today = format(new Date(), 'yyyy-MM-dd');
  return getHistory({ from: today, to: today, agentId: email });
}

export async function startBreak({ email, name, team, breakType }) {
  if (!BREAK_LIMITS[breakType]) throw new Error('Invalid break type');
  const existing = await getMyActiveBreak(email);
  if (existing) throw new Error('You already have an active break');
  const created = await createItem({
    Title: name,
    AgentEmail: email,
    Team: team,
    BreakType: breakType,
    StartTime: new Date().toISOString(),
    Status: 'active',
  });
  return enrich(created);
}

export async function endBreak(brk) {
  const seconds = differenceInSeconds(new Date(), parseISO(brk.startTime));
  const limit = BREAK_LIMITS[brk.breakType] || 30;
  await updateItem(brk.id, {
    EndTime: new Date().toISOString(),
    DurationMinutes: Math.round((seconds / 60) * 10) / 10,
    Status: seconds > limit * 60 ? 'exceeded' : 'completed',
  });
}

export function filterBreaks(breaks, { team, breakType } = {}) {
  return breaks.filter(
    b =>
      (!team || b.team.toLowerCase() === team.toLowerCase()) && (!breakType || b.breakType === breakType)
  );
}

export function computeStats(allBreaks) {
  const breaks = allBreaks.filter(b => b.endTime);
  const byType = { qbb: 0, short: 0, lunch: 0 };
  const sums = { qbb: 0, short: 0, lunch: 0 };
  const byTeam = {};
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));

  for (const b of breaks) {
    if (byType[b.breakType] !== undefined) {
      byType[b.breakType]++;
      sums[b.breakType] += b.durationMinutes || 0;
    }
    byTeam[b.team] = (byTeam[b.team] || 0) + 1;
    byHour[parseISO(b.startTime).getHours()].count++;
  }

  const avgDurationByType = {};
  for (const t of Object.keys(byType)) {
    avgDurationByType[t] = byType[t] ? Math.round((sums[t] / byType[t]) * 10) / 10 : 0;
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1])[0];

  return {
    totalBreaks: breaks.length,
    todayCount: allBreaks.filter(b => format(parseISO(b.startTime), 'yyyy-MM-dd') === todayStr).length,
    mostUsedBreakType: breaks.length ? top(byType)[0] : 'N/A',
    topTeam: breaks.length ? top(byTeam)[0] : 'N/A',
    byType,
    avgDurationByType,
    byTeam: Object.entries(byTeam).map(([team, count]) => ({ team, count })),
    byHour,
    limits: BREAK_LIMITS,
  };
}

const csvCell = value => {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export function downloadCsv(breaks) {
  const headers = ['ID', 'Agent Name', 'Agent Email', 'Team', 'Break Type', 'Start Time', 'End Time', 'Duration (min)', 'Status'];
  const fmt = iso => (iso ? format(parseISO(iso), 'yyyy-MM-dd HH:mm:ss') : '');
  const rows = breaks.map(b => [
    b.id,
    b.agentName,
    b.agentId,
    b.team,
    BREAK_TYPE_LABELS[b.breakType] || b.breakType,
    fmt(b.startTime),
    fmt(b.endTime),
    b.durationMinutes ?? '',
    b.status,
  ]);
  const csv = '﻿' + [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `breaks-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
