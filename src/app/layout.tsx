import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { PageLoader } from "@/components/PageLoader";
import { DevExtremeStyles } from "@/components/DevExtremeStyles";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "",
  description: "Modern Point of Sale and Inventory Management system with multi-tenant support and role-based access control",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-gray-900`}
      >
        <DevExtremeStyles />
        <PageLoader />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
