import { getHomePayload } from "../../../../lib/catalog.js";

export async function GET() {
  return Response.json(await getHomePayload());
}
