import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HealthWeave - AI-Powered Health Data Synthesis",
  description: "Synthesizing your health story with AI-powered clinical insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
