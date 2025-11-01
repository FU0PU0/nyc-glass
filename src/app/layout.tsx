import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glass Microorganism",
  description: "NYC Glass Buildings Visualization",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
