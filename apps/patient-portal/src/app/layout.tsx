import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

/** Inter is reliable offline/local; Plus Jakarta Sans remains in CSS font stack as preferred UI face when available. */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'IHS Patient Portal · Encrypted Vault',
  description: 'Patient self-service and encrypted Family Health Vault for the Ananthapuramu pilot.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className={`${inter.className} min-h-screen antialiased`}>{children}</body>
    </html>
  );
}
