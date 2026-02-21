import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "PM Persona Studio",
  description: "Track-specific PM persona assessment for B2B SaaS and B2C consumer product managers."
};

export const viewport: Viewport = {
  themeColor: "#f8f3e8"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-textPrimary focus:shadow-card"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
