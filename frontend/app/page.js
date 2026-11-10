'use client';

import React, { useState, useEffect } from 'react';
import ProductCard from '../components/ProductCard';
import FilterSidebar from '../components/FilterSidebar';
import { formatCurrency, USD_TO_INR_RATE } from '../lib/currency';
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  Zap,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters State
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState('featured');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 12, totalPages: 0 });

  // Mobile filter drawer
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Read URL query params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlSearch = params.get('search');
      const urlCat = params.get('category');
      if (urlSearch) setSearch(urlSearch);
      if (urlCat) setCategory(urlCat);
    }
  }, []);

  // Fetch categories once
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/categories`);
        const data = await res.json();
        if (data.success) {
          setCategories(data.categories || []);
        }
      } catch (err) {
        console.error('Error loading categories', err);
      }
    };
    fetchCats();
  }, []);

  // Fetch products whenever filters or pagination changes
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: '12',
          sort
        });

        if (search) queryParams.set('search', search);
        if (category) queryParams.set('category', category);
        if (minPrice) queryParams.set('minPrice', minPrice);
        if (maxPrice) queryParams.set('maxPrice', maxPrice);
        if (minRating > 0) queryParams.set('minRating', minRating.toString());
        if (inStockOnly) queryParams.set('inStock', 'true');

        const res = await fetch(`${apiUrl}/api/products?${queryParams.toString()}`);
        const data = await res.json();

        if (data.success) {
          setProducts(data.products || []);
          setPagination(data.pagination || { total: 0, page: 1, limit: 12, totalPages: 1 });
        } else {
          setError(data.error || 'Failed to fetch products');
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Could not connect to the backend server. Please verify the backend REST API is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [search, category, minPrice, maxPrice, minRating, inStockOnly, sort, page]);

  const resetFilters = () => {
    setSearch('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    setMinRating(0);
    setInStockOnly(false);
    setSort('featured');
    setPage(1);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
  };

  return (
    <div className="space-y-12">
      {/* Hero Banner Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white py-16 sm:py-24">
        {/* Glow backdrop effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center space-x-2 bg-sky-500/10 border border-sky-500/30 text-sky-400 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                <span>The 2026 Curated Collection</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
                Smart Gear, Engineered <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                  For Modern Living.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
                Browse our collection across 8 departments, from high-performance audio and modern technology to home essentials and outdoor gear.
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <a
                  href="#catalog"
                  className="bg-sky-500 hover:bg-sky-400 text-slate-950 px-7 py-3.5 rounded-full font-black text-sm shadow-lg shadow-sky-500/25 flex items-center space-x-2 transition-all hover:scale-105"
                >
                  <span>Explore the collection</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <button
                  onClick={() => { setCategory('Electronics & Gadgets'); setPage(1); }}
                  className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-white px-6 py-3.5 rounded-full font-bold text-sm transition-colors"
                >
                  Featured Tech Deals
                </button>
              </div>

              {/* Guarantees Strip */}
              <div className="pt-6 border-t border-slate-800/80 grid grid-cols-3 gap-4 text-center lg:text-left text-xs text-slate-400">
                <div>
                  <strong className="block text-white text-sm font-black">{pagination.total.toLocaleString()}</strong>
                  <span>Products in Catalog</span>
                </div>
                <div>
                  <strong className="block text-white text-sm font-black">{categories.length}</strong>
                  <span>Departments</span>
                </div>
                <div>
                  <strong className="block text-white text-sm font-black">Product FAQs</strong>
                  <span>Listing details on each page</span>
                </div>
              </div>
            </div>

            {/* Right Hero Visual Cards */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                <div className="relative rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900 group">
                  <img
                    src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80"
                    alt="Hero Flagship Headphones"
                    className="w-full h-80 sm:h-96 object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-6 flex flex-col justify-end">
                    <span className="bg-amber-400 text-slate-950 text-[10px] uppercase font-black px-2.5 py-1 rounded-md w-max mb-2">
                      Editor&apos;s Pick
                    </span>
                    <h3 className="text-xl font-bold text-white">
                      SonicWave Studio Pro ANC Wireless
                    </h3>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-baseline space-x-2">
                        <span className="text-2xl font-black text-sky-400">{formatCurrency(279.99 * USD_TO_INR_RATE)}</span>
                        <span className="text-xs text-slate-400 line-through">{formatCurrency(349.99 * USD_TO_INR_RATE)}</span>
                      </div>
                      <a
                        href="/product/16"
                        className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
                      >
                        View Details &rarr;
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Pills Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-sky-600" />
            <span>Shop By Department</span>
          </h2>
          {category && (
            <button
              onClick={() => { setCategory(''); setPage(1); }}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700"
            >
              Clear Department Filter
            </button>
          )}
        </div>

        <div className="flex items-center space-x-3 overflow-x-auto pb-4 no-scrollbar">
          <button
            onClick={() => { setCategory(''); setPage(1); }}
            className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm ${
              !category
                ? 'bg-sky-600 text-white shadow-sky-600/20'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            All Products ({pagination.total.toLocaleString()})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id || cat.name}
              onClick={() => { setCategory(cat.name); setPage(1); }}
              className={`flex-shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center space-x-2 ${
                category === cat.name
                  ? 'bg-sky-600 text-white shadow-sky-600/20'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <span>{cat.name}</span>
              <span className="text-[10px] opacity-75 font-mono">({cat.product_count})</span>
            </button>
          ))}
        </div>
      </section>

      {/* Main Catalog Section */}
      <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
        {/* Top Filter & Sort Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 mb-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="lg:hidden flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-sky-600" />
              <span>Filters</span>
            </button>
            <div className="text-xs text-slate-600">
              Showing <strong className="text-slate-900 font-bold">{products.length}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{pagination.total}</strong> products
              {category && <span> in <span className="text-sky-600 font-bold">&ldquo;{category}&rdquo;</span></span>}
              {search && <span> matching <span className="text-sky-600 font-bold">&ldquo;{search}&rdquo;</span></span>}
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Sort by:</label>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="featured">Featured & Best Sellers</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Highest Rated (★)</option>
              <option value="newest">New Arrivals</option>
            </select>
          </div>
        </div>

        {/* Content Layout: Sidebar + Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block lg:col-span-1">
            <FilterSidebar
              categories={categories}
              selectedCategory={category}
              onSelectCategory={(cat) => { setCategory(cat); setPage(1); }}
              minPrice={minPrice}
              maxPrice={maxPrice}
              onPriceChange={(min, max) => { setMinPrice(min); setMaxPrice(max); setPage(1); }}
              minRating={minRating}
              onRatingChange={(r) => { setMinRating(r); setPage(1); }}
              inStockOnly={inStockOnly}
              onToggleInStock={(stock) => { setInStockOnly(stock); setPage(1); }}
              onResetFilters={resetFilters}
              totalMatching={pagination.total}
            />
          </aside>

          {/* Mobile Filter Sheet */}
          {mobileFilterOpen && (
            <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end">
              <div className="w-80 max-w-full bg-white h-full p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-900 text-sm">Refine Results</h3>
                  <button
                    onClick={() => setMobileFilterOpen(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    Close &times;
                  </button>
                </div>
                <FilterSidebar
                  categories={categories}
                  selectedCategory={category}
                  onSelectCategory={(cat) => { setCategory(cat); setPage(1); setMobileFilterOpen(false); }}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  onPriceChange={(min, max) => { setMinPrice(min); setMaxPrice(max); setPage(1); }}
                  minRating={minRating}
                  onRatingChange={(r) => { setMinRating(r); setPage(1); }}
                  inStockOnly={inStockOnly}
                  onToggleInStock={(stock) => { setInStockOnly(stock); setPage(1); }}
                  onResetFilters={resetFilters}
                  totalMatching={pagination.total}
                />
              </div>
            </div>
          )}

          {/* Products Grid */}
          <main className="lg:col-span-3 space-y-8">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-4 animate-pulse">
                    <div className="w-full aspect-square bg-slate-200 rounded-xl" />
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                    <div className="h-4 bg-slate-200 rounded w-full" />
                    <div className="h-6 bg-slate-200 rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center text-rose-800 space-y-3">
                <p className="font-bold text-base">Backend Connection Issue</p>
                <p className="text-xs text-rose-600 max-w-md mx-auto">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <SlidersHorizontal className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No products match your criteria</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Try clearing your search query or adjusting price and category filters to browse the full collection.
                </p>
                <button
                  onClick={resetFilters}
                  className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-5 py-2.5 rounded-full shadow transition-all"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-xs font-bold text-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center space-x-1">
                  {[...Array(pagination.totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-colors ${
                          page === pageNum
                            ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-xs font-bold text-slate-700 transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}
