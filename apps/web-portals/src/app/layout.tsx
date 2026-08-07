import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'IHS Command Center · Ananthapur Pilot',
  description: 'IHS Dispatch Command — Ananthapuramu & Sri Sathya Sai 50km GIS HUD',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className={`${inter.className} min-h-screen text-[#1C1C1E] antialiased`}>{children}</body>
    </html>
  );
}
