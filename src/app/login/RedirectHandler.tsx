'use client';
import { useSearchParams } from 'next/navigation';
import AuthPage from './AuthPage';

export default function RedirectHandler() {
  const redirectTo = useSearchParams().get('redirect') || '/indents';
  return <AuthPage redirectTo={redirectTo} />;
}