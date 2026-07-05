import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { incidentsRouter } from './incidents/router';
import { startLocalLoop } from './ingestion/scheduler';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/incidents', incidentsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve the built Vite frontend from this same service, so the SPA and the API
// share one origin. That means no VITE_API_BASE_URL is needed (the client hits
// "/api/*" on its own host) and one Railway container serves everything.
// Guarded on existence so local dev (Vite dev server on :5173) is unaffected.
const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback: any non-API route returns index.html for client-side routing.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log(`[server] serving frontend from ${distDir}`);
} else {
  console.log('[server] no dist/ found; running API-only (use Vite dev server for UI)');
}

// Start Ingestion Scheduler Background Loop
const intervalId = startLocalLoop();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received. Shutting down gracefully...');
  clearInterval(intervalId);
  process.exit(0);
});

app.listen(Number(PORT), '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[server] HazAlert scaled backend listening on 0.0.0.0:${PORT}`);
});
