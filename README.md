# Product Catalog and Quote Requests

This repository contains:

- `ecommerce-core-api`: NestJS/PostgreSQL API, outbox worker, and periodic cart-maintenance worker.
- `ecommerce-core-admin`: administration dashboard on port 5173.
- `ecommerce-core-storefront`: public Arabic/English catalog on port 5174.

The system collects requested products, options, quantities, and contact details. It does not perform an online sale or reserve product availability.

Start the API first, then run the two React applications. See each package README for commands.

## Docker Compose deployment

The repository includes a complete Compose stack with PostgreSQL, one-shot database migrations, the API, both background workers, the admin dashboard, and the public storefront.

For a local deployment:

```bash
docker compose up --build -d
docker compose ps
```

- Storefront: `http://localhost:8080`
- Admin: `http://localhost:8081`
- API health: `http://localhost:3000/api/health`
- Swagger: `http://localhost:3000/docs`

Before an internet-facing deployment, set at least `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET` (32 or more characters), `STOREFRONT_URL`, `ADMIN_APP_URL`, and `ALLOWED_ORIGINS` in a root `.env` file. Configure the SMTP, S3-compatible storage, and Sentry variables from `ecommerce-core-api/.env.production.example` as needed. Put a TLS reverse proxy or load balancer in front of ports 8080, 8081, and 3000; the two web containers proxy same-origin `/api` requests to the API container.

Useful lifecycle commands:

```bash
docker compose logs -f
docker compose down
docker compose down --volumes # also deletes the local PostgreSQL data
```
