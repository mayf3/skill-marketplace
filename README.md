# Skill Marketplace

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A marketplace platform for AI Agent skills — discover, share, and install skills
for OpenClaw and other AI agent platforms.

AI Agent 技能市场平台 — 发现、分享和安装 AI Agent 技能。

## Features

- 📦 **Skill Discovery** — Browse and search available skills
- 🔌 **Easy Installation** — One-click install to your agent environment
- 🏷️ **Categorization** — Skills organized by category and use case
- 🔍 **Search** — Full-text search across skill descriptions
- 👤 **User Management** — JWT-based authentication
- 🔄 **SSO Integration** — Single sign-on with shared authentication
- 🚀 **API-First** — RESTful API for programmatic access

## Tech Stack

- **Backend**: Node.js + Express, Prisma ORM, PostgreSQL
- **Frontend**: React + TypeScript, Vite
- **Auth**: JWT with refresh tokens, SSO support
- **Cache**: Redis

## Quick Start

```bash
# Backend
cd backend
npm install
cp .env.example .env  # Edit as needed
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Environment

See `.env.example` for required environment variables (JWT secrets, DB, Redis).

## Project Structure

```
skill-marketplace/
├── backend/          # Express.js API server
├── frontend/         # React + Vite UI
└── docs/             # Documentation
```

## License

MIT
