import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  // 创建管理员
  const adminPassword = await bcrypt.hash('admin123456', 10);
  const userPassword = await bcrypt.hash('user123456', 10);

  await prisma.user.upsert({
    where: { email: 'admin@skill.dev' },
    update: {},
    create: { name: '系统管理员', email: 'admin@skill.dev', password: adminPassword, role: 'admin' },
  });

  await prisma.user.upsert({
    where: { email: 'publisher@skill.dev' },
    update: {},
    create: { name: '技能发布者', email: 'publisher@skill.dev', password: userPassword, role: 'publisher' },
  });

  await prisma.user.upsert({
    where: { email: 'user@skill.dev' },
    update: {},
    create: { name: '普通用户', email: 'user@skill.dev', password: userPassword, role: 'user' },
  });

  // 创建分类
  const categories = [
    { name: 'AI Agent', slug: 'ai-agent', description: 'AI Agent 相关技能', icon: '🤖' },
    { name: 'DevOps', slug: 'devops', description: '运维与 CI/CD', icon: '🔧' },
    { name: '前端开发', slug: 'frontend', description: '前端工具与组件', icon: '🎨' },
    { name: '后端开发', slug: 'backend', description: '后端框架与库', icon: '⚙️' },
    { name: '数据处理', slug: 'data', description: 'ETL 与分析工具', icon: '📊' },
    { name: '安全工具', slug: 'security', description: '安全扫描与审计', icon: '🔒' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log('Seed completed.');
  console.log('Admin: admin@skill.dev / admin123456');
  console.log('Publisher: publisher@skill.dev / user123456');
  console.log('User: user@skill.dev / user123456');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
