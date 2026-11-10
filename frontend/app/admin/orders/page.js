'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, LoaderCircle, PackageCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import { formatCurrency } from '../../../lib/currency';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const nextActions = {
  Processing: [
    { status: 'Confirmed', label: 'Approve order', style: 'bg-emerald-600 hover:bg-emerald-700' },
    { status: 'Rejected', label: 'Reject order', style: 'bg-rose-600 hover:bg-rose-700' }
  ],
  Confirmed: [{ status: 'Preparing', label: 'Start preparing', style: 'bg-sky-600 hover:bg-sky-700' }, { status: 'Cancelled', label: 'Cancel', style: 'bg-rose-600 hover:bg-rose-700' }],
  Preparing: [{ status: 'Shipped', label: 'Mark shipped', style: 'bg-indigo-600 hover:bg-indigo-700' }, { status: 'Cancelled', label: 'Cancel', style: 'bg-rose-600 hover:bg-rose-700' }],
  Shipped: [{ status: 'Delivered', label: 'Mark delivered', style: 'bg-emerald-600 hover:bg-emerald-700' }]
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [tab, setTab] = useState('orders');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [admin, setAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orderResponse, refundResponse] = await Promise.all([
        fetch(`${API}/api/admin/orders`, { credentials: 'include' }),
        fetch(`${API}/api/admin/refunds`, { credentials: 'include' })
      ]);
      const [orderData, refundData] = await Promise.all([orderResponse.json(), refundResponse.json()]);
      if (orderResponse.status === 401 || orderResponse.status === 403) throw new Error(orderData.error || 'Sign in with an allowlisted staff account to manage orders.');
      if (!orderResponse.ok || !refundResponse.ok || !orderData.success || !refundData.success) throw new Error(orderData.error || refundData.error || 'Could not load the order dashboard.');
      setOrders(orderData.orders || []);
      setRefunds(refundData.refunds || []);
      setAdmin(true);
    } catch (requestError) {
      setAdmin(false);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const action = async (key, path, method, payload, successText) => {
    setBusyKey(key);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API}${path}`, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...(payload ? { body: JSON.stringify(payload) } : {})
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'That update could not be saved.');
      setMessage(successText);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyKey('');
    }
  };

  const reviewRefund = (refund, status) => {
    const note = window.prompt(status === 'Approved' ? 'Optional note for approving and issuing this refund now:' : 'Reason for rejecting this refund:');
    if (note === null) return;
    if (status === 'Rejected' && note.trim().length < 5) {
      setError('Enter a short reason when rejecting a refund.');
      return;
    }
    action(`refund-${refund.id}`, `/api/admin/refunds/${refund.id}/review`, 'PATCH', { status, note }, status === 'Approved' ? `Refund #${refund.id} issued.` : `Refund #${refund.id} rejected.`);
  };

  const filteredOrders = statusFilter === 'All' ? orders : orders.filter(order => order.status === statusFilter);
  const pendingRefunds = refunds.filter(refund => refund.status === 'Requested').length;
  const waitingOrders = orders.filter(order => order.status === 'Processing').length;

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 rounded-3xl bg-slate-900 p-7 text-white sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-sky-300"><ClipboardCheck className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-widest">Store operations</span></div>
          <h1 className="mt-2 text-3xl font-black">Orders & refunds</h1>
          <p className="mt-1 text-sm text-slate-300">Review incoming orders, manage fulfillment, and approve refunds for immediate issuance.</p>
        </div>
        <button onClick={load} className="flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-bold hover:bg-slate-800"><RefreshCw className="h-4 w-4" />Refresh</button>
      </header>

      {!admin && !loading && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><strong>Staff access required.</strong> Sign in with a verified account whose email is listed in <code>ADMIN_EMAILS</code> in the project `.env`, then restart the backend container.</div>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}

      {admin && <>
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Orders in queue</p><p className="mt-1 text-3xl font-black text-slate-900">{waitingOrders}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">All orders</p><p className="mt-1 text-3xl font-black text-slate-900">{orders.length}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Refunds waiting review</p><p className="mt-1 text-3xl font-black text-amber-600">{pendingRefunds}</p></div>
        </section>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
          <button onClick={() => setTab('orders')} className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === 'orders' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'}`}>Orders</button>
          <button onClick={() => setTab('refunds')} className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === 'refunds' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500'}`}>Refund requests{pendingRefunds > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{pendingRefunds}</span>}</button>
          {tab === 'orders' && <label className="ml-auto flex items-center gap-2 pb-1 text-xs font-bold text-slate-500">Status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"><option>All</option>{['Processing', 'Confirmed', 'Preparing', 'Shipped', 'Delivered', 'Rejected', 'Cancelled', 'Partially Refunded', 'Refunded'].map(status => <option key={status}>{status}</option>)}</select></label>}
        </div>

        {loading ? <div className="flex items-center justify-center gap-2 py-16 text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />Loading records…</div> : tab === 'orders' ? (
          <section className="space-y-4">
            {filteredOrders.length === 0 && <p className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500">No orders match this filter.</p>}
            {filteredOrders.map(order => <article key={order.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start">
                <div><a href={`/order-confirmation/${order.id}`} className="font-mono text-sm font-black text-sky-700 hover:underline">{order.id}</a><p className="mt-1 text-sm font-bold text-slate-900">{order.customer_name} · {order.customer_email}</p><p className="mt-1 text-xs text-slate-500">{order.shipping_address}, {order.city} {order.postal_code} · {new Date(order.created_at).toLocaleString()}</p></div>
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{order.status}</span><strong className="text-lg">{formatCurrency(order.total, order.currency || 'USD')}</strong></div>
              </div>
              <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto]">
                <div className="space-y-2">{order.items.map((item, index) => <div key={`${order.id}-${index}`} className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-700">{item.quantity} × {item.title}</span><span className="font-semibold">{formatCurrency(Number(item.line_total ?? item.price * item.quantity), order.currency || 'USD')}</span></div>)}<p className="pt-2 text-xs text-slate-500">Payment method: {order.payment_method} · Refund requests: {order.refunds.length}</p>{order.history?.length > 0 && <details className="pt-2 text-xs"><summary className="cursor-pointer font-bold text-sky-700">Status history</summary><div className="mt-2 space-y-1 border-l border-slate-200 pl-3">{order.history.map((event, index) => <p key={index} className="text-slate-600">{new Date(event.created_at).toLocaleString()} · {event.new_status}{event.note ? ` — ${event.note}` : ''}</p>)}</div></details>}</div>
                <div className="flex flex-wrap content-start gap-2 lg:max-w-sm lg:justify-end">{(nextActions[order.status] || []).map(next => <button key={next.status} disabled={busyKey === `order-${order.id}`} onClick={() => { if (['Rejected', 'Cancelled'].includes(next.status) && !window.confirm(`Move order ${order.id} to ${next.status}?`)) return; action(`order-${order.id}`, `/api/admin/orders/${order.id}/status`, 'PATCH', { status: next.status }, `Order ${order.id} moved to ${next.status}.`); }} className={`rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50 ${next.style}`}>{busyKey === `order-${order.id}` ? 'Saving…' : next.label}</button>)}</div>
              </div>
            </article>)}
          </section>
        ) : (
          <section className="space-y-4">
            {refunds.length === 0 && <p className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500">There are no refund requests.</p>}
            {refunds.map(refund => <article key={refund.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="font-bold text-slate-900">Refund #{refund.id} · <a href={`/order-confirmation/${refund.order_id}`} className="font-mono text-sky-700 hover:underline">{refund.order_id}</a></p><p className="mt-1 text-sm text-slate-600">{refund.customer_name} · {refund.customer_email}</p><p className="mt-1 text-xs text-slate-500">Requested {new Date(refund.created_at).toLocaleString()} · Order status: {refund.order_status}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">{refund.status}</span><strong className="text-xl">{formatCurrency(refund.amount, refund.currency || 'USD')}</strong></div></div>
              <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-[1fr_1fr]"><div><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Products requested</p>{refund.items.map((item, index) => <p key={index} className="text-sm text-slate-700">{item.quantity} × {item.title} · {formatCurrency(item.refund_amount, refund.currency || 'USD')}</p>)}</div><div><p className="mb-1 text-xs font-black uppercase tracking-wide text-slate-500">Customer reason</p><p className="text-sm text-slate-700">{refund.reason}</p>{refund.admin_note && <p className="mt-2 text-xs text-slate-500">Staff note: {refund.admin_note}</p>}</div></div>
              <div className="mt-4 flex flex-wrap gap-2">{refund.status === 'Requested' && <><button disabled={busyKey === `refund-${refund.id}`} onClick={() => reviewRefund(refund, 'Approved')} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button><button disabled={busyKey === `refund-${refund.id}`} onClick={() => reviewRefund(refund, 'Rejected')} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50">Reject</button></>}{refund.status === 'Approved' && <button disabled={busyKey === `refund-${refund.id}`} onClick={() => { if (window.confirm('After you have sent this amount using the payment provider, mark this refund as processed?')) action(`refund-${refund.id}`, `/api/admin/refunds/${refund.id}/process`, 'POST', {}, `Refund #${refund.id} marked processed.`); }} className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-50"><PackageCheck className="mr-1 inline h-4 w-4" />Mark refund sent</button>}{refund.status === 'Approved' && <p className="basis-full text-xs text-amber-800"><ShieldAlert className="mr-1 inline h-4 w-4" />This app records the refund; it does not send money. Issue it with your payment provider first.</p>}</div>
            </article>)}
          </section>
        )}
      </>}
    </main>
  );
}
