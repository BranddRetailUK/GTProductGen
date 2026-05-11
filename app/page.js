import HomePage from "../components/home/HomePage.jsx";
import { getHomePayload } from "../lib/catalog.js";

export const revalidate = 60;

export default async function Page() {
  const payload = await getHomePayload();
  return <HomePage collections={payload.collections} products={payload.products} />;
}
