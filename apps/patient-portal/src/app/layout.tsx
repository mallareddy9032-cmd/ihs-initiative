import type { Metadata } from 'next';
import { Instrument_Serif, Inter, Playfair_Display } from 'next/font/google';
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

const instrument = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'IHS Patient Portal · Encrypted Vault',
  description: 'Patient self-service and encrypted Family Health Vault for the Ananthapuramu pilot.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${instrument.variable}`}
    >
      <body className={`${inter.className} min-h-screen antialiased`}>{children}</body>
    </html>
  );
}
