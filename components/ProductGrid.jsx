import ProductCard from "./ProductCard.jsx";

export default function ProductGrid({ products, title, eyebrow, emptyCopy }) {
  return (
    <section className="pg-section">
      <div className="pg-section-head">
        {eyebrow ? <p className="pg-kicker">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {(Array.isArray(products) ? products : []).length ? (
        <div className="pg-product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="pg-empty-state">
          <p>{emptyCopy || "No products available."}</p>
        </div>
      )}
    </section>
  );
}
