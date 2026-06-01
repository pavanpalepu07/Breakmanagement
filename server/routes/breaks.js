const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { format, parseISO, startOfDay, endOfDay, isWithinInterval, differenceInMinutes } = require('date-fns');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'breaks.json');

const BREAK_LIMITS = {
  qbb: 5,
  short: 15,
  lunch: 30,
};

// Ensure data directory and file exist
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function readBreaks() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeBreaks(breaks) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(breaks, null, 2), 'utf8');
}

function computeStatus(breakRecord) {
  if (breakRecord.endTime) {
    const duration = differenceInMinutes(
      parseISO(breakRecord.endTime),
      parseISO(breakRecord.startTime)
    );
    const limit = BREAK_LIMITS[breakRecord.breakType] || 30;
    return duration > limit ? 'exceeded' : 'completed';
  }
  // Active break — check if exceeded
  const elapsed = differenceInMinutes(new Date(), parseISO(breakRecord.startTime));
  const limit = BREAK_LIMITS[breakRecord.breakType] || 30;
  return elapsed > limit ? 'exceeded' : 'active';
}

// POST /api/breaks/start
router.post('/start', (req, res) => {
  const { agentId, agentName, team, breakType } = req.body;

  if (!agentId || !agentName || !team || !breakType) {
    return res.status(400).json({ error: 'agentId, agentName, team, and breakType are required' });
  }

  if (!BREAK_LIMITS[breakType]) {
    return res.status(400).json({ error: `Invalid breakType. Must be one of: ${Object.keys(BREAK_LIMITS).join(', ')}` });
  }

  const breaks = readBreaks();

  // Check if agent already has an active break
  const activeBreak = breaks.find(b => b.agentId === agentId && !b.endTime);
  if (activeBreak) {
    return res.status(409).json({ error: 'Agent already has an active break', activeBreak });
  }

  const newBreak = {
    id: uuidv4(),
    agentId,
    agentName,
    team,
    breakType,
    startTime: new Date().toISOString(),
    endTime: null,
    durationMinutes: null,
    status: 'active',
  };

  breaks.push(newBreak);
  writeBreaks(breaks);

  res.status(201).json(newBreak);
});

// POST /api/breaks/end
router.post('/end', (req, res) => {
  const { breakId } = req.body;

  if (!breakId) {
    return res.status(400).json({ error: 'breakId is required' });
  }

  const breaks = readBreaks();
  const index = breaks.findIndex(b => b.id === breakId);

  if (index === -1) {
    return res.status(404).json({ error: 'Break not found' });
  }

  if (breaks[index].endTime) {
    return res.status(409).json({ error: 'Break already ended' });
  }

  const endTime = new Date().toISOString();
  const durationMinutes = differenceInMinutes(
    parseISO(endTime),
    parseISO(breaks[index].startTime)
  );
  const limit = BREAK_LIMITS[breaks[index].breakType] || 30;

  breaks[index].endTime = endTime;
  breaks[index].durationMinutes = durationMinutes;
  breaks[index].status = durationMinutes > limit ? 'exceeded' : 'completed';

  writeBreaks(breaks);

  res.json(breaks[index]);
});

// GET /api/breaks/active
router.get('/active', (req, res) => {
  const breaks = readBreaks();
  const active = breaks
    .filter(b => !b.endTime)
    .map(b => {
      const elapsed = differenceInMinutes(new Date(), parseISO(b.startTime));
      const limit = BREAK_LIMITS[b.breakType] || 30;
      return {
        ...b,
        elapsedMinutes: elapsed,
        limitMinutes: limit,
        status: elapsed > limit ? 'exceeded' : 'active',
        percentUsed: Math.round((elapsed / limit) * 100),
      };
    });
  res.json(active);
});

// GET /api/breaks/history
router.get('/history', (req, res) => {
  const { agentId, team, breakType, from, to } = req.query;

  let breaks = readBreaks();

  if (agentId) {
    breaks = breaks.filter(b => b.agentId === agentId);
  }
  if (team) {
    breaks = breaks.filter(b => b.team.toLowerCase() === team.toLowerCase());
  }
  if (breakType) {
    breaks = breaks.filter(b => b.breakType === breakType);
  }
  if (from) {
    const fromDate = startOfDay(parseISO(from));
    breaks = breaks.filter(b => parseISO(b.startTime) >= fromDate);
  }
  if (to) {
    const toDate = endOfDay(parseISO(to));
    breaks = breaks.filter(b => parseISO(b.startTime) <= toDate);
  }

  // Sort by startTime descending
  breaks.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  res.json(breaks);
});

