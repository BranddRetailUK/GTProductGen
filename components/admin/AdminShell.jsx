import Link from "next/link";

const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/print-areas", label: "Print areas" },
  { href: "/admin/designs", label: "Designs" },
  { href: "/admin/runs", label: "Runs" },
  { href: "/admin/products", label: "Products" }
];

export default function AdminShell({ session, children }) {
  return (
    <div className="pg-admin-shell">
      <aside className="pg-admin-sidebar">
        <div className="pg-admin-brand">
          <span className="pg-admin-mark">GT</span>
          <div>
            <p className="pg-kicker">Admin</p>
            <h1>Product Gen</h1>
          </div>
        </div>
        <p className="pg-muted-copy">{session?.sub}</p>
        <nav className="pg-admin-nav">
          {ADMIN_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="pg-admin-nav-link">
              {link.label}
            </Link>
          ))}
        </nav>
        <form action="/api/admin/auth/logout" method="post">
          <button type="submit" className="pg-outline-button">
            Sign out
          </button>
        </form>
      </aside>
      <div className="pg-admin-content">{children}</div>
    </div>
  );
}
