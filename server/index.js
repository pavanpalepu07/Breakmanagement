const express = require('express');
const cors = require('cors');
const path = require('path');
const breaksRouter = require('./routes/breaks');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration — allow all origins so SharePoint iframes can call the API
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// API routes
app.use('/api/breaks', breaksRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve built client in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Break Management Server running on port ${PORT}`);
});

module.exports = app;
