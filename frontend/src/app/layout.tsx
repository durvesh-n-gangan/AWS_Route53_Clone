import "@cloudscape-design/global-styles/index.css";
import "./globals.css";

import type { Metadata } from "next";

import { THEME_INIT_SCRIPT } from "@/lib/theme";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "Route 53 | Global", template: "%s | Route 53 | Global" },
  description:
    "Educational Route 53 console clone. Not affiliated with, endorsed by, or connected to Amazon Web Services.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      {/* The theme script may add the dark-mode class to <body> before hydration. */}
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
