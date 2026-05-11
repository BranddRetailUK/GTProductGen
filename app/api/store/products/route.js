import { getStoreProducts } from "../../../../lib/catalog.js";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const audience = searchParams.get("audience");
  const productType = searchParams.get("productType");

  return Response.json({
    products: await getStoreProducts({ audience, productType })
  });
}
