import ProductDetail from "../../../components/products/ProductDetail.jsx";
import { getStoreProductByHandle } from "../../../lib/catalog.js";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }) {
  const product = await getStoreProductByHandle(params.handle);

  if (!product) {
    return (
      <div className="pg-page-shell">
        <div className="pg-empty-state">
          <p>Product not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pg-page-shell">
      <ProductDetail product={product} />
    </div>
  );
}
