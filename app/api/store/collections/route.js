import { getStoreCollections } from "../../../../lib/catalog.js";

export async function GET() {
  return Response.json({
    collections: await getStoreCollections()
  });
}
