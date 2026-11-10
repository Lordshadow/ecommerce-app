'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Search, Package, CheckCircle2, Truck, Home, AlertCircle, ArrowRight, RotateCcw } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';

function statusTone(status) {
  if (['Delivered', 'Processed', 'Refunded'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (['Requested', 'Processing', 'Confirmed', 'Preparing', 'Shipped', 'Approved'].includes(status)) return 'border-sky-200 bg-sky-50 text-sky-800';
  if (['Rejected', 'Cancelled', 'Failed'].includes(status)) return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

export default function OrdersPage() {
  const [orderIdInput, setOrderIdInput] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [accountOrders, setAccountOrders] = useState([]);
  const [accountLoading, setAccountLoading] = useState(true);

  const loadAccountOrders = useCallback(async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    try {
      const meResponse = await fetch(`${apiUrl}/api/auth/me`, { credentials: 'include' });
      const meData = await meResponse.json();
      setUser(meData.user || null);
      if (!meData.user) {
        setAccountOrders([]);
        return;
      }
      const ordersResponse = await fetch(`${apiUrl}/api/account/orders`, { credentials: 'include' });
      const ordersData = await ordersResponse.json();
      if (!ordersResponse.ok || !ordersData.success) throw new Error(ordersData.error || 'Could not load your orders.');
      setAccountOrders(ordersData.orders || []);
    } catch (loadError) {
      console.error('Account orders error', loadError);
      setAccountOrders([]);
    } finally {
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccountOrders();
    window.addEventListener('apex-auth-changed', loadAccountOrders);
    return () => window.removeEventListener('apex-auth-changed', loadAccountOrders);
  }, [loadAccountOrders]);

  const trackOrder = useCallback(async (orderId) => {
    if (!orderId.trim()) return;
    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/orders/${encodeURIComponent(orderId.trim())}`, { credentials: 'include' });
      const data = await res.json();

      if (data.success && data.order) {
        setOrder(data.order);
      } else {
        setError(data.error || 'No order found with this reference number. Please check the code.');
      }
    } catch (err) {
      console.error('Order track error', err);
      setError('Could not query the order database. Please verify backend service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestedOrderId = new URLSearchParams(window.location.search).get('order_id');
    if (requestedOrderId) {
      setOrderIdInput(requestedOrderId);
      trackOrder(requestedOrderId);
    }
  }, [trackOrder]);

  const handleTrack = (event) => {
    event.preventDefault();
    trackOrder(orderIdInput);
  };

  const stages = ['Processing', 'Confirmed', 'Preparing', 'Shipped', 'Delivered'];
  const stageIndex = order ? Math.max(0, stages.indexOf(order.status)) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-10 sm:px-6 lg:px-8">
      <header className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-white to-sky-50 p-6 shadow-sm sm:p-8">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-sky-700"><Truck className="h-4 w-4" /> ApexStore delivery center</p>
        <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Track your order</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">See fulfillment progress, delivery history, and refund updates for your purchases.</p></div>{user && <a href="/account" className="inline-flex items-center gap-2 text-sm font-bold text-sky-700 hover:text-sky-900">Customer dashboard <ArrowRight className="h-4 w-4" /></a>}</div>
      </header>

      {user && <section className="space-y-4">
        {accountLoading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading your orders…</div> : accountOrders.length ? accountOrders.map(accountOrder => <article key={accountOrder.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Order placed {new Date(accountOrder.created_at).toLocaleDateString('en-IN')}</p><h2 className="mt-1 font-mono text-sm font-black text-slate-900">{accountOrder.id}</h2><p className="mt-1 text-xs text-slate-500">{accountOrder.items.length} item(s) · Ship to {accountOrder.city || accountOrder.customer_name}</p></div>
            <div className="flex items-center gap-3"><span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${statusTone(accountOrder.status)}`}>{accountOrder.status}</span><strong className="text-sm">{formatCurrency(accountOrder.total, accountOrder.currency || 'INR')}</strong></div>
          </div>
          <div className="mt-4 divide-y divide-slate-100 border-y border-slate-100">{accountOrder.items.slice(0, 3).map((item, index) => <div key={`${accountOrder.id}-${index}`} className="flex items-center gap-3 py-3"><img src={item.image} alt="" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{item.title}</p><p className="text-xs text-slate-500">Quantity: {item.quantity}</p></div></div>)}{accountOrder.items.length > 3 && <p className="py-2 text-xs text-slate-500">and {accountOrder.items.length - 3} more item(s)</p>}</div>
          {accountOrder.refunds?.length > 0 && <div className="mt-3 space-y-2">{accountOrder.refunds.map(refund => <div key={refund.id} className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center"><div><span className="flex items-center gap-1.5 text-xs font-bold text-slate-800"><RotateCcw className="h-3.5 w-3.5 text-sky-700" />Refund #{refund.id}<span className={`rounded-full border px-2 py-0.5 ${statusTone(refund.status)}`}>{refund.status}</span></span><p className="mt-1 text-xs text-slate-500">{(refund.items || []).map(item => `${item.quantity} × ${item.title}`).join(', ')}</p>{refund.processed_at && <p className="mt-1 text-[11px] text-emerald-700">Processed {new Date(refund.processed_at).toLocaleString('en-IN')}</p>}</div><strong className="text-sm">{formatCurrency(refund.amount, accountOrder.currency || 'INR')}</strong></div>)}</div>}
          <div className="mt-4 flex flex-wrap gap-3"><button onClick={() => trackOrder(accountOrder.id)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800">Track this order <ArrowRight className="h-4 w-4" /></button><a href="/account" className="inline-flex items-center px-2 text-xs font-bold text-sky-700 hover:underline">Manage returns and account</a></div>
        </article>) : <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><Package className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-800">No account orders yet</p><p className="mt-1 text-xs text-slate-500">Orders placed while you’re signed in will appear here.</p></div>}
      </section>}

      {/* Lookup Form */}
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-4"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Order reference</p><h2 className="mt-1 text-lg font-black text-slate-950">Look up an order</h2>{user && <p className="mt-1 text-xs text-slate-500">Use this for a guest order not listed above.</p>}</div>
        <form onSubmit={handleTrack} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              placeholder="e.g. ORD-20261102-4821"
              required
              aria-label="Order reference number"
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-sky-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-sky-800 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Track'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Order Results */}
      {order && (
        <div className="space-y-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm animate-in fade-in duration-300 sm:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center">
            <div>
              <span className="text-[10px] uppercase font-bold text-sky-600 tracking-wider">
                Order Status
              </span>
              <h2 className="text-xl font-black text-slate-900 font-mono">
                {order.id}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Recipient: {order.customer_name} &bull; {order.city}
              </p>
            </div>
            <span className={`w-max rounded-full border px-3 py-1.5 text-xs font-bold ${statusTone(order.status || 'Processing')}`}>{order.status || 'Processing'}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-5">
            {stages.map((stage, index) => {
              const complete = index < stageIndex || order.status === 'Delivered';
              const current = index === stageIndex && !['Rejected', 'Cancelled', 'Refunded', 'Partially Refunded'].includes(order.status);
              const Icon = index === 3 ? Truck : index === 4 ? Home : index === 0 ? CheckCircle2 : Package;
              return <div key={stage} className="space-y-2">
                <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${complete ? 'bg-emerald-500 text-white' : current ? 'animate-pulse bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'}`}><Icon className="h-5 w-5" /></div>
                <p className={`text-xs font-bold ${current ? 'text-sky-700' : complete ? 'text-emerald-700' : 'text-slate-500'}`}>{stage}</p>
              </div>;
            })}
          </div>
          {order.status === 'Delivered' && order.delivered_at && <p className="text-center text-sm font-semibold text-emerald-800">Delivered {new Date(order.delivered_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
          {['Rejected', 'Cancelled', 'Refunded', 'Partially Refunded'].includes(order.status) && <p className="rounded-xl bg-amber-50 p-3 text-center text-sm font-semibold text-amber-900">Current order state: {order.status}</p>}
          {order.history?.length > 0 && <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-xs font-bold text-slate-700">View status history</summary><div className="mt-3 space-y-2">{order.history.map((event, index) => <p key={index} className="text-xs text-slate-600">{new Date(event.created_at).toLocaleString()} · {event.new_status}{event.note ? ` — ${event.note}` : ''}</p>)}</div></details>}

          {order.refunds?.length > 0 && <section className="space-y-3 border-t border-slate-100 pt-5"><div><p className="text-xs font-black uppercase tracking-wider text-sky-700">Returns & refunds</p><h3 className="mt-1 text-lg font-black text-slate-950">Refund status</h3></div>{order.refunds.map(refund => <article key={refund.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">Refund #{refund.id}</strong><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone(refund.status)}`}>{refund.status}</span></div><p className="mt-1 text-xs text-slate-600">{(refund.items || []).map(item => `${item.quantity} × ${item.title}`).join(', ')}</p></div><strong className="text-base font-black text-slate-950">{formatCurrency(refund.amount, order.currency || 'INR')}</strong></div>{refund.processed_at && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Refund processed {new Date(refund.processed_at).toLocaleString('en-IN')}</p>}{refund.admin_note && <p className="mt-2 text-xs text-slate-600">Update: {refund.admin_note}</p>}</article>)}</section>}

          {/* Items List */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Ordered Products
            </h3>
            <div className="divide-y divide-slate-100">
              {order.items && order.items.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img src={item.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">{item.title}</p>
                      <p className="text-[11px] text-slate-500">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    {formatCurrency(item.price * item.quantity, order.currency || 'USD')}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between text-sm font-bold text-slate-900">
              <span>Total Paid</span>
              <span className="text-sky-700 font-black">{formatCurrency(order.total || 0, order.currency || 'USD')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
