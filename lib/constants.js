export const SHOP_AUDIENCES = ["Mens", "Womens", "Kids"];
export const SHOP_PRODUCT_TYPES = ["T-Shirts", "Hoodies", "Sweats", "Accessories"];

export const RUN_MODE_SINGLE = "single";
export const RUN_MODE_BULK = "bulk";

export const RUN_STATUS_QUEUED = "queued";
export const RUN_STATUS_RUNNING = "running";
export const RUN_STATUS_COMPLETED = "completed";
export const RUN_STATUS_FAILED = "failed";

export const ITEM_STATUS_QUEUED = "queued";
export const ITEM_STATUS_RUNNING = "running";
export const ITEM_STATUS_COMPLETED = "completed";
export const ITEM_STATUS_FAILED = "failed";
export const ITEM_STATUS_SKIPPED = "skipped";

export const ROUTE_TRANSITION_MS = 260;
export const ROUTE_TRANSITION_EXIT_CLASS = "route-transition-out";

export const CART_STORAGE_KEY = "product-gen-cart-v1";
export const CART_UPDATED_EVENT = "product-gen:cart-updated";
export const CART_DRAWER_OPEN_EVENT = "product-gen:cart-open";

export const DEFAULT_RENDER_OUTPUT = {
  width: 1400,
  height: 1400
};

export const DEFAULT_PRINT_AREAS = {
  "T-Shirts": {
    id: "front",
    viewId: "front",
    label: "Front",
    x: 0.26,
    y: 0.16,
    width: 0.48,
    height: 0.56
  },
  Hoodies: {
    id: "front",
    viewId: "front",
    label: "Front",
    x: 0.26,
    y: 0.18,
    width: 0.48,
    height: 0.5
  },
  Sweats: {
    id: "front",
    viewId: "front",
    label: "Front",
    x: 0.24,
    y: 0.18,
    width: 0.52,
    height: 0.48
  },
  Accessories: {
    id: "front",
    viewId: "front",
    label: "Front",
    x: 0.22,
    y: 0.22,
    width: 0.56,
    height: 0.56
  }
};

export const DEFAULT_COLOURS = ["Black", "Arctic White", "Navy", "Sand"];
export const DEFAULT_SIZES = ["S", "M", "L", "XL"];
export const ACCESSORY_SIZES = ["One Size"];
