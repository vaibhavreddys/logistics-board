import { Suspense } from 'react';
import RedirectHandler from './RedirectHandler';

export default function Auth() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <RedirectHandler />
    </Suspense>
  );
}