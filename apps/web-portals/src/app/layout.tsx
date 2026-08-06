import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IHS Web Portals',
  description: 'IHS Command Center & Physician Console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-[#1C1C1E] antialiased">{children}</body>
    </html>
  );
}
