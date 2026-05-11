import AnimatedRouteLink from "./layout/AnimatedRouteLink.jsx";

export default function CollectionCard({ collection, index = 0 }) {
  const href = collection.slug === "new-in" ? "/new-in" : collection.audienceTag ? `/shop/${collection.slug}` : `/shop/all/${collection.slug}`;

  return (
    <AnimatedRouteLink href={href} className="pg-collection-card">
      <div className="pg-collection-image-wrap">
        <img src={collection.cardImageUrl || "/mock/placeholder-tee.svg"} alt={collection.label} className="pg-collection-image" />
      </div>
      <div className="pg-collection-copy">
        <span className="pg-card-index">{String(index + 1).padStart(2, "0")}</span>
        <h3>{collection.label}</h3>
        <p>{collection.description}</p>
      </div>
    </AnimatedRouteLink>
  );
}
