# Product Catalog and Quote Requests

This repository contains:

- `ecommerce-core-api`: NestJS/PostgreSQL API and outbox worker.
- `ecommerce-core-admin`: administration dashboard on port 5173.
- `ecommerce-core-storefront`: public Arabic/English catalog on port 5174.

The system collects requested products, options, quantities, and contact details. It does not perform an online sale or reserve product availability.

Start the API first, then run the two React applications. See each package README for commands.
