'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Phone, ArrowRight } from 'lucide-react';

interface LoginForm {
  email: string;
  password: string;
}

interface RegisterForm {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'admin' | 'truck_owner';
}

interface ForgotPasswordForm {
  email: string;
}

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const loginForm = useForm<LoginForm>();
  const registerForm = useForm<RegisterForm>();
  const forgotForm = useForm<ForgotPasswordForm>();

  // Handle Login
  const handleLogin = async (data: LoginForm) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw error;
      if (authData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();
        router.push(profile?.role === 'admin' ? '/indents' : '/');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration
  const handleRegister = async (data: RegisterForm) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });
      if (authError) throw authError;
      if (authData.user) {
        await supabase.from('profiles').insert({
          id: authData.user.id,
          // email: data.email,
          role: data.role,
          full_name: data.name,
          phone: data.phone,
        });
        setSuccess('Registration successful! Please log in.');
        setMode('login');
        registerForm.reset();
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password
  const handleForgotPassword = async (data: ForgotPasswordForm) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSuccess('Password reset email sent! Check your inbox.');
      forgotForm.reset();
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">
            {mode === 'login' && 'Login'}
            {mode === 'register' && 'Register'}
            {mode === 'forgot' && 'Forgot Password'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs for switching modes */}
          <div className="flex justify-center gap-4 mb-4">
            <Button
              variant={mode === 'login' ? 'default' : 'outline'}
              onClick={() => setMode('login')}
            >
              Login
            </Button>
            <Button
              variant={mode === 'register' ? 'default' : 'outline'}
              onClick={() => setMode('register')}
            >
              Register
            </Button>
            <Button
              variant={mode === 'forgot' ? 'default' : 'outline'}
              onClick={() => setMode('forgot')}
            >
              Forgot Password
            </Button>
          </div>

          {/* Error/Success Messages */}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-500 text-sm">{success}</p>}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="your@email.com"
                    className="pl-10"
                    {...loginForm.register('email', { required: 'Email is required' })}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-red-500 text-sm">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="********"
                    className="pl-10"
                    {...loginForm.register('password', { required: 'Password is required' })}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-red-500 text-sm">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !loginForm.watch('email') || !loginForm.watch('password')}
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          )}

          {/* Register Form */}
          {mode === 'register' && (
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="your@email.com"
                    className="pl-10"
                    {...registerForm.register('email', { required: 'Email is required' })}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-red-500 text-sm">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="********"
                    className="pl-10"
                    {...registerForm.register('password', {
                      required: 'Password is required',
                      minLength: { value: 6, message: 'Password must be at least 6 characters' },
                    })}
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-red-500 text-sm">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    id="name"
                    placeholder="John Doe"
                    className="pl-10"
                    {...registerForm.register('name', { required: 'Name is required' })}
                  />
                  {registerForm.formState.errors.name && (
                    <p className="text-red-500 text-sm">{registerForm.formState.errors.name.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    id="phone"
                    placeholder="+91 1234567890"
                    className="pl-10"
                    {...registerForm.register('phone', { required: 'Phone is required' })}
                  />
                  {registerForm.formState.errors.phone && (
                    <p className="text-red-500 text-sm">{registerForm.formState.errors.phone.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  className="w-full border rounded p-2"
                  {...registerForm.register('role', { required: 'Role is required' })}
                >
                  <option value="">Select Role</option>
                  <option value="admin">Admin</option>
                  <option value="truck_owner">Truck Owner</option>
                </select>
                {registerForm.formState.errors.role && (
                  <p className="text-red-500 text-sm">{registerForm.formState.errors.role.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Registering...' : 'Register'}
              </Button>
            </form>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot' && (
            <form onSubmit={forgotForm.handleSubmit(handleForgotPassword)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="your@email.com"
                    className="pl-10"
                    {...forgotForm.register('email', { required: 'Email is required' })}
                  />
                  {forgotForm.formState.errors.email && (
                    <p className="text-red-500 text-sm">{forgotForm.formState.errors.email.message}</p>
                  )}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
          )}

          {/* Navigation Links */}
          {mode !== 'forgot' && (
            <p className="text-center text-sm text-gray-600">
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => setMode('register')}
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => setMode('login')}
                  >
                    Login
                  </button>
                </>
              )}
              {' | '}
              <button
                className="text-blue-600 hover:underline"
                onClick={() => setMode('forgot')}
              >
                Forgot Password?
              </button>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}