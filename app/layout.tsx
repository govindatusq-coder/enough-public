import type { Metadata } from "next";
import "./globals.css";
import "./experience.css";
import "./moves.css";

export const metadata: Metadata = {
  title: "ENOUGH — Movement that gives back",
  description: "Less sacrifice. More life. Explore ENOUGH, a quiet place for movement that fits your everyday.",
  icons: {
    icon: [
      { url: "/favicon.ico?v=3", type: "image/x-icon", sizes: "16x16 32x32 48x48 64x64" },
      { url: "/icon-32.png?v=3", type: "image/png", sizes: "32x32" },
      { url: "/favicon.svg?v=3", type: "image/svg+xml", sizes: "any" },
    ],
    shortcut: "/favicon.ico?v=3",
    apple: [{ url: "/apple-touch-icon.png?v=3", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
