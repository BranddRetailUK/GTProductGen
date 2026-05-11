import "./globals.css";

export const metadata = {
  title: {
    default: "Product Gen",
    template: "Product Gen | %s"
  },
  description:
    "Private product generation service with template admin, Dropbox ingest, and batch rendering."
};

function buildThemeInitScript() {
  return `!function(){var root=document.documentElement;root.dataset.theme="dark";root.style.colorScheme="dark";}();`;
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
