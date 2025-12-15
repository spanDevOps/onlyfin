import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
  weight: ["300", "400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Rivo - UAE Real Estate AI Advisor",
  description: "Unbiased AI guidance for UAE property decisions. No commission pressure, just facts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
