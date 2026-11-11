import "@cloudscape-design/global-styles/index.css";
import "./globals.css";

import type { Metadata } from "next";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "Route 53 | Global", template: "%s | Route 53 | Global" },
  description:
    "Educational Route 53 console clone. Not affiliated with, endorsed by, or connected to Amazon Web Services.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
