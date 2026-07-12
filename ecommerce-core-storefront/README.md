# Catalog RFQ Storefront

Responsive Arabic/English catalog application with product browsing, variants, decimal quantities, a quote cart, contact form, request confirmation, static pages, and analytics events.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

The repository scripts reuse the admin dependency runtime for local verification. A standalone deployment may replace the script commands with regular `vite` after running `npm install` in this directory.

Production hosting must route unknown storefront paths (such as `/products/example`) to `index.html`. Set the API `APP_URL` to the public storefront origin so canonical sitemap URLs are correct. The dynamic sitemap is exposed at `/api/seo/sitemap.xml` and `public/robots.txt` references it.
