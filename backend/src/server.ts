import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import recruitmentRoutes from './routes/recruitment.routes.js';
import { initMonitoringScheduler } from './services/recruitment/scheduler.service.js';

const app = express();
const PORT = process.env.PORT ?? 5000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
];

// --- Middleware ---
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (for example, Postman/server-to-server)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS: Origin ${origin} is not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json());

// --- Health check ---
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'SarkariJob API',
  });
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/recruitments', recruitmentRoutes);

// --- 404 catch-all ---
app.use((_req, res) => {
  res.status(404).json({
    message: 'Route not found.',
  });
});

app.listen(PORT, () => {
  console.log(`SarkariJob API running on http://localhost:${PORT}`);

  // Initialize background recruitment monitoring scheduler if enabled via .env
  initMonitoringScheduler();
});

export default app;