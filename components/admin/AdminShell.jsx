import AnimatedRouteLink from "../layout/AnimatedRouteLink.jsx";

const ADMIN_LINKS = [
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/designs", label: "Design Library" },
  { href: "/admin/runs", label: "Run Console" },
  { href: "/admin/products", label: "Product Admin" },
  { href: "/admin/navigation", label: "Homepage Collections" }
];

export default function AdminShell({ session, children }) {
  return (
    <div className="pg-admin-shell">
      <aside className="pg-admin-sidebar">
        <p className="pg-kicker">Private Admin</p>
        <h1>product-gen</h1>
        <p className="pg-muted-copy">{session?.sub}</p>
        <nav className="pg-admin-nav">
          {ADMIN_LINKS.map((link) => (
            <AnimatedRouteLink key={link.href} href={link.href} className="pg-admin-nav-link">
              {link.label}
            </AnimatedRouteLink>
          ))}
        </nav>
        <form action="/api/admin/auth/logout" method="post">
          <button type="submit" className="pg-outline-button">
            SIGN OUT
          </button>
        </form>
      </aside>
      <div className="pg-admin-content">{children}</div>
    </div>
  );
}
