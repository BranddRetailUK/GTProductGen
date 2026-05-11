import CollectionCard from "./CollectionCard.jsx";

export default function CollectionGrid({ collections, title, eyebrow }) {
  return (
    <section className="pg-section">
      <div className="pg-section-head">
        {eyebrow ? <p className="pg-kicker">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      <div className="pg-collection-grid">
        {(Array.isArray(collections) ? collections : []).map((collection, index) => (
          <CollectionCard key={collection.id || collection.slug} collection={collection} index={index} />
        ))}
      </div>
    </section>
  );
}
