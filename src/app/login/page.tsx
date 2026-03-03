'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Mail, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Suspense } from 'react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const verify = searchParams.get('verify');
  const authError = searchParams.get('error');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('email', {
        email: email.toLowerCase().trim(),
        redirect: false,
      });

      if (result?.error) {
        setError('Access denied. Your email is not on the approved list.');
        setLoading(false);
      } else {
        // Redirect to verify page
        window.location.href = '/login?verify=true';
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // Check your email state
  if (verify) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/10">
            <Mail className="h-8 w-8 text-teal-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Check your email</h1>
            <p className="mt-3 text-slate-400">
              We sent a magic link to your inbox. Click it to sign in — no password needed.
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <div className="flex items-start gap-3 text-left">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-500" />
              <div className="text-sm text-slate-300">
                <p>The link expires in 24 hours.</p>
                <p className="mt-1 text-slate-500">Don&apos;t see it? Check your spam folder.</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/login'}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Try a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-teal-500/10">
            <ShieldCheck className="h-8 w-8 text-teal-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">ContentReview</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in with your email to continue</p>
        </div>

        {/* Error messages */}
        {(error || authError) && (
          <div className="flex items-start gap-3 rounded-lg border border-red-800/50 bg-red-900/20 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
            <p className="text-sm text-red-300">
              {error || (authError === 'AccessDenied'
                ? 'Access denied. Your email is not on the approved list.'
                : 'Something went wrong. Please try again.')}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@jmsn.com"
              required
              autoFocus
              className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-3 font-medium text-white transition-colors hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Sending link...
              </>
            ) : (
              <>
                Continue with Email
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600">
          Only approved team members can access this dashboard.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
