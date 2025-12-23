import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Cronos x402 Agentic Treasury",
  description: "Autonomous Agentic Treasury on Cronos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-900 text-white font-sans">{children}</body>
    </html>
  );
}

