'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, LogOut, Package, ShieldCheck, UserRound, RotateCcw, ArrowRight, CircleUserRound, LockKeyhole, ShoppingBag, Sparkles, Truck, RefreshCw, CheckCircle2, Clock3, PackageCheck, ArrowUpRight, Search, CircleDollarSign } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function statusStyles(status) {
  if (['Delivered', 'Processed', 'Partially Refunded', 'Refunded'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (['Requested', 'Processing', 'Preparing', 'Shipped', 'Pending'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (['Rejected', 'Failed', 'Cancelled'].includes(status)) return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function StatusPill({ status }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles(status)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}

function canRequestReturn(order) {
  if (!['Delivered', 'Partially Refunded'].includes(order.status) || !order.delivered_at) return false;
  const raw = String(order.delivered_at);
  const normalized = /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : raw;
  const deliveredAt = new Date(normalized).getTime();
  const age = Date.now() - deliveredAt;
  return Number.isFinite(deliveredAt) && age >= 0 && age <= 30 * 24 * 60 * 60 * 1000;
}

function RefundRequestForm({ order, onCancel, onSubmitted }) {
  const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const items = Object.entries(quantities).filter(([, quantity]) => Number(quantity) > 0).map(([product_id, quantity]) => ({ product_id: Number(product_id), quantity: Number(quantity) }));
    try {
      const response = await fetch(`${API}/api/account/orders/${encodeURIComponent(order.id)}/refunds`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, items })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not submit your refund request.');
      onSubmitted(`Refund request #${data.refund.id} submitted for ${formatCurrency(data.refund.amount, order.currency || 'INR')}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
    <div><h4 className="text-sm font-black text-slate-900">Request a product refund</h4><p className="mt-1 text-xs text-slate-600">Choose quantities and tell us why. Staff will review the request. Shipping is not refundable.</p></div>
    <div className="space-y-2">{order.items.map((item, index) => <label key={`${item.id}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-sm"><span className="min-w-0 truncate text-slate-700">{item.title}</span><select aria-label={`Quantity to refund for ${item.title}`} value={quantities[item.id] || 0} onChange={event => setQuantities(previous => ({ ...previous, [item.id]: Number(event.target.value) }))} className="rounded-md border border-slate-300 px-2 py-1"><option value={0}>None</option>{Array.from({ length: Number(item.quantity) }, (_, i) => i + 1).map(quantity => <option key={quantity} value={quantity}>{quantity}</option>)}</select></label>)}</div>
    <label className="block text-xs font-bold text-slate-700">Reason<textarea value={reason} onChange={event => setReason(event.target.value)} minLength={10} maxLength={1000} required rows={3} placeholder="Describe why you are requesting a return or refund…" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm font-normal" /></label>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Submit request'}</button><button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">Cancel</button></div>
  </form>;
}

export default function AccountPage() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', code: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refundOrderId, setRefundOrderId] = useState('');
  const [orderFilter, setOrderFilter] = useState('All orders');
  const [refreshing, setRefreshing] = useState(false);

  const loadAccount = async () => {
    const response = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
    const data = await response.json();
    if (!data.user) return;
    setUser(data.user);
    setForm(previous => ({ ...previous, name: data.user.name, email: data.user.email }));
    const orderResponse = await fetch(`${API}/api/account/orders`, { credentials: 'include' });
    const orderData = await orderResponse.json();
    if (orderData.success) setOrders(orderData.orders || []);
  };

  useEffect(() => {
    loadAccount().catch(() => {});
  }, []);

  const change = (event) => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const routes = {
      login: '/api/auth/login',
      register: '/api/auth/register',
      verify: '/api/auth/verify-email',
      'reset-request': '/api/auth/request-password-reset',
      'reset-confirm': '/api/auth/reset-password'
    };
    const payload = mode === 'login'
      ? { email: form.email, password: form.password }
      : mode === 'register'
        ? { name: form.name, email: form.email, password: form.password }
        : mode === 'verify'
          ? { email: form.email, code: form.code }
          : mode === 'reset-request'
            ? { email: form.email }
            : { email: form.email, code: form.code, password: form.password };
    try {
      const response = await fetch(`${API}${routes[mode]}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'We could not complete that request.');
      if (mode === 'register') {
        setMode('verify');
        setMessage(data.message);
      } else if (mode === 'verify' || mode === 'login') {
        setUser(data.user);
        window.dispatchEvent(new Event('apex-auth-changed'));
        setMessage(mode === 'verify' ? 'Your email is verified. Your account is ready.' : 'You are signed in.');
        await loadAccount();
      } else if (mode === 'reset-request') {
        setMode('reset-confirm');
        setMessage(data.message);
      } else {
        setMode('login');
        setForm(previous => ({ ...previous, password: '', code: '' }));
        setMessage(data.message);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
    setOrders([]);
    window.dispatchEvent(new Event('apex-auth-changed'));
    setMessage('You are signed out.');
    setMode('login');
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setError('');
    const response = await fetch(`${API}/api/account/profile`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name })
    });
    const data = await response.json();
    if (data.success) {
      setUser(data.user);
      setMessage('Your profile has been updated.');
    } else setError(data.error || 'Could not save your profile.');
  };

  const title = {
    login: 'Welcome back', register: 'Create your account', verify: 'Verify your email',
    'reset-request': 'Reset your password', 'reset-confirm': 'Choose a new password'
  }[mode];
  const AuthIcon = mode === 'login' ? CircleUserRound : KeyRound;
  const allRefunds = orders.flatMap(order => (order.refunds || []).map(refund => ({ ...refund, orderId: order.id, currency: order.currency || 'INR' })));
  const activeOrders = orders.filter(order => !['Delivered', 'Refunded', 'Rejected', 'Cancelled'].includes(order.status));
  const successfulRefunds = allRefunds.filter(refund => ['Processed', 'Refunded', 'Succeeded', 'Success'].includes(refund.status)).length;
  const visibleOrders = orderFilter === 'Active'
    ? activeOrders
    : orderFilter === 'Delivered'
      ? orders.filter(order => order.status === 'Delivered')
      : orderFilter === 'Returns & refunds'
        ? orders.filter(order => order.refunds?.length)
        : orders;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {user ? (
        <div className="space-y-7">
          <header className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-white to-sky-50 shadow-sm">
            <div className="flex flex-col justify-between gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
              <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-sky-700"><UserRound className="h-4 w-4" /> Customer dashboard</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Welcome back, {user.name}</h1><p className="mt-2 text-sm text-slate-600">Your orders, delivery progress, and refund updates in one place.</p></div>
              <div className="flex flex-wrap gap-2">{user.is_admin && <a href="/admin/orders" className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-800">Manage store <ArrowUpRight className="h-4 w-4" /></a>}<button onClick={async () => { setRefreshing(true); try { await loadAccount(); } finally { setRefreshing(false); } }} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-sky-400 hover:text-sky-800" aria-label="Refresh account activity"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</button><button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><LogOut className="h-4 w-4" />Sign out</button></div>
            </div>
            <div className="border-t border-slate-200/80 px-6 py-3 text-sm text-slate-600 sm:px-8"><span className="font-semibold text-slate-900">{user.email}</span><span className="mx-2 text-slate-300">·</span><span>Account activity refreshes when you return to this page.</span></div>
          </header>

          {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}

          <section aria-label="Account activity summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Total orders', value: orders.length, icon: Package, note: 'All purchases on this account', tone: 'text-sky-700 bg-sky-50' },
              { label: 'In progress', value: activeOrders.length, icon: Clock3, note: 'Being prepared or delivered', tone: 'text-amber-700 bg-amber-50' },
              { label: 'Delivered', value: orders.filter(order => order.status === 'Delivered').length, icon: PackageCheck, note: 'Successfully delivered orders', tone: 'text-emerald-700 bg-emerald-50' },
              { label: 'Refunds completed', value: successfulRefunds, icon: CircleDollarSign, note: `${allRefunds.filter(refund => !['Processed', 'Refunded', 'Succeeded', 'Success', 'Rejected', 'Failed'].includes(refund.status)).length} awaiting an update`, tone: 'text-indigo-700 bg-indigo-50' },
            ].map(metric => { const Icon = metric.icon; return <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{metric.label}</p><p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{metric.value}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.tone}`}><Icon className="h-5 w-5" /></span></div><p className="mt-2 text-xs text-slate-500">{metric.note}</p></article>; })}
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">Order center</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Your orders</h2><p className="mt-1 text-sm text-slate-500">Track deliveries and follow every return request.</p></div><a href="/orders" className="inline-flex items-center gap-2 text-sm font-bold text-sky-700 hover:text-sky-900">Track an order <ArrowRight className="h-4 w-4" /></a></div>
              <div className="mt-5 flex flex-wrap gap-2" aria-label="Filter orders">{['All orders', 'Active', 'Delivered', 'Returns & refunds'].map(filter => <button key={filter} onClick={() => setOrderFilter(filter)} aria-pressed={orderFilter === filter} className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${orderFilter === filter ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>{filter}{filter === 'Returns & refunds' && allRefunds.length > 0 ? ` (${allRefunds.length})` : ''}</button>)}</div>

              {visibleOrders.length ? <div className="mt-3 divide-y divide-slate-100">{visibleOrders.map(order => (
                <article key={order.id} className="py-5 sm:py-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><a href={`/order-confirmation/${order.id}`} className="font-mono text-sm font-black text-slate-900 hover:text-sky-700">{order.id}</a><StatusPill status={order.status} /></div><p className="mt-1 text-xs text-slate-500">Placed {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} <span className="mx-1">·</span> {order.items.length} item{order.items.length === 1 ? '' : 's'}</p></div><div className="flex items-center justify-between gap-3 sm:justify-end"><strong className="text-base font-black text-slate-950">{formatCurrency(order.total, order.currency || 'INR')}</strong><a href={`/orders?order_id=${encodeURIComponent(order.id)}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"><Truck className="h-4 w-4" />Track</a></div></div>
                  <div className="mt-4 flex flex-wrap gap-2">{order.items.slice(0, 3).map((item, index) => <div key={`${order.id}-${index}`} className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 py-2 pl-2 pr-3"><img src={item.image} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 bg-white object-contain" /><div className="min-w-0"><p className="max-w-48 truncate text-xs font-bold text-slate-800">{item.title}</p><p className="text-[11px] text-slate-500">Qty {item.quantity}</p></div></div>)}{order.items.length > 3 && <span className="self-center text-xs text-slate-500">+{order.items.length - 3} more</span>}</div>
                  {order.refunds?.length > 0 && <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="mb-3 flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-700"><RotateCcw className="h-4 w-4 text-sky-700" />Returns & refunds</p><span className="text-[11px] text-slate-500">{order.refunds.length} request{order.refunds.length === 1 ? '' : 's'}</span></div><div className="space-y-2">{order.refunds.map(refund => <div key={refund.id} className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-slate-900">Refund #{refund.id}</span><StatusPill status={refund.status} /></div><p className="mt-1 text-xs text-slate-600">{(refund.items || []).map(item => `${item.quantity} × ${item.title}`).join(', ')}</p>{refund.admin_note && <p className="mt-1 text-xs text-slate-500">Update: {refund.admin_note}</p>}{refund.processed_at && <p className="mt-1 text-[11px] text-emerald-700">Processed {new Date(refund.processed_at).toLocaleString('en-IN')}</p>}</div><strong className="text-sm font-black text-slate-900">{formatCurrency(refund.amount, order.currency || 'INR')}</strong></div>)}</div></div>}
                  <div className="mt-4 flex flex-wrap items-center gap-2"><a href={`/order-confirmation/${order.id}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:border-sky-400 hover:text-sky-800">Order details <ArrowUpRight className="h-3.5 w-3.5" /></a>{canRequestReturn(order) && order.status !== 'Refunded' && <button onClick={() => setRefundOrderId(refundOrderId === order.id ? '' : order.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:border-sky-400 hover:text-sky-800"><RotateCcw className="h-3.5 w-3.5" />Request return</button>}{!canRequestReturn(order) && order.status !== 'Refunded' && <span className="text-xs text-slate-500">Returns are available within 30 days after delivery.</span>}</div>
                  {refundOrderId === order.id && <RefundRequestForm order={order} onCancel={() => setRefundOrderId('')} onSubmitted={async text => { setRefundOrderId(''); setMessage(text); await loadAccount(); }} />}
                </article>
              ))}</div> : <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><Search className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 text-sm font-bold text-slate-800">{orders.length ? 'No orders in this view' : 'No account orders yet'}</p><p className="mt-1 text-sm text-slate-500">{orders.length ? 'Choose another filter to see your account activity.' : <>Guest orders are available from <a href="/orders" className="font-bold text-sky-700 hover:underline">order tracking</a>.</>}</p></div>}
            </section>

            <aside className="space-y-5">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">Personal details</p><h2 className="mt-1 text-lg font-black text-slate-950">Profile</h2></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><ShieldCheck className="h-5 w-5" /></span></div><form onSubmit={saveProfile} className="space-y-4"><label className="block text-xs font-bold text-slate-700">Name<input name="name" value={form.name} onChange={change} required maxLength={100} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label><label className="block text-xs font-bold text-slate-700">Email<input value={user.email} readOnly className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-500" /></label><button className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Save profile</button></form></section>
              <section className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 sm:p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm"><Truck className="h-5 w-5" /></div><h2 className="mt-4 text-base font-black text-slate-950">Need a delivery update?</h2><p className="mt-1 text-sm leading-6 text-slate-600">Open your order tracker for the latest fulfillment status and delivery history.</p><a href="/orders" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-sky-800 hover:text-sky-950">Go to order tracking <ArrowRight className="h-4 w-4" /></a></section>
              {user.is_admin && <a href="/admin/orders" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-sm hover:border-sky-300"><span className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-sky-700" />Store operations</span><ArrowUpRight className="h-4 w-4 text-slate-400" /></a>}
            </aside>
          </div>
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/70 lg:grid-cols-[1.02fr_0.98fr]">
          <aside className="relative flex min-h-[260px] flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-7 text-white sm:p-10 lg:min-h-[680px] lg:p-12">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
            <a href="/" className="relative z-10 inline-flex w-fit items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500 shadow-lg shadow-sky-900/40"><ShoppingBag className="h-5 w-5" /></span>
              <span className="text-lg font-black tracking-tight">APEX<span className="text-sky-400">STORE</span></span>
            </a>
            <div className="relative z-10 mt-10 max-w-lg lg:mt-0">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-sky-200"><Sparkles className="h-3.5 w-3.5" />A better way to shop</div>
              <h2 className="max-w-md text-3xl font-black leading-tight sm:text-4xl">Good finds.<br /><span className="text-sky-300">Right where you left them.</span></h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">Sign in to keep your orders, delivery updates, and account details together.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur"><Package className="h-5 w-5 text-sky-300" /><p className="mt-3 text-sm font-bold">Order updates</p><p className="mt-1 text-xs leading-5 text-slate-400">Follow each purchase from review to delivery.</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur"><Truck className="h-5 w-5 text-indigo-300" /><p className="mt-3 text-sm font-bold">Easy account access</p><p className="mt-1 text-xs leading-5 text-slate-400">See order details and manage refund requests.</p></div>
              </div>
            </div>
            <p className="relative z-10 mt-8 text-xs text-slate-500">Secure account access · Email verification codes expire after 10 minutes</p>
          </aside>

          <section className="flex items-center p-6 sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-md">
              {(mode === 'login' || mode === 'register') && <div className="mb-8 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button onClick={() => { setMode('login'); setError(''); setMessage(''); }} className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Sign in</button>
                <button onClick={() => { setMode('register'); setError(''); setMessage(''); }} className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Create account</button>
              </div>}

              <div className="mb-7">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><AuthIcon className="h-5 w-5" /></div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{mode === 'login' ? 'Welcome back' : title}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">{mode === 'verify' || mode === 'reset-confirm' ? `Enter the 6-digit code sent to ${form.email}.` : mode === 'register' ? 'Create an account to keep your orders and account details in one place.' : mode === 'login' ? 'Sign in to view your orders and pick up where you left off.' : 'Follow the steps to securely update your account.'}</p>
              </div>

              {message && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
              {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

              <form onSubmit={submit} className="space-y-4">
                {mode === 'register' && <label className="block text-sm font-semibold text-slate-700">Full name<input name="name" autoComplete="name" value={form.name} onChange={change} required placeholder="Your name" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 font-normal outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100" /></label>}
                {mode !== 'verify' && mode !== 'reset-confirm' && <label className="block text-sm font-semibold text-slate-700">Email address<input type="email" name="email" autoComplete="email" value={form.email} onChange={change} required placeholder="you@example.com" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 font-normal outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100" /></label>}
                {(mode === 'login' || mode === 'register' || mode === 'reset-confirm') && <label className="block text-sm font-semibold text-slate-700">{mode === 'reset-confirm' ? 'New password' : 'Password'}<span className="relative mt-1.5 block"><input type="password" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={change} minLength={10} maxLength={128} required placeholder={mode === 'login' ? 'Enter your password' : 'At least 10 characters'} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 pr-11 font-normal outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100" /><LockKeyhole className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></span>{mode !== 'login' && <span className="mt-1 block text-xs font-normal text-slate-500">Use at least 10 characters.</span>}</label>}
                {(mode === 'verify' || mode === 'reset-confirm') && <label className="block text-sm font-semibold text-slate-700">6-digit code<input inputMode="numeric" autoComplete="one-time-code" name="code" value={form.code} onChange={change} pattern="[0-9]{6}" maxLength={6} required placeholder="000000" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-3 font-mono text-lg tracking-[0.3em] outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100" /></label>}
                {mode === 'login' && <div className="flex justify-end"><button type="button" onClick={() => { setMode('reset-request'); setError(''); setMessage(''); }} className="text-sm font-semibold text-sky-700 hover:text-sky-900 hover:underline">Forgot password?</button></div>}
                <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700 disabled:opacity-50">{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'verify' ? 'Verify email' : mode === 'reset-request' ? 'Send reset code' : 'Update password'}{!busy && <ArrowRight className="h-4 w-4" />}</button>
              </form>

              <div className="mt-6 text-center text-sm">
                {mode === 'login' && <p className="text-slate-500">New to ApexStore? <button onClick={() => { setMode('register'); setError(''); setMessage(''); }} className="font-bold text-sky-700 hover:underline">Create an account</button></p>}
                {mode === 'register' && <p className="text-slate-500">Already have an account? <button onClick={() => { setMode('login'); setError(''); setMessage(''); }} className="font-bold text-sky-700 hover:underline">Sign in</button></p>}
                {(mode === 'verify' || mode === 'reset-request' || mode === 'reset-confirm') && <button onClick={() => { setMode('login'); setError(''); setMessage(''); }} className="font-semibold text-slate-600 hover:text-sky-700">Back to sign in</button>}
              </div>
              <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-500">Checkout is available without an account. Staff sign in with their approved account, then open <a href="/admin/orders" className="font-bold text-sky-700 hover:underline">order management</a>.</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
