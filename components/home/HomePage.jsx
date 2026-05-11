import CollectionGrid from "../CollectionGrid.jsx";
import ProductGrid from "../ProductGrid.jsx";
import AnimatedRouteLink from "../layout/AnimatedRouteLink.jsx";
import { stagger } from "./home-utils.js";

export default function HomePage({ collections, products }) {
  return (
    <div className="pg-home">
      <section className="pg-hero">
        <div className="pg-hero-copy route-reveal" style={stagger(0)}>
          <p className="pg-kicker">Single-Service Railway Build</p>
          <h1>Batch generate apparel products from a Dropbox design library.</h1>
          <p className="pg-lead">
            `product-gen` combines design ingest, template placement, rendering, admin control,
            and storefront publishing under one deployable service.
          </p>
          <div className="pg-hero-actions">
            <AnimatedRouteLink href="/new-in" className="pg-primary-button">
              SHOP NEW IN
            </AnimatedRouteLink>
            <AnimatedRouteLink href="/admin/runs" className="pg-outline-button">
              OPEN RUN CONSOLE
            </AnimatedRouteLink>
          </div>
        </div>
        <div className="pg-hero-panel route-reveal" style={stagger(1)}>
          <div className="pg-hero-stat">
            <span>Modes</span>
            <strong>Single and Bulk</strong>
          </div>
          <div className="pg-hero-stat">
            <span>Placement</span>
            <strong>Fit to box, top anchored</strong>
          </div>
          <div className="pg-hero-stat">
            <span>Execution</span>
            <strong>Template-first queue order</strong>
          </div>
        </div>
      </section>

      <CollectionGrid collections={collections} title="Shop Collections" eyebrow="Homepage Grid" />
      <ProductGrid
        products={products}
        title="Latest Products"
        eyebrow="Newest Created First"
        emptyCopy="Newly generated products will appear here."
      />
    </div>
  );
}
