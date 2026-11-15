'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, KeyRound, ShieldCheck, ShoppingBag } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Staff sign-in failed.');
      window.dispatchEvent(new Event('apex-auth-changed'));
      router.replace('/admin/orders');
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const change = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));

  return (
    <main className="mx-auto grid min-h-[calc(100vh-12rem)] max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8">
      <section className="hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-10 text-white lg:block">
        <a href="/" className="inline-flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500"><ShoppingBag className="h-5 w-5" /></span>
          <span className="text-lg font-black tracking-tight">APEX<span className="text-sky-400">STORE</span></span>
        </a>
        <div className="mt-24 max-w-md">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-sky-200"><ShieldCheck className="h-3.5 w-3.5" />Staff portal</div>
          <h1 className="text-4xl font-black leading-tight">Store operations,<br /><span className="text-sky-300">all in one place.</span></h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">Sign in with a verified staff account to review orders and manage refund requests.</p>
        </div>
        <p className="mt-24 text-xs text-slate-500">Access is limited to email addresses approved for staff access.</p>
      </section>

      <section className="mx-auto w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-10">
        <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><KeyRound className="h-5 w-5" /></div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">Admin sign in</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Use your verified, staff-approved ApexStore account.</p>

        {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Email address
            <input type="email" name="email" autoComplete="username" value={form.email} onChange={change} required className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100" placeholder="staff@example.com" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">Password
            <input type="password" name="password" autoComplete="current-password" value={form.password} onChange={change} required className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 font-normal outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100" placeholder="Enter your password" />
          </label>
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 py-3.5 text-sm font-black text-white transition hover:bg-sky-800 disabled:opacity-50">
            {busy ? 'Signing in…' : 'Sign in to admin'}{!busy && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-500">Your account must be email-verified and allowlisted for staff access. <a href="/account" className="font-bold text-sky-700 hover:underline">Open customer account</a></p>
      </section>
    </main>
  );
}
