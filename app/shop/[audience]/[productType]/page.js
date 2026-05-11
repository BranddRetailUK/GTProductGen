import ProductGrid from "../../../../components/ProductGrid.jsx";
import { getShopListingFromSegments } from "../../../../lib/catalog.js";
import { titleFromShopSegment } from "../../../../lib/tags.js";

export const dynamic = "force-dynamic";

export default async function ShopAudienceProductTypePage({ params }) {
  const listing = await getShopListingFromSegments(params.audience, params.productType);
  const audience = listing.audience || titleFromShopSegment(params.audience) || "Shop";
  const productType = listing.productType || titleFromShopSegment(params.productType) || "Products";

  return (
    <div className="pg-page-shell">
      <div className="pg-page-head">
        <p className="pg-kicker">SHOP</p>
        <h1>
          {audience} / {productType}
        </h1>
        <p>Exact tag-token filtering driven by the generated product catalog.</p>
      </div>
      <ProductGrid
        products={listing.products}
        title={`${audience} ${productType}`}
        emptyCopy={`No products match ${audience} and ${productType} yet.`}
      />
    </div>
  );
}
