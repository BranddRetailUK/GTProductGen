CREATE TABLE IF NOT EXISTS product_gen_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_products (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  handle TEXT NOT NULL,
  body_html TEXT,
  vendor TEXT,
  product_type TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  sizes TEXT[] NOT NULL DEFAULT '{}',
  colours TEXT[] NOT NULL DEFAULT '{}',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  print_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  view_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  size_option_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_variants (
  id BIGINT PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES template_products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sku TEXT,
  price NUMERIC(10, 2),
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_images (
  id BIGSERIAL PRIMARY KEY,
  template_product_id BIGINT NOT NULL REFERENCES template_products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_view_assets (
  id BIGSERIAL PRIMARY KEY,
  template_product_id BIGINT NOT NULL REFERENCES template_products(id) ON DELETE CASCADE,
  view_id TEXT NOT NULL,
  colour_name TEXT,
  asset_type TEXT NOT NULL DEFAULT 'base',
  asset_url TEXT NOT NULL,
  output_width INTEGER,
  output_height INTEGER,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS design_assets (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  display_name TEXT NOT NULL,
  extension TEXT,
  content_hash TEXT NOT NULL,
  path_display TEXT,
  size_bytes BIGINT,
  artwork_mode TEXT NOT NULL DEFAULT 'remote',
  artwork_text TEXT,
  source_url TEXT,
  source TEXT NOT NULL DEFAULT 'dropbox',
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generation_runs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  force_rerun BOOLEAN NOT NULL DEFAULT FALSE,
  template_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  design_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  queued_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generation_run_items (
  id BIGSERIAL PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES generation_runs(id) ON DELETE CASCADE,
  template_id BIGINT NOT NULL,
  design_id TEXT NOT NULL,
  status TEXT NOT NULL,
  product_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  template_product_id BIGINT,
  design_asset_id TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  price_gbp NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  hero_image_url TEXT,
  variant_matrix JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_images (
  id BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  colour_name TEXT,
  view_id TEXT NOT NULL DEFAULT 'front',
  image_url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  colour_name TEXT,
  size_name TEXT,
  sku TEXT,
  price_gbp NUMERIC(10, 2) NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_artwork_state (
  product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  design_asset_id TEXT NOT NULL,
  artwork_box JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_file_url TEXT,
  artwork_file_id TEXT,
  artwork_file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_collections (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  audience_tag TEXT,
  product_type_tag TEXT,
  card_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  homepage_visible BOOLEAN NOT NULL DEFAULT TRUE,
  nav_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id TEXT PRIMARY KEY,
  stripe_session_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'gbp',
  email TEXT,
  cart_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  stripe_session_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  email TEXT,
  currency TEXT NOT NULL DEFAULT 'gbp',
  amount_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  variant_id TEXT,
  title TEXT NOT NULL,
  colour_name TEXT,
  size_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_gbp NUMERIC(10, 2) NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_logs (
  id BIGSERIAL PRIMARY KEY,
  service TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_event_receipts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_runs_created_at ON generation_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_design_assets_updated_at ON design_assets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_collections_sort_order ON shop_collections(sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_service_logs_service_created_at ON service_logs(service, created_at DESC);
