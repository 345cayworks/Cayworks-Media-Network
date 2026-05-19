import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cayworks Ad Engine",
  description:
    "Centralized advertising backend and reusable ad network for Cayworks platforms.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
