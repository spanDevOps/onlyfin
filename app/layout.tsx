import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "OnlyFin - AI Finance Assistant",
  description: "Your specialized AI finance assistant with knowledge base capabilities. Upload documents and get expert financial guidance.",
  icons: {
    icon: '/onlyf-icon.png',
    apple: '/onlyf-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.25, maximum-scale=2.0, user-scalable=yes" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
