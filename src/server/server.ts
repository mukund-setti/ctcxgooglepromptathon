import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
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
