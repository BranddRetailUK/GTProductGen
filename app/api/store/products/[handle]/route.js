import { getStoreProductByHandle } from "../../../../../lib/catalog.js";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const product = await getStoreProductByHandle(params.handle);
  if (!product) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ product });
}