// GET /api/breaks/agent/:agentId/today
router.get('/agent/:agentId/today', (req, res) => {
  const { agentId } = req.params;
  const breaks = readBreaks();

  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const todayBreaks = breaks
    .filter(b => {
      if (b.agentId !== agentId) return false;
      const start = parseISO(b.startTime);
      return isWithinInterval(start, { start: dayStart, end: dayEnd });
    })
    .map(b => {
      const elapsed = b.endTime
        ? b.durationMinutes
        : differenceInMinutes(new Date(), parseISO(b.startTime));
      const limit = BREAK_LIMITS[b.breakType] || 30;
      return {
        ...b,
        elapsedMinutes: elapsed,
        limitMinutes: limit,
        status: b.endTime
          ? b.status
          : elapsed > limit ? 'exceeded' : 'active',
      };
    })
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  res.json(todayBreaks);
});

// GET /api/breaks/stats
router.get('/stats', (req, res) => {
  const { from, to, agentId, team } = req.query;

  let breaks = readBreaks().filter(b => b.endTime); // Only completed breaks for stats

  if (agentId) {
    breaks = breaks.filter(b => b.agentId === agentId);
  }
  if (team) {
    breaks = breaks.filter(b => b.team.toLowerCase() === team.toLowerCase());
  }
  if (from) {
    const fromDate = startOfDay(parseISO(from));
    breaks = breaks.filter(b => parseISO(b.startTime) >= fromDate);
  }
  if (to) {
    const toDate = endOfDay(parseISO(to));
    breaks = breaks.filter(b => parseISO(b.startTime) <= toDate);
  }

  // Breaks by type
  const byType = { qbb: 0, short: 0, lunch: 0 };
  const durationByType = { qbb: [], short: [], lunch: [] };
  const byTeam = {};
  const byHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));

  for (const b of breaks) {
    if (byType[b.breakType] !== undefined) {
      byType[b.breakType]++;
      durationByType[b.breakType].push(b.durationMinutes || 0);
    }

    const teamKey = b.team || 'Unknown';
    byTeam[teamKey] = (byTeam[teamKey] || 0) + 1;

    const hour = parseISO(b.startTime).getHours();
    byHour[hour].count++;
  }

  const avgDurationByType = {};
  for (const [type, durations] of Object.entries(durationByType)) {
    avgDurationByType[type] = durations.length > 0
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
      : 0;
  }

  // Today's breaks count
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);
  const allBreaks = readBreaks();
  const todayCount = allBreaks.filter(b => {
    const start = parseISO(b.startTime);
    return isWithinInterval(start, { start: dayStart, end: dayEnd });
  }).length;

  // Most used break type
  const mostUsed = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  // Team with most breaks
  const topTeam = Object.entries(byTeam).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  res.json({
    totalBreaks: breaks.length,
    todayCount,
    mostUsedBreakType: mostUsed,
    topTeam,
    byType,
    avgDurationByType,
    byTeam: Object.entries(byTeam).map(([team, count]) => ({ team, count })),
    byHour,
    limits: BREAK_LIMITS,
  });
});

// GET /api/breaks/export
router.get('/export', (req, res) => {
  const { agentId, team, breakType, from, to } = req.query;

  let breaks = readBreaks();

  if (agentId) {
    breaks = breaks.filter(b => b.agentId === agentId);
  }
  if (team) {
    breaks = breaks.filter(b => b.team.toLowerCase() === team.toLowerCase());
  }
  if (breakType) {
    breaks = breaks.filter(b => b.breakType === breakType);
  }
  if (from) {
    const fromDate = startOfDay(parseISO(from));
    breaks = breaks.filter(b => parseISO(b.startTime) >= fromDate);
  }
  if (to) {
    const toDate = endOfDay(parseISO(to));
    breaks = breaks.filter(b => parseISO(b.startTime) <= toDate);
  }

  breaks.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  const BREAK_TYPE_LABELS = { qbb: 'QBB', short: 'Short Break', lunch: 'Lunch/Dinner' };

  const headers = ['ID', 'Agent Name', 'Team', 'Break Type', 'Start Time', 'End Time', 'Duration (min)', 'Status'];
  const rows = breaks.map(b => [
    b.id,
    b.agentName,
    b.team,
    BREAK_TYPE_LABELS[b.breakType] || b.breakType,
    b.startTime ? format(parseISO(b.startTime), 'yyyy-MM-dd HH:mm:ss') : '',
    b.endTime ? format(parseISO(b.endTime), 'yyyy-MM-dd HH:mm:ss') : '',
    b.durationMinutes !== null ? b.durationMinutes : '',
    b.status,
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const filename = `breaks-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});

module.exports = router;
