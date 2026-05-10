import 'dotenv/config';
import { app } from './app.js';
import { env } from './config/env.js';
import { redis } from './lib/redis.js';
import { prisma } from './lib/prisma.js';

async function main() {
  // 尝试连接 Redis
  try {
    await redis.connect();
    console.log('Redis connected');
  } catch {
    console.warn('Redis unavailable, running without cache');
  }

  // 验证数据库连接
  await prisma.$connect();
  console.log('Database connected');

  app.listen(env.PORT, () => {
    console.log(`Skill Marketplace API running on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
