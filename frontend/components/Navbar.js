'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { formatCurrency, FREE_SHIPPING_THRESHOLD } from '../lib/currency';
import {
  ShoppingBag,
  Heart,
  Search,
  Menu,
  X,
  Truck,
  ShieldCheck,
  Tag,
  ArrowRight,
  Package,
  UserRound
} from 'lucide-react';

export default function Navbar() {
  const router = useRouter();
  const { cart, setIsCartOpen, totalItems, subtotal } = useCart();
  const { wishlistCount } = useWishlist();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [account, setAccount] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const refreshAccount = () => fetch(`${apiUrl}/api/auth/me`, { credentials: 'include' })
      .then(response => response.json())
      .then(data => setAccount(data.user || null))
      .catch(() => setAccount(null));
    refreshAccount();
    window.addEventListener('apex-auth-changed', refreshAccount);
    return () => window.removeEventListener('apex-auth-changed', refreshAccount);
  }, []);

  // Live search debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/products?search=${encodeURIComponent(searchQuery)}&limit=5`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.products || []);
          setShowSearchDropdown(true);
        }
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close search dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSearchDropdown(false);
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      {/* Top Banner */}
      <div className="bg-slate-900 text-slate-100 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="bg-amber-500 text-slate-900 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">
              Deal
            </span>
            <span>Use code <strong className="text-amber-400 font-mono">SAVE20</strong> for 20% OFF! Free delivery on orders over {formatCurrency(FREE_SHIPPING_THRESHOLD)}</span>
          </div>
          <div className="hidden md:flex items-center space-x-6 text-slate-300">
            <span className="flex items-center space-x-1">
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Fast India-wide Delivery</span>
            </span>
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              <span>30-Day Money Back Guarantee</span>
            </span>
            <a href="/orders" className="hover:text-white transition-colors">
              Track Order
            </a>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <a href="/" className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  APEX<span className="text-sky-600">STORE</span>
                </span>
                <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 -mt-1">
                  Shop the collection
                </span>
              </div>
            </a>
          </div>

          {/* Search Bar with Predictive Dropdown */}
          <div className="flex-1 max-w-xl hidden md:block relative" ref={searchRef}>
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
                placeholder="Search products (e.g. drone, headphones, espresso, jacket)..."
                className="w-full bg-slate-50 border border-slate-300 rounded-full py-2.5 pl-11 pr-24 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all shadow-inner"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setShowSearchDropdown(false); }}
                  className="absolute right-16 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold px-1"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-colors"
              >
                Search
              </button>
            </form>

            {/* Predictive Results Dropdown */}
            {showSearchDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold uppercase tracking-wider">Matching Products ({searchResults.length})</span>
                  {isSearching && <span className="text-sky-600 font-medium">Searching...</span>}
                </div>
                {searchResults.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    No products found matching &ldquo;<span className="font-medium text-slate-800">{searchQuery}</span>&rdquo;
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {searchResults.map((product) => (
                      <a
                        key={product.id}
                        href={`/product/${product.id}`}
                        onClick={() => setShowSearchDropdown(false)}
                        className="flex items-center p-3 hover:bg-sky-50/50 transition-colors gap-3 group"
                      >
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-sky-600 transition-colors">
                            {product.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-bold text-slate-900">{formatCurrency(product.price)}</span>
                            {product.original_price && product.original_price > product.price && (
                              <span className="text-[11px] text-slate-400 line-through">
                                {formatCurrency(product.original_price)}
                              </span>
                            )}
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                              {product.category}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
                      </a>
                    ))}
                  </div>
                )}
                <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                  <button
                    onClick={handleSearchSubmit}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-700"
                  >
                    View all matching results &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Orders Lookup */}
            <a
              href="/orders"
              className="hidden lg:flex items-center space-x-1.5 text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              <Package className="w-4 h-4 text-slate-500" />
              <span>Orders</span>
            </a>

            <a href="/account" className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900" aria-label="Customer account">
              <UserRound className="h-4 w-4 text-slate-500" />
              <span>{account ? account.name.split(' ')[0] : 'Sign in'}</span>
            </a>

            {account?.is_admin && <a href="/admin/orders" className="hidden md:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-sky-700 transition-colors hover:bg-sky-50" aria-label="Manage store orders">
              <ShieldCheck className="h-4 w-4" />
              <span>Manage</span>
            </a>}

            {/* Wishlist Link */}
            <a
              href="/wishlist"
              className="relative p-2.5 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5" />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 bg-rose-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-scale">
                  {wishlistCount}
                </span>
              )}
            </a>

            {/* Cart Trigger */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all"
              aria-label="Open Shopping Cart"
            >
              <div className="relative">
                <ShoppingBag className="w-4 h-4" />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-sky-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="text-xs font-bold hidden sm:inline">
                {formatCurrency(subtotal)}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-4">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 pl-10 pr-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </form>
          <div className="grid grid-cols-2 gap-2 text-sm font-medium">
            <a href="/" className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800">
              Shop All Products
            </a>
            <a href="/wishlist" className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800 flex items-center justify-between">
              <span>Saved Items</span>
              <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">{wishlistCount}</span>
            </a>
            <a href="/cart" className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800 flex items-center justify-between">
              <span>Shopping Cart</span>
              <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold">{totalItems}</span>
            </a>
            <a href="/orders" className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800">
              Track Order
            </a>
            <a href="/account" className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800">
              {account ? 'My Account' : 'Sign In / Create Account'}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
