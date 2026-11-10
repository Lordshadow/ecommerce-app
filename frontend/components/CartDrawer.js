'use client';

import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../lib/currency';
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight, Tag, Check, Sparkles } from 'lucide-react';

export default function CartDrawer() {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeFromCart,
    subtotal,
    discount,
    shippingFee,
    tax,
    total,
    appliedCoupon,
    applyCoupon,
    removeCoupon
  } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  if (!isCartOpen) return null;

  const freeShippingThreshold = 50;
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const progressPercent = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    await applyCoupon(couponInput);
    setCouponLoading(false);
    setCouponInput('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Shopping Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})
              </h2>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress */}
          <div className="p-4 bg-sky-50/70 border-b border-sky-100 text-xs">
            {remainingForFreeShipping > 0 ? (
              <div>
                <p className="text-slate-700 font-medium mb-1.5 flex items-center justify-between">
                  <span>Add <strong className="text-sky-700">{formatCurrency(remainingForFreeShipping)}</strong> more for <strong>FREE Shipping</strong>!</span>
                  <span className="text-sky-600 font-bold">{Math.round(progressPercent)}%</span>
                </p>
                <div className="w-full bg-sky-200/60 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-sky-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-emerald-700 font-semibold flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Congratulations! You qualified for <strong>FREE Shipping</strong>!</span>
              </p>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800">Your cart is empty</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Explore the catalog and add your favorite items to begin.
                  </p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow transition-all"
                >
                  Explore Catalog
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-colors shadow-sm"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-18 h-18 sm:w-20 sm:h-20 object-cover rounded-lg border border-slate-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <a
                          href={`/product/${item.id}`}
                          onClick={() => setIsCartOpen(false)}
                          className="text-xs sm:text-sm font-semibold text-slate-900 hover:text-sky-600 transition-colors line-clamp-1"
                        >
                          {item.title}
                        </a>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">{item.category}</span>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-200 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 py-0.5 text-xs font-bold text-slate-800 bg-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-200 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Line Item Total */}
                      <span className="text-sm font-black text-slate-900">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout Breakdown */}
          {cart.length > 0 && (
            <div className="p-4 sm:p-6 border-t border-slate-200 bg-slate-50 space-y-4">
              {/* Promo Coupon Form */}
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs">
                  <div className="flex items-center space-x-2 text-emerald-800 font-semibold">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Coupon <strong>{appliedCoupon.code}</strong> applied ({appliedCoupon.discount_percent}% off)</span>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="text-emerald-700 hover:text-rose-600 text-xs font-bold underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Promo code (SAVE20, WELCOME10)"
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={couponLoading || !couponInput.trim()}
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    {couponLoading ? 'Checking...' : 'Apply'}
                  </button>
                </form>
              )}

              {/* Cost Totals */}
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount ({appliedCoupon?.code})</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="font-semibold text-slate-900">
                    {shippingFee === 0 ? <strong className="text-emerald-600 uppercase">FREE</strong> : formatCurrency(shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Tax (8%)</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Due</span>
                  <span className="text-base text-sky-700 font-black">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <a
                  href="/checkout"
                  onClick={() => setIsCartOpen(false)}
                  className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-sky-600/20 transition-all"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="/cart"
                  onClick={() => setIsCartOpen(false)}
                  className="w-full bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 py-2 rounded-xl font-semibold text-xs text-center block transition-colors"
                >
                  View Full Cart Details
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
