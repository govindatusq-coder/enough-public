import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ENOUGH — Movement that gives back",
  description: "Less sacrifice. More life. Explore ENOUGH, a quiet place for movement that fits your everyday.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
