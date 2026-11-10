'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { formatCurrency } from '../../../lib/currency';
import {
  CheckCircle2,
  Package,
  Truck,
  Home,
  Clock,
  Printer,
  ArrowRight,
  ShieldCheck,
  MapPin
} from 'lucide-react';

export default function OrderConfirmationPage() {
  const params = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;

    const fetchOrder = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/orders/${params.id}`, { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.order) {
          setOrder(data.order);
        }
      } catch (err) {
        console.error('Failed to load order', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [params.id]);

  const orderId = params.id;
  const status = order?.status || 'Processing';
  const terminalStatus = ['Rejected', 'Cancelled', 'Refunded', 'Partially Refunded'].includes(status);
  const fulfillmentStep = status === 'Delivered'
    ? 3
    : status === 'Shipped'
      ? 2
      : 1;
  const timeline = [
    { label: 'Order Placed', detail: 'Verified & logged', icon: CheckCircle2 },
    { label: 'Processing', detail: 'Packing in warehouse', icon: Package },
    { label: 'In Transit', detail: 'Carrier dispatch', icon: Truck },
    { label: 'Delivered', detail: status === 'Delivered' ? 'Delivered' : 'Estimated in 3-5 days', icon: Home },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Top Success Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 sm:p-8 text-center space-y-3 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-emerald-950">
          Order Confirmed!
        </h1>
        <p className="text-xs sm:text-sm text-emerald-800 max-w-lg mx-auto">
          {status === 'Delivered'
            ? 'Your order has been delivered. Thank you for shopping with us.'
            : terminalStatus
              ? `This order is ${status.toLowerCase()}. See the order details below for the latest status.`
              : 'Thank you for your purchase. We have received your order and our fulfillment team is preparing it for dispatch.'}
        </p>
        <div className="pt-2">
          <span className="inline-block bg-white border border-emerald-300 text-slate-900 font-mono text-xs sm:text-sm font-bold px-4 py-1.5 rounded-full shadow-sm">
            Order Reference: {orderId}
          </span>
        </div>
      </div>

      {/* 4-Step Live Tracking Timeline */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
          <Truck className="w-4 h-4 text-sky-600" />
          <span>Fulfillment & Delivery Timeline</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative">
          {timeline.map((step, index) => {
            const complete = index === 0 || index < fulfillmentStep;
            const current = index === fulfillmentStep && !terminalStatus;
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex flex-col items-center text-center space-y-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${complete ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : current ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 animate-pulse' : 'bg-slate-200 text-slate-500 opacity-60'}`}>
                  {complete ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <div>
                  <p className={`text-xs font-bold ${current ? 'text-sky-600' : complete ? 'text-slate-900' : 'text-slate-500'}`}>{step.label}</p>
                  <p className="text-[11px] text-slate-500">{step.label === 'Delivered' && status === 'Delivered' ? 'Delivered' : step.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
        {order && <p className="text-center text-xs font-semibold text-slate-600">Current order status: <span className="text-slate-900">{status}</span></p>}
      </div>

      {/* Order Details & Summary Card */}
      {order && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100 text-xs">
            <div>
              <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-sky-600" />
                <span>Shipping Address</span>
              </h3>
              <p className="font-semibold text-slate-800">{order.customer_name}</p>
              <p className="text-slate-600">{order.shipping_address}</p>
              <p className="text-slate-600">{order.city}, {order.postal_code}</p>
              <p className="text-slate-500 mt-1">Email: {order.customer_email}</p>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Payment Summary</span>
              </h3>
              <p className="text-slate-600">Method: <strong className="text-slate-900">{order.payment_method}</strong></p>
              <p className="text-slate-600">Order status: <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{status}</span></p>
              <p className="text-slate-600 mt-1">Placed: {new Date(order.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Items breakdown */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
              Purchased Items
            </h3>
            <div className="divide-y divide-slate-100">
              {order.items && order.items.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <img src={item.image} alt={item.title} className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{item.title}</p>
                      <p className="text-[11px] text-slate-500">Qty: {item.quantity} &times; {formatCurrency(item.price, order.currency || 'USD')}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    {formatCurrency(item.price * item.quantity, order.currency || 'USD')}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="pt-4 border-t border-slate-100 space-y-1.5 text-xs text-slate-600 max-w-xs ml-auto">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900">{formatCurrency(order.subtotal || 0, order.currency || 'USD')}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Discount</span>
                  <span>-{formatCurrency(order.discount, order.currency || 'USD')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="font-bold text-slate-900">
                  {order.shipping_fee === 0 ? 'FREE' : formatCurrency(order.shipping_fee, order.currency || 'USD')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span className="font-bold text-slate-900">{formatCurrency(order.tax || 0, order.currency || 'USD')}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Paid</span>
                <span className="text-base text-sky-700 font-black">{formatCurrency(order.total || 0, order.currency || 'USD')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Action Controls */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        <a
          href="/"
          className="bg-sky-600 hover:bg-sky-700 text-white px-7 py-3 rounded-full text-xs font-bold shadow-md flex items-center space-x-2 transition-all"
        >
          <span>Continue Shopping</span>
          <ArrowRight className="w-4 h-4" />
        </a>
        <button
          onClick={() => window.print()}
          className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-full text-xs font-bold flex items-center space-x-2 transition-colors"
        >
          <Printer className="w-4 h-4 text-slate-500" />
          <span>Print Receipt</span>
        </button>
      </div>
    </div>
  );
}
