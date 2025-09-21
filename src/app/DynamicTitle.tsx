// app/DynamicTitle.tsx (Client Component)
'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function DynamicTitle() {
  const pathname = usePathname();

  useEffect(() => {
    let title = 'Freight 24'; // Default title
    switch (pathname) {
      case '/indents':
        title = 'F 24 | Indents';
        break;
      case '/clients':
        title = 'F 24 | Clients';
        break;
      case '/load':
        title = 'F 24 | Load';
        break;
      case '/login':
        title = 'F 24 | Login';
        break;
      case '/profiles':
        title = 'F 24 | Profiles';
        break;
      case '/trips':
        title = 'F 24 | Trips';
        break;
      case '/trucks':
        title = 'F 24 | Trucks';
        break;
      case '/truck-owners':
        title = 'F 24 | Truck Owners';
        break;
      // Add more routes as needed
      default:
        title = 'Freight 24 - Digital Freight Aggregator Platform | Truck Booking'; // Fallback title
    }
    document.title = title;
  }, [pathname]);

  return null; // No UI, just side effect
}