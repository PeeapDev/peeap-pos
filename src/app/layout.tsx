import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Peeap Store - POS & E-Commerce",
  description:
    "Discover local stores and shop online with Peeap Store. Every merchant gets their own Google-indexed online store.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_STORE_URL || "https://store.peeap.com"
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
