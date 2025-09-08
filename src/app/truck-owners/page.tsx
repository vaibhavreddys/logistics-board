import { Suspense } from 'react';
import TruckOwnersPageContent from './TruckOwnersPageContent';

export default function TruckOwnersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TruckOwnersPageContent />
    </Suspense>
  );
}