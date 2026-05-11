import HomePage from "../components/home/HomePage.jsx";
import { getHomePayload } from "../lib/catalog.js";

export const dynamic = "force-dynamic";

export default async function Page() {
  const payload = await getHomePayload();
  return <HomePage collections={payload.collections} products={payload.products} />;
}
