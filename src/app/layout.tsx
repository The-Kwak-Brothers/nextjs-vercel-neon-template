import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { resolveSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = resolveSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Next Neon CI Template",
    template: "%s | Next Neon CI Template",
  },
  description:
    "Dual-mode Next.js CI template: DEPLOY_TARGET=cloud (Neon+Vercel) or selfhosted (Postgres+Docker).",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Next Neon CI Template",
    description:
      "Cloud or selfhosted preview pipelines with Drizzle, Nix, and portable CI scripts.",
    type: "website",
    url: siteUrl,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Next Neon CI Template",
      url: siteUrl,
    },
    {
      "@type": "WebSite",
      name: "Next Neon CI Template",
      url: siteUrl,
      description:
        "Dual-mode Next.js CI template for cloud Neon+Vercel or selfhosted Postgres+Docker.",
    },
  ],
};
const serializedJsonLd = JSON.stringify(jsonLd).replaceAll("<", "\\u003c");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializedJsonLd }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
