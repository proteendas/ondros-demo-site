import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Orbitron } from "next/font/google";
import "./globals.css";
import { CMS_BROWSER_URL } from "@/lib/cms";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Acme Platform",
  description: "A sample marketing site powered by Ondros CMS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-black dark:bg-black dark:text-white">
        <Suspense fallback={null}>
          <SiteHeader />
        </Suspense>
        <main className="flex-1">{children}</main>
        <SiteFooter />
        {/* Ondros Code Sync bridge: makes this site editable from the CMS
            editor (outline components, select fields, edit text in place).
            It no-ops unless the page is open inside the editor, so it is safe
            to ship in production. */}
        <Script src={`${CMS_BROWSER_URL}/code-sync/ondros-editor.js`} />
      </body>
    </html>
  );
}
