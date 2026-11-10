'use client';

import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { formatCurrency, FREE_SHIPPING_THRESHOLD } from '../../lib/currency';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, Tag, ShieldCheck, Truck, Sparkles } from 'lucide-react';

export default function CartPage() {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotal,
    discount,
    shippingFee,
    tax,
    total,
    appliedCoupon,
    applyCoupon,
    removeCoupon
  } = useCart();

  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const handleCouponSubmit = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    await applyCoupon(couponCode);
    setCouponLoading(false);
    setCouponCode('');
  };

  const freeShippingThreshold = FREE_SHIPPING_THRESHOLD;
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const progressPercent = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900">Your Cart is Empty</h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            You haven&apos;t added any items to your shopping cart yet. Explore products across 8 categories to get started!
          </p>
        </div>
        <a
          href="/"
          className="inline-flex items-center space-x-2 bg-sky-600 hover:bg-sky-700 text-white px-7 py-3 rounded-full text-xs font-bold shadow-md transition-all"
        >
          <span>Explore the catalog</span>
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            Shopping Cart
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review your items and proceed to secure checkout.
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-slate-400 hover:text-rose-600 font-semibold transition-colors"
        >
          Clear Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Cart Items List */}
        <div className="lg:col-span-8 space-y-4">
          {/* Free Shipping Notification */}
          <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 text-xs">
            {remainingForFreeShipping > 0 ? (
              <div>
                <p className="text-slate-700 font-medium mb-1.5 flex items-center justify-between">
                  <span>Add <strong className="text-sky-700">{formatCurrency(remainingForFreeShipping)}</strong> more for <strong>FREE Shipping</strong>!</span>
                  <span className="text-sky-600 font-bold">{Math.round(progressPercent)}%</span>
                </p>
                <div className="w-full bg-sky-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-sky-600 h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            ) : (
              <p className="text-emerald-700 font-semibold flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>You unlocked <strong>FREE Standard Shipping</strong>!</span>
              </p>
            )}
          </div>

          <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {cart.map((item) => (
              <div key={item.id} className="p-5 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-24 h-24 object-cover rounded-xl border border-slate-200 flex-shrink-0"
                />

                <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
                  <span className="text-[10px] uppercase font-bold text-sky-600">
                    {item.category}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2">
                    <a href={`/product/${item.id}`} className="hover:text-sky-600 transition-colors">
                      {item.title}
                    </a>
                  </h3>
                  <div className="text-xs text-slate-500 font-mono">
                    Unit Price: {formatCurrency(item.price)}
                  </div>
                </div>

                {/* Stepper */}
                <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="p-2 text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 py-1 text-xs font-bold text-slate-800 bg-white min-w-[32px] text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="p-2 text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Line Total */}
                <div className="text-right sm:min-w-[100px]">
                  <span className="text-base font-black text-slate-900 block">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-[11px] text-rose-500 hover:text-rose-700 font-medium inline-flex items-center space-x-1 mt-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <a href="/" className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center space-x-1">
              <span>&larr; Continue Shopping</span>
            </a>
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
              Order Summary
            </h2>

            {/* Promo Code Form */}
            {appliedCoupon ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs">
                <div className="flex items-center space-x-2 text-emerald-800 font-semibold">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Coupon <strong>{appliedCoupon.code}</strong> applied ({appliedCoupon.discount_percent}% off)</span>
                </div>
                <button
                  onClick={removeCoupon}
                  className="text-emerald-700 hover:text-rose-600 font-bold underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleCouponSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Coupon code (SAVE20, WELCOME10)"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="submit"
                  disabled={couponLoading || !couponCode.trim()}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                >
                  {couponLoading ? 'Checking...' : 'Apply'}
                </button>
              </form>
            )}

            {/* Calculations */}
            <div className="space-y-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <div className="flex justify-between">
                <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount ({appliedCoupon?.code})</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Estimated Shipping</span>
                <span className="font-semibold text-slate-900">
                  {shippingFee === 0 ? <strong className="text-emerald-600 uppercase">FREE</strong> : formatCurrency(shippingFee)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Sales Tax (8%)</span>
                <span className="font-semibold text-slate-900">{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-3 border-t border-slate-200">
                <span>Total Due</span>
                <span className="text-xl text-sky-700 font-black">{formatCurrency(total)}</span>
              </div>
            </div>

            <a
              href="/checkout"
              className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-sky-600/20 flex items-center justify-center space-x-2 transition-all block text-center"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <div className="pt-2 text-center text-[11px] text-slate-400 flex items-center justify-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Encrypted 256-Bit SSL Checkout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
