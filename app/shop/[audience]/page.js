import ProductGrid from "../../../components/ProductGrid.jsx";
import { SHOP_PRODUCT_TYPES } from "../../../lib/constants.js";
import { buildShopHref, titleFromShopSegment } from "../../../lib/tags.js";
import { getShopListingFromSegments } from "../../../lib/catalog.js";
import AnimatedRouteLink from "../../../components/layout/AnimatedRouteLink.jsx";

export const dynamic = "force-dynamic";

export default async function ShopAudiencePage({ params }) {
  const audience = titleFromShopSegment(params.audience) || "Mens";
  const listing = await getShopListingFromSegments(params.audience, null);

  return (
    <div className="pg-page-shell">
      <div className="pg-page-head">
        <p className="pg-kicker">SHOP</p>
        <h1>{audience}</h1>
        <p>Browse by audience first, then drill further into product type.</p>
      </div>

      <div className="pg-subnav-grid">
        {SHOP_PRODUCT_TYPES.map((productType) => (
          <AnimatedRouteLink key={productType} href={buildShopHref(audience, productType)} className="pg-subnav-card">
            <span>{productType}</span>
            <small>{audience}</small>
          </AnimatedRouteLink>
        ))}
      </div>

      <ProductGrid
        products={listing.products}
        title={`${audience} products`}
        emptyCopy={`No ${audience.toLowerCase()} products are available yet.`}
      />
    </div>
  );
}
