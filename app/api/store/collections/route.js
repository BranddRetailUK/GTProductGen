import { getStoreCollections } from "../../../../lib/catalog.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    collections: await getStoreCollections()
  });
}
