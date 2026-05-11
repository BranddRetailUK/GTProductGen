import AnimatedRouteLink from "./layout/AnimatedRouteLink.jsx";
import { formatGbp } from "../lib/format.js";

export default function ProductCard({ product }) {
  return (
    <AnimatedRouteLink href={`/products/${product.handle}`} className="pg-product-card">
      <div className="pg-product-media">
        <img
          src={product.heroImageUrl || product.images?.[0]?.imageUrl || "/mock/placeholder-tee.svg"}
          alt={product.title}
          className="pg-product-image pg-product-image-top-anchor"
        />
      </div>
      <div className="pg-product-meta">
        <div className="pg-product-title">{product.title}</div>
        <div className="pg-product-tags">{(product.tags || []).slice(0, 2).join(" / ")}</div>
        <div className="pg-product-price">{formatGbp(product.priceGbp)}</div>
      </div>
    </AnimatedRouteLink>
  );
}
