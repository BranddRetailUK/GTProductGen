import ProductGrid from "../../components/ProductGrid.jsx";
import { getNewInProducts } from "../../lib/catalog.js";

export const dynamic = "force-dynamic";

export default async function NewInPage() {
  const products = await getNewInProducts();

  return (
    <div className="pg-page-shell">
      <div className="pg-page-head">
        <p className="pg-kicker">NEW IN</p>
        <h1>Newest products first</h1>
        <p>All published products sorted by creation date descending.</p>
      </div>
      <ProductGrid products={products} title="All New Products" />
    </div>
  );
}
