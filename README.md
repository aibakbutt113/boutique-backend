# Boutique API

NestJS + Prisma + PostgreSQL. Ships with a Docker setup: **Postgres, the API and Caddy (automatic HTTPS)** start with one command.

## Deploy on AWS EC2

1. **Launch an instance** (Ubuntu 24.04, `t3.small` or larger). In its security group allow inbound **22** (SSH, your IP only), **80** and **443**. Do not open 4000 or 5432.
2. **Point a domain at it** (an *A record* to the instance's Elastic IP), for example `api.yourshop.pk`. HTTPS needs a domain name; a free `1-2-3-4.nip.io` style name also works.
3. **Install Docker** on the instance:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # then log out and back in
   ```
4. **Clone and configure:**
   ```bash
   git clone <this repo> boutique-backend && cd boutique-backend
   cp .env.example .env
   nano .env
   ```
   Set at least: `API_DOMAIN`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_PASSWORD`, `FRONTEND_URL`, `ADMIN_URL` (`openssl rand -hex 32` makes good secrets). Set `RUN_SEED=true` for the first start only.
5. **Start it:**
   ```bash
   docker compose up -d --build
   docker compose logs -f api      # wait for "Starting API on port 4000"
   ```
6. **Check it:** `curl https://api.yourshop.pk/api/shipping/rates` should return JSON. Then set `RUN_SEED=false` in `.env` and run `docker compose up -d`.
7. **Point the frontends at it.** In the storefront and admin projects (Vercel), set `NEXT_PUBLIC_API_URL=https://api.yourshop.pk/api` and redeploy. `FRONTEND_URL` / `ADMIN_URL` in `.env` must be their exact URLs, or the browser blocks requests (CORS).

The admin login is `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

## Everyday commands

| Task | Command |
|---|---|
| Update to the latest code | `git pull && docker compose up -d --build` |
| View logs | `docker compose logs -f api` |
| Restart | `docker compose restart api` |
| Stop everything | `docker compose down` (data is kept) |
| Back up the database | `docker compose exec -T db pg_dump -U postgres boutique > backup.sql` |
| Restore a backup | `docker compose exec -T db psql -U postgres boutique < backup.sql` |
| Re-run the seed | set `RUN_SEED=true`, `docker compose up -d`, then set it back to `false` |

Database migrations are applied automatically each time the API starts.

## What is stored where

Docker volumes keep your data across rebuilds and restarts: `pgdata` (database), `uploads` (product images uploaded from the admin) and `caddy_data` (HTTPS certificates). `docker compose down -v` **deletes them**, so don't use `-v` unless you mean to wipe everything.

## Local development (without Docker)

```bash
cp .env.example .env      # set DATABASE_URL to a local Postgres
npm install
npx prisma migrate dev
npm run seed
npm run start:dev         # http://localhost:4000, API docs at /api/docs
```
