# Catalog RFQ API

NestJS and PostgreSQL backend for a single-company product catalog and quote-request workflow.

## Capabilities

- Admin authentication, refresh sessions, invitations, password recovery, roles, permissions, and audit log.
- Arabic/English catalog with categories, brands, attributes, filters, media, products, variants, SEO, related products, and Excel import/export.
- Anonymous quote carts with decimal quantities, product rules, optional variants, notes, and expiration.
- Atomic request submission with contact upsert, snapshots, status history, public tracking token, and `Idempotency-Key`.
- Admin request assignment, notes, transitions, exports, notifications, durable outbox retries, and operational analytics.
- Request IDs, validation, Helmet, CORS allowlist, throttling, health checks, Swagger, and optional Sentry.

## Start

```bash
npm install
npm run migrate:fresh
npm run admin:create -- owner@example.com "Owner Name" "a-strong-password"
npm run dev
```

Swagger is available at `/docs`; API routes use the `/api` prefix.

## Main commands

```bash
npm run build
npm run lint
npm test
npm run migrate:up
npm run migrate:down
npm run migrate:fresh
npm run worker:outbox
```

`migrate:fresh` intentionally replaces the target `public` schema and must only be used against a new or disposable database.

## Backup and restore

With PostgreSQL client tools installed:

```bash
DATABASE_URL=postgresql://... ./scripts/backup.sh
DATABASE_URL=postgresql://... ./scripts/restore.sh ./backups/catalog_rfq_YYYYMMDD_HHMMSS.dump --yes
```
