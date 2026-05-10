import cors from 'cors';
import { randomUUID } from 'crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { categoriesRouter } from './routes/categories.js';
import { skillsRouter } from './routes/skills.js';
import { searchRouter } from './routes/search.js';
import { applicationsRouter } from './routes/applications.js';
import { reviewsRouter } from './routes/reviews.js';
import { adminRouter } from './routes/admin.js';
import { errorHandler } from './middleware/error-handler.js';
import { HttpError } from './utils/http-error.js';

export const app = express();

// Request ID
app.use((req, _res, next) => {
  req.requestId = randomUUID();
  _res.setHeader('x-request-id', req.requestId);
  next();
});

// CORS
app.use(cors({
  origin: env.FRONTEND_ORIGIN === '*' ? true : env.FRONTEND_ORIGIN,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// 速率限制
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: '请求过于频繁，请稍后再试' },
});

// Health
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'skill-marketplace-backend',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/search', searchRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/admin', adminRouter);

// 404
app.use((_req, _res, next) => {
  next(new HttpError(404, '接口不存在'));
});

// Error handler
app.use(errorHandler);
