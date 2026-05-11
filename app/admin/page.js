import Link from "next/link";

const ADMIN_ACTIONS = [
  {
    href: "/admin/designs",
    title: "Design library",
    description: "Scan Dropbox artwork and confirm indexed source files."
  },
  {
    href: "/admin/templates",
    title: "Templates",
    description: "Manage print areas and product view assets for tees and hoodies."
  },
  {
    href: "/admin/print-areas",
    title: "Print areas",
    description: "Set artwork placement visually on each template product image."
  },
  {
    href: "/admin/runs",
    title: "Generation runs",
    description: "Queue single or bulk image generation and review job history."
  },
  {
    href: "/admin/products",
    title: "Generated products",
    description: "Review product records before Shopify publishing is enabled."
  }
];

export default function AdminPage() {
  return (
    <div className="pg-admin-panel">
      <div className="pg-page-head">
        <p className="pg-kicker">Dashboard</p>
        <h2>Product generation control</h2>
        <p>Manage artwork ingest, template placement, image rendering, and product records from one admin workspace.</p>
      </div>

      <div className="pg-admin-overview-grid">
        {ADMIN_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href} className="pg-admin-overview-card">
            <span>{action.title}</span>
            <p>{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
