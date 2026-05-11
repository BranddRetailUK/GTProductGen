import { cookies } from "next/headers";

import { getAdminSession } from "../../../../../lib/auth.js";
import { getRun } from "../../../../../lib/catalog.js";
import { getServiceState } from "../../../../../lib/store.js";

function compactProduct(product) {
  if (!product) return null;

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    status: product.status,
    heroImageUrl: product.heroImageUrl,
    images: Array.isArray(product.images)
      ? product.images.map((image) => ({
          id: image.id,
          colourName: image.colourName,
          viewId: image.viewId,
          imageUrl: image.imageUrl,
          isPrimary: image.isPrimary,
          sortOrder: image.sortOrder
        }))
      : [],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

export async function GET(_request, { params }) {
  if (!getAdminSession(cookies())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const run = await getRun(params.id);
  if (!run) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const state = await getServiceState();
  const productsById = new Map((state.products || []).map((product) => [String(product.id), product]));
  const templatesById = new Map((state.templates || []).map((template) => [String(template.id), template]));
  const designsById = new Map((state.designs || []).map((design) => [String(design.id), design]));

  return Response.json({
    run: {
      ...run,
      items: (run.items || []).map((item) => {
        const template = templatesById.get(String(item.templateId));
        const design = designsById.get(String(item.designId));

        return {
          ...item,
          template: template
            ? {
                id: template.id,
                title: template.title,
                productType: template.productType
              }
            : null,
          design: design
            ? {
                id: design.id,
                displayName: design.displayName,
                filename: design.filename
              }
            : null,
          product: compactProduct(productsById.get(String(item.productId)))
        };
      })
    }
  });
}
