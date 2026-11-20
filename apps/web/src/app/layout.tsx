import { RouteFocusReset } from "@app/ui";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getThemePreference } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Inclusight", template: "%s · Inclusight" },
  description:
    "Accessibility compliance workspace for SEBI-regulated firms. Assists audits and compliance; does not certify compliance.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e17" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = await getThemePreference();
  return (
    <html
      lang="en"
      data-theme={theme === "system" ? undefined : theme}
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen antialiased">
        <RouteFocusReset />
        {children}
      </body>
    </html>
  );
}
