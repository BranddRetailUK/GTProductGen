# Product Gen

Private product generation service for Railway.

This repo is no longer a customer-facing storefront. Shopify owns the storefront and checkout. Product Gen is the internal admin service that scans artwork from Dropbox, renders product images, stores run history, uploads generated images to Cloudinary, and creates draft products through the Shopify Admin API.

## Current State

As of 2026-05-11:

- `/` redirects to `/admin`.
- `/admin` is the only UI surface.
- Admin login uses `PRODUCT_GEN_ADMIN_EMAIL`, `PRODUCT_GEN_ADMIN_PASSWORD`, and `PRODUCT_GEN_SESSION_SECRET`.
- The admin dashboard uses a clean white background, black accents, and sans-serif system fonts.
- Dropbox scanning is working against the app folder. Current intended artwork location is `/INPUT` inside the Dropbox app folder, with `DROPBOX_ROOT_PATH=/`.
- Cloudinary image output is configured for the `ImageGen` media-library folder through `CLOUDINARY_UPLOAD_FOLDER=ImageGen`.
- Base product images are read from the separate Cloudinary environment through `CLOUDINARY_BASE_*`, with `CLOUDINARY_BASE_FOLDER=template_product_images`.
- Postgres is used through `DATABASE_URL`.
- Shopify variables are documented in `.env.example`, can be checked with `npm run check:env`, and are used by the draft-product publisher.
- Stripe is not currently used by this service.

## Admin UI

Routes:

- `/admin` - dashboard
- `/admin/designs` - Dropbox design library and manual rescan
- `/admin/templates` - product templates, print areas, and view assets
- `/admin/runs` - single or bulk generation queue and job history
- `/admin/products` - generated product records

The admin app has no public product pages, cart, checkout, or customer navigation.

## Runtime Architecture

One custom Node server starts:

- Next.js app routes
- the product generation runtime
- Dropbox polling
- pg-boss workers when enabled

Current state is persisted in Postgres in `product_gen_state` under the `service_state` key. The migration also creates normalized product/template/run tables for future use, but the current app state path is the JSON state store.

Queue behavior:

- `PG_BOSS_ENABLED` defaults to enabled when `DATABASE_URL` exists.
- If pg-boss is unavailable or disabled, generation and Dropbox scan work falls back to in-process async execution.

## Image Generation

The generation pipeline currently:

1. Scans Dropbox recursively from `DROPBOX_ROOT_PATH`.
2. Indexes supported artwork files.
3. Loads a selected template and design.
4. Uses Sharp to place artwork inside the first matching print area.
5. Renders front-view product images for each template colour.
6. Uploads rendered PNGs to Cloudinary.
7. Stores generated product, image, variant, and run state.

Generated product identity is based on artwork filename/title plus the selected template. If the same artwork title and
template are generated again, Product Gen replaces that matching local product record and uploads fresh rendered images.
Different artwork filenames produce separate products.

Supported Dropbox extensions in the scanner:

- `.png`
- `.jpg`
- `.jpeg`
- `.svg`
- `.pdf`
- `.psd`

Rendering is most reliable with PNG, JPEG, and SVG artwork because those formats are directly handled by the current Sharp path.

## Product Templates

Template seed data is loaded from `db/seeds/template-products.snapshot.json`.

The snapshot contains Shopify-derived template product and variant metadata. Current templates include apparel products such as T-shirts and hoodies. Template editing in `/admin/templates` controls:

- title
- product type
- print areas JSON
- view assets JSON

Admin-created generation runs render the product imagery, save the Product Gen product record, then create the matching
draft Shopify product in the same run.

## Environment Variables

`.env` is used locally and is intentionally ignored by Git. Use `.env.example` as the safe template, keep local secrets in `.env`, and mirror production values into Railway Variables.

Check local readiness without printing secret values:

```bash
npm run check:env
```

