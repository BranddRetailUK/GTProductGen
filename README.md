# Product Gen

Standalone single-service Railway build for:
- Dropbox design ingest
- template-driven batch product generation
- internal Sharp-based product image rendering
- private admin
- Shopify publishing backend

Runtime boundaries:
- all code lives under `product-gen/`
- no runtime imports outside this folder
- one custom Node server boots Next, queue workers, and Dropbox polling together
- customer-facing storefront and checkout are owned by Shopify, not this service

Before running:
1. Install dependencies inside `product-gen/`
2. Configure `.env`
3. Run `npm run dev`

Environment notes:
- Dropbox scanning currently uses `DROPBOX_ACCESS_TOKEN` and `DROPBOX_ROOT_PATH`.
- For longer-running Railway deployments, prefer `DROPBOX_REFRESH_TOKEN` with `DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET`; `DROPBOX_ACCESS_TOKEN` still works for local/direct-token testing.
- The Dropbox app must have `files.metadata.read` for folder scans. Product image rendering also needs temporary file links, so enable `files.content.read` before generating a fresh token.
- For a Dropbox app-folder app, set `DROPBOX_ROOT_PATH=/` when designs live at the app-folder root, or set it to a child folder such as `/Product Gen`.
- Railway should provide `DATABASE_URL`; keep `DATABASE_SSL` empty unless the database explicitly requires SSL off.
- Set production `PRODUCT_GEN_ADMIN_EMAIL`, `PRODUCT_GEN_ADMIN_PASSWORD`, and `PRODUCT_GEN_SESSION_SECRET` values before exposing the admin UI.
- Rendered product images upload to Cloudinary through `CLOUDINARY_URL`; set `CLOUDINARY_UPLOAD_FOLDER=ImageGen` to place outputs in the ImageGen media-library folder.
- Shopify publishing will use `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `SHOPIFY_API_VERSION`, `SHOPIFY_PRODUCT_STATUS`, `SHOPIFY_DEFAULT_VENDOR`, `SHOPIFY_DEFAULT_PRODUCT_TYPE`, and `SHOPIFY_LOCATION_ID`.

Shopify status:
- Template seed data contains Shopify product/variant IDs, but there is not yet an Admin API publisher in this service.
- Product push to Shopify will need a separate integration step once Admin API credentials are populated.
