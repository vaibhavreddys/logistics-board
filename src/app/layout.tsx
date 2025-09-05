import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: process.env.NEXT_PUBLIC_APP_NAME || 'LogiBoard' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}