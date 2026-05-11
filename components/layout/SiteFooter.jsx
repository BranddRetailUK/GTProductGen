import AnimatedRouteLink from "./AnimatedRouteLink.jsx";

export default function SiteFooter() {
  return (
    <footer className="pg-footer">
      <div className="pg-footer-copy">
        <strong>Product Gen</strong>
        <span>Standalone template-driven product generation and storefront delivery.</span>
      </div>
      <div className="pg-footer-links">
        <AnimatedRouteLink href="/">Home</AnimatedRouteLink>
        <AnimatedRouteLink href="/new-in">New In</AnimatedRouteLink>
        <AnimatedRouteLink href="/admin/templates">Admin</AnimatedRouteLink>
      </div>
    </footer>
  );
}
