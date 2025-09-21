// types/vercel-analytics.d.ts
interface Window {
  analytics?: {
    track: (eventName: string, properties?: Record<string, any>) => void;
  };
}