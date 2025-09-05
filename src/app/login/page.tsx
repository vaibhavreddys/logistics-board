'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage(){
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <Input placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} />
        <Button onClick={async()=>{
          const { error } = await supabase.auth.signInWithOtp({ email });
          if(!error) setSent(true);
        }}>Send Magic Link</Button>
        {sent && <p>Check your email for the magic link.</p>}
      </div>
    </div>
  );
}