Required for production:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Railway Postgres connection string. |
| `PRODUCT_GEN_ADMIN_EMAIL` | Admin login email. |
| `PRODUCT_GEN_ADMIN_PASSWORD` | Admin login password. |
| `PRODUCT_GEN_SESSION_SECRET` | Secret used to sign the admin session cookie. |
| `CLOUDINARY_URL` | Cloudinary credentials URL. |
| `CLOUDINARY_UPLOAD_FOLDER` | Cloudinary folder for rendered images. Use `ImageGen`. |
| `CLOUDINARY_BASE_CLOUD_NAME` | Source Cloudinary cloud name for blank/base product images. |
| `CLOUDINARY_BASE_API_KEY` | Source Cloudinary API key for blank/base product image discovery. |
| `CLOUDINARY_BASE_API_SECRET` | Source Cloudinary API secret for blank/base product image discovery. |
| `CLOUDINARY_BASE_FOLDER` | Source Cloudinary folder for blank/base product images. Use `template_product_images`. |

Dropbox:

| Variable | Purpose |
| --- | --- |
| `DROPBOX_ROOT_PATH` | Root path to scan. Use `/` for the app folder root when artwork is in `/INPUT`. |
| `DROPBOX_ACCESS_TOKEN` | Direct token for local or short-term testing. |
| `DROPBOX_REFRESH_TOKEN` | Preferred long-running auth token for Railway. |
| `DROPBOX_APP_KEY` | Required with `DROPBOX_REFRESH_TOKEN`. |
| `DROPBOX_APP_SECRET` | Required with `DROPBOX_REFRESH_TOKEN`. |

Dropbox app permissions required:

- `files.metadata.read` for recursive scans
- `files.content.read` for temporary file links used during rendering

### Dropbox Long-Running Auth

Dropbox access tokens are short-lived. For production, use a long-lived refresh token instead of updating
`DROPBOX_ACCESS_TOKEN` manually.

One-time setup:

1. Set `DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET` locally from the Dropbox app console.
2. Generate the offline authorization URL:

```bash
npm run dropbox:auth-url
```

3. Open the URL, approve the app, and copy the authorization code.
4. Exchange the code for a refresh token:

```bash
npm run dropbox:exchange-code -- <authorization-code>
```

5. Add `DROPBOX_REFRESH_TOKEN`, `DROPBOX_APP_KEY`, and `DROPBOX_APP_SECRET` to Railway Variables and local `.env`.
6. Remove `DROPBOX_ACCESS_TOKEN` after `DROPBOX_REFRESH_TOKEN` is configured.
7. Verify renewal works:

```bash
npm run dropbox:test-refresh
```

Runtime and queue options:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Set automatically by Railway. |
| `DATABASE_SSL` | SSL with `rejectUnauthorized: false` | Set to `false` only if the database explicitly requires SSL off. |
| `PG_BOSS_ENABLED` | `true` | Set to `false` to bypass pg-boss and run work in-process. |
| `PRODUCT_GEN_SCAN_INTERVAL_MS` | `900000` | Dropbox polling interval in milliseconds. |
| `PRODUCT_GEN_QUEUE_GENERATION` | `product-gen:generation-run` | pg-boss generation queue name. |
| `PRODUCT_GEN_QUEUE_DROPBOX_SCAN` | `product-gen:dropbox-scan` | pg-boss Dropbox scan queue name. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Used for logout redirect URL construction. Set to the Railway app URL in production. |

Shopify placeholders:

| Variable | Purpose |
| --- | --- |
| `SHOPIFY_STORE_DOMAIN` | Shopify shop domain, for example `example.myshopify.com`. `SHOP_DOMAIN` is also accepted locally. |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Admin API access token. `SHOPIFY_ACCESS_TOKEN` is also accepted locally. |
| `SHOPIFY_API_VERSION` | Target Shopify Admin API version. `SHOPIFY_ADMIN_API_VERSION` is also accepted locally. Use `2026-04` while it is the latest stable version. |
| `SHOPIFY_PRODUCT_STATUS` | Intended status for pushed products. Defaults to `draft` if omitted. |
| `SHOPIFY_DEFAULT_VENDOR` | Fallback vendor for Shopify products. |
| `SHOPIFY_DEFAULT_PRODUCT_TYPE` | Fallback product type. |
| `SHOPIFY_LOCATION_ID` | Fulfilment/inventory location ID used to seed stock on created variants. If omitted, Product Gen attempts to resolve one from Shopify locations. |
| `SHOPIFY_LOCATION_NAME` | Optional location-name preference when resolving a Shopify location. Defaults locally to `GG Apparel`. |
| `SHOPIFY_DEFAULT_INVENTORY_QUANTITY` | Initial inventory quantity assigned to every newly-created Shopify variant. Defaults to `99`. |

