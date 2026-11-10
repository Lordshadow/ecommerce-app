'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import { EXPRESS_SHIPPING_FEE, formatCurrency } from '../../lib/currency';
import {
  ShieldCheck,
  CreditCard,
  Truck,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShoppingBag,
  AlertCircle
} from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, discount, shippingFee, tax, total, appliedCoupon, clearCart, showToast } = useCart();

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    paymentMethod: 'Credit Card',
    cardNumber: '•••• •••• •••• 4242',
    cardExpiry: '12/28',
    cardCvc: '888',
    deliveryMethod: 'standard' // 'standard' or 'express'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    fetch(`${apiUrl}/api/auth/me`, { credentials: 'include' })
      .then(response => response.json())
      .then(data => {
        if (data.user) setFormData(previous => ({ ...previous, name: data.user.name, email: data.user.email }));
      })
      .catch(() => {});
  }, []);

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-black text-slate-900">Your Cart is Empty</h1>
        <p className="text-xs text-slate-500">Please add items to your cart before proceeding to checkout.</p>
        <a href="/" className="inline-block bg-sky-600 text-white px-6 py-2.5 rounded-full text-xs font-bold shadow">
          Return to Catalog
        </a>
      </div>
    );
  }

  const expressExtraFee = formData.deliveryMethod === 'express' ? EXPRESS_SHIPPING_FEE : 0;
  const finalTotal = total + expressExtraFee;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const orderPayload = {
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone,
        shipping_address: formData.address,
        city: formData.city,
        postal_code: formData.postalCode,
        payment_method: formData.paymentMethod,
        delivery_method: formData.deliveryMethod,
        coupon_code: appliedCoupon ? appliedCoupon.code : '',
        items: cart.map(item => ({
          id: item.id,
          quantity: item.quantity
        }))
      };

      const res = await fetch(`${apiUrl}/api/orders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();

      if (data.success && data.order) {
        showToast('Order placed successfully!');
        clearCart();
        router.push(`/order-confirmation/${data.order.id}`);
      } else {
        setError(data.error || 'Failed to place order. Please review your details.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('We could not reach the order service. Your cart is still saved; please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
          Secure Checkout
        </h1>
        <p className="text-xs text-slate-500 mt-1 flex items-center space-x-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          <span>256-bit Encrypted Checkout Protocol</span>
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-3 text-rose-800 text-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Form Details */}
        <div className="lg:col-span-7 space-y-8">
          {/* 1. Customer & Shipping Details */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2 pb-3 border-b border-slate-100">
              <span className="w-5 h-5 rounded-full bg-sky-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
              <span>Shipping Information</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address (for receipt)</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Postal / ZIP Code</label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">City & State</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* 2. Shipping Speed */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2 pb-3 border-b border-slate-100">
              <span className="w-5 h-5 rounded-full bg-sky-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
              <span>Shipping Speed</span>
            </h2>

            <div className="space-y-3">
              <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                formData.deliveryMethod === 'standard' ? 'border-sky-500 bg-sky-50/50' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="standard"
                    checked={formData.deliveryMethod === 'standard'}
                    onChange={handleChange}
                    className="text-sky-600 focus:ring-sky-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Standard Tracked Delivery (3-5 Days)</span>
                    <span className="text-[11px] text-slate-500">Delivered by trusted domestic courier partners</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-900">
                  {shippingFee === 0 ? 'FREE' : formatCurrency(shippingFee)}
                </span>
              </label>

              <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                formData.deliveryMethod === 'express' ? 'border-sky-500 bg-sky-50/50' : 'border-slate-200 hover:bg-slate-50'
              }`}>
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="express"
                    checked={formData.deliveryMethod === 'express'}
                    onChange={handleChange}
                    className="text-sky-600 focus:ring-sky-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Priority Express Air (1-2 Days)</span>
                    <span className="text-[11px] text-slate-500">Priority delivery to serviceable pin codes</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-900">+{formatCurrency(EXPRESS_SHIPPING_FEE)}</span>
              </label>
            </div>
          </div>

          {/* 3. Payment Method */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2 pb-3 border-b border-slate-100">
              <span className="w-5 h-5 rounded-full bg-sky-600 text-white text-[10px] flex items-center justify-center font-bold">3</span>
              <span>Payment Options</span>
            </h2>

            <div className="grid grid-cols-3 gap-3">
              {['Credit Card', 'Cash on Delivery', 'UPI / Digital'].map((method) => (
                <button
                  type="button"
                  key={method}
                  onClick={() => setFormData(prev => ({ ...prev, paymentMethod: method }))}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                    formData.paymentMethod === method
                      ? 'border-sky-600 bg-sky-50 text-sky-700 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {formData.paymentMethod === 'Credit Card' && (
              <div className="space-y-3 pt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Card Number</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="cardNumber"
                      value={formData.cardNumber}
                      onChange={handleChange}
                      placeholder="4242 4242 4242 4242"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <CreditCard className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Expiration (MM/YY)</label>
                    <input
                      type="text"
                      name="cardExpiry"
                      value={formData.cardExpiry}
                      onChange={handleChange}
                      placeholder="MM/YY"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">CVC Code</label>
                    <input
                      type="text"
                      name="cardCvc"
                      value={formData.cardCvc}
                      onChange={handleChange}
                      placeholder="CVC"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Review */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5 sticky top-24">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center justify-between">
              <span>Order Summary</span>
              <span className="text-xs text-sky-600 font-semibold">{cart.length} Products</span>
            </h2>

            {/* Compact items list */}
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1 space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="pt-2 flex items-center space-x-3">
                  <img src={item.image} alt={item.title} className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                    <p className="text-[11px] text-slate-500">Qty: {item.quantity} &times; {formatCurrency(item.price)}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Breakdown */}
            <div className="space-y-2 text-xs text-slate-600 pt-3 border-t border-slate-100">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Coupon Discount ({appliedCoupon?.code})</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping ({formData.deliveryMethod === 'express' ? 'Express' : 'Standard'})</span>
                <span className="font-semibold text-slate-900">
                  {shippingFee === 0 && formData.deliveryMethod === 'standard' ? (
                    <strong className="text-emerald-600 uppercase">FREE</strong>
                  ) : (
                    formatCurrency(shippingFee + expressExtraFee)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Sales Tax (8%)</span>
                <span className="font-semibold text-slate-900">{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-3 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="text-2xl text-sky-700 font-black">{formatCurrency(finalTotal)}</span>
              </div>
            </div>

            {/* Submit Order Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 disabled:opacity-50 text-white py-4 rounded-xl font-black text-sm shadow-xl shadow-sky-600/25 flex items-center justify-center space-x-2 transition-all"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{loading ? 'Processing Order...' : `Place Order (${formatCurrency(finalTotal)})`}</span>
            </button>

            <div className="text-center text-[11px] text-slate-400 space-y-1">
              <p>By clicking Place Order, your order is recorded in the SQLite database.</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
