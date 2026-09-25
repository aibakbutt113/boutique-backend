# boutique-backend

NestJS + Prisma + PostgreSQL API for My Friendly Boutique. Serves the storefront (`boutique-frontend`) and the admin panel (`boutique-admin`).

## Run it

```bash
cp .env.example .env           # set DATABASE_URL, JWT secrets, ADMIN_EMAIL/ADMIN_PASSWORD
npm install
npx prisma migrate dev         # creates the database and applies migrations
npm run seed                   # admin user, categories, products, coupons
npm run start:dev              # http://localhost:4000, Swagger at /api/docs
```

CORS allows `FRONTEND_URL` (storefront, default `http://localhost:3000`) and `ADMIN_URL` (admin panel, default `http://localhost:3001`).

Uploaded images are stored in `uploads/` on local disk; use object storage in production.
