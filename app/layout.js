import "./globals.css";

import SiteHeader from "../components/layout/SiteHeader.jsx";
import SiteFooter from "../components/layout/SiteFooter.jsx";
import CartDrawer from "../components/layout/CartDrawer.jsx";
import RouteTransition from "../components/layout/RouteTransition.jsx";
import StorefrontRouteLoadingProvider from "../components/layout/StorefrontRouteLoadingProvider.jsx";

export const metadata = {
  title: {
    default: "Product Gen",
    template: "Product Gen | %s"
  },
  description:
    "Standalone product generation service with template admin, batch rendering, and a public storefront."
};

function buildThemeInitScript() {
  return `!function(){var root=document.documentElement;root.dataset.theme="dark";root.style.colorScheme="dark";}();`;
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
        <StorefrontRouteLoadingProvider>
          <SiteHeader />
          <CartDrawer />
          <main className="site-main">
            <RouteTransition>{children}</RouteTransition>
          </main>
          <SiteFooter />
        </StorefrontRouteLoadingProvider>
      </body>
    </html>
  );
}