Shopify publishing creates draft products through the Admin GraphQL API and verifies variant media, SKUs, unit cost, and initial inventory after creation.

Check Shopify Admin API connectivity and granted product scope:

```bash
npm run check:shopify
```

Create one safe draft Shopify product, read it back, and enforce draft status:

```bash
npm run smoke:shopify-product
```

## Local Development

Install dependencies:

```bash
npm install
```

Create a local `.env` file with the variables above. Do not commit it.

Start the service:

```bash
npm run dev
```

Build check:

```bash
npm run build
```

Seed or initialize database-backed state:

```bash
npm run seed
```

Check environment configuration:

```bash
npm run check:env
```

Check Shopify connection and scopes:

```bash
npm run check:shopify
```

Run a live draft product creation smoke test:

```bash
npm run smoke:shopify-product
```

Run a live Product Gen publish smoke test using a generated product and a temporary suffixed Shopify handle:

```bash
npm run smoke:product-gen-publish
```

Admin runs create draft Shopify products automatically after image rendering succeeds. Product Gen creates each draft
from the synced Good Game template options and variants, uploads the generated colour images as Shopify product media,
and links each Shopify variant to the media for its colour. Variant SKUs, unit cost, shipping weight, and initial
inventory come from the synced template variant rows. The run item fails if any required colour image is missing or if
Shopify readback does not show the expected variant SKU, cost, media, and inventory data. `/admin/products` remains
available for reviewing records and retrying a Shopify draft create if a run item fails after image generation.

Dry-run template product metadata sync from the main Good Game database:

```bash
npm run sync:good-game-templates
```

Apply the sync after reviewing the dry-run output:

```bash
npm run sync:good-game-templates -- --apply
```

Applied template syncs replace Product Gen's local template catalog with the Good Game-aligned templates by default,
removing older duplicate seed templates. Pass `--keep-existing` only when explicitly preserving unmatched local
templates for debugging.

Regenerate generated product records whose variants or colour images no longer match synced template data:

```bash
npm run regen:misaligned-products -- --apply
```

Sync real base product images from the source Cloudinary environment into template `viewAssets`:

```bash
npm run sync:base-images -- --apply
```

## Railway Deployment

Railway should run the normal build and start commands from `package.json`:

```bash
npm run build
npm start
```

Before exposing the deployment:

1. Add Railway Postgres and confirm `DATABASE_URL` is present.
2. Add admin login variables.
3. Add `PRODUCT_GEN_SESSION_SECRET`.
4. Add Dropbox variables and confirm the app has the required scopes.
5. Add Cloudinary variables with `CLOUDINARY_UPLOAD_FOLDER=ImageGen`.
6. Add Shopify variables and confirm `npm run check:shopify` passes.
7. Set `NEXT_PUBLIC_SITE_URL` to the Railway production URL.

## Git Hygiene

Ignored local files include:

- `.env`
- `.env.*`
- `.next/`
- `node_modules/`
- build outputs
- logs
- OS metadata

Before pushing, check:

```bash
git status --short --ignored
npm run build
```

The expected clean state is tracked files clean, with only ignored `.env`, `.next/`, and `node_modules/` visible locally.

## Next Integration Work

Recommended next steps:

1. Add Shopify update logic for regenerated products that already have a Shopify draft.
2. Add archive/delete tooling for superseded test drafts.
3. Add deeper item-level diagnostics for failed Shopify publish attempts.
