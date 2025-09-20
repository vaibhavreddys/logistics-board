// app/layout.tsx (Server Component)
import './globals.css';
import DynamicTitle from './DynamicTitle'; // Separate Client Component

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DynamicTitle />
        {children}
      </body>
    </html>
  );
}