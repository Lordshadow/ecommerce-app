'use client';

import React, { useState } from 'react';
import { Truck, ShieldCheck, Headphones, RotateCcw, Mail, CheckCircle2, ShoppingBag } from 'lucide-react';
import { formatCurrency, FREE_SHIPPING_THRESHOLD } from '../lib/currency';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email && email.includes('@')) {
      setSubscribed(true);
    }
  };

  return (
    <footer className="bg-slate-950 text-slate-400 mt-20 border-t border-slate-900">
      {/* 4 Trust Value Pillars */}
      <div className="border-b border-slate-800/60 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-white text-sm font-bold">Free Fast Shipping</h4>
                <p className="text-xs text-slate-400 mt-0.5">Complimentary delivery over {formatCurrency(FREE_SHIPPING_THRESHOLD)}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-white text-sm font-bold">256-Bit SSL Encrypted</h4>
                <p className="text-xs text-slate-400 mt-0.5">100% Secure Payment Checkout</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-white text-sm font-bold">30-Day Free Returns</h4>
                <p className="text-xs text-slate-400 mt-0.5">Hassle-free instant refunds</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                <Headphones className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-white text-sm font-bold">24/7 Dedicated Care</h4>
                <p className="text-xs text-slate-400 mt-0.5">Live expert chat & assistance</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span className="text-xl font-black tracking-tight text-white">
                APEX<span className="text-sky-500">STORE</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Discover curated tech, apparel, artisan kitchenware, and audio devices. Hand-selected for exceptional performance, durability, and contemporary style.
            </p>

            {/* Newsletter */}
            <div className="pt-2">
              <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Join our newsletter & get 10% off
              </h5>
              {subscribed ? (
                <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-3.5 py-2.5 rounded-xl text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Success! Use coupon code <strong className="text-white">WELCOME10</strong> at checkout.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address..."
                    required
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="submit"
                    className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                  >
                    Subscribe
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Catalog Links */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
              Explore Categories
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li><a href="/?category=Electronics+%26+Gadgets" className="hover:text-white transition-colors">Electronics & Gadgets</a></li>
              <li><a href="/?category=Audio+%26+Sound" className="hover:text-white transition-colors">Audio & Headphones</a></li>
              <li><a href="/?category=Computers+%26+Office" className="hover:text-white transition-colors">Computers & Office</a></li>
              <li><a href="/?category=Fashion+%26+Apparel" className="hover:text-white transition-colors">Fashion & Apparel</a></li>
              <li><a href="/?category=Home+%26+Kitchen" className="hover:text-white transition-colors">Home & Kitchen</a></li>
              <li><a href="/?category=Groceries" className="hover:text-white transition-colors">Groceries</a></li>
              <li><a href="/?category=Sports+%26+Outdoors" className="hover:text-white transition-colors">Sports & Outdoors</a></li>
            </ul>
          </div>

          {/* Customer Care */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
              Customer Support
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li><a href="/orders" className="hover:text-white transition-colors">Track Your Order</a></li>
              <li><a href="/cart" className="hover:text-white transition-colors">Review Cart</a></li>
              <li><a href="/wishlist" className="hover:text-white transition-colors">Saved Wishlist</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Returns & Refunds</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Shipping Information</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Help Center & FAQ</a></li>
            </ul>
          </div>

          {/* Trust & Guarantees */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
              Apex Guarantee
            </h4>
            <div className="space-y-3 text-xs">
              <p className="text-slate-400">
                Product listing details are provided for browsing and may change. Verify current price, availability, and warranty terms with the seller before purchase.
              </p>
              <p className="pt-3 text-[10px] leading-relaxed text-slate-500">
                Product listing data: <a className="underline hover:text-slate-300" href="https://huggingface.co/datasets/Tokuhn/TSMPD-US-Public-v1_1" target="_blank" rel="noreferrer">Tokuhn TSMPD-US Public v1.0</a>, licensed under <a className="underline hover:text-slate-300" href="https://opendatacommons.org/licenses/by/1-0/" target="_blank" rel="noreferrer">ODC-BY</a>.
              </p>
              <div className="pt-2 flex flex-wrap gap-2 text-[10px] text-slate-300 font-mono">
                <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded">VISA</span>
                <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded">MASTERCARD</span>
                <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded">AMEX</span>
                <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded">APPLE PAY</span>
                <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded">PAYPAL</span>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-12 mt-12 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 ApexStore Inc. All rights reserved. Powered by Next.js, React & SQLite.</p>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-slate-400">Privacy Policy</a>
            <a href="#" className="hover:text-slate-400">Terms of Service</a>
            <a href="#" className="hover:text-slate-400">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
