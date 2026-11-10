'use client';

import React from 'react';
import { Filter, RotateCcw, Star, Check } from 'lucide-react';

export default function FilterSidebar({
  categories = [],
  selectedCategory,
  onSelectCategory,
  minPrice,
  maxPrice,
  onPriceChange,
  minRating,
  onRatingChange,
  inStockOnly,
  onToggleInStock,
  onResetFilters,
  totalMatching
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-sky-600" />
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
            Filters
          </h3>
        </div>
        <button
          onClick={onResetFilters}
          className="text-xs text-slate-500 hover:text-sky-600 flex items-center space-x-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Categories */}
      <div>
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          Categories
        </h4>
        <div className="space-y-1">
          <button
            onClick={() => onSelectCategory('')}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-between ${
              !selectedCategory
                ? 'bg-sky-50 text-sky-700 font-bold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>All Categories</span>
            <span className="text-[11px] text-slate-400">100</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id || cat.name}
              onClick={() => onSelectCategory(cat.name)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-between ${
                selectedCategory === cat.name
                  ? 'bg-sky-50 text-sky-700 font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="truncate pr-2">{cat.name}</span>
              <span className="text-[11px] text-slate-400 font-mono">
                {cat.product_count || ''}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="pt-4 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          Price Range (₹)
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Min</label>
            <input
              type="number"
              value={minPrice || ''}
              onChange={(e) => onPriceChange(e.target.value, maxPrice)}
              placeholder="0"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Max</label>
            <input
              type="number"
              value={maxPrice || ''}
              onChange={(e) => onPriceChange(minPrice, e.target.value)}
              placeholder="120000"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Minimum Rating */}
      <div className="pt-4 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          Rating
        </h4>
        <div className="space-y-1.5">
          {[
            { label: '4.5★ and above', val: 4.5 },
            { label: '4.0★ and above', val: 4.0 },
            { label: 'All Ratings', val: 0 }
          ].map((r) => (
            <label
              key={r.val}
              className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer hover:text-slate-900"
            >
              <input
                type="radio"
                name="rating_filter"
                checked={minRating === r.val}
                onChange={() => onRatingChange(r.val)}
                className="text-sky-600 focus:ring-sky-500 rounded-full"
              />
              <span className="flex items-center space-x-1">
                <span>{r.label}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Stock Availability */}
      <div className="pt-4 border-t border-slate-100">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          Availability
        </h4>
        <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => onToggleInStock(e.target.checked)}
            className="rounded text-sky-600 focus:ring-sky-500"
          />
          <span>In Stock Only</span>
        </label>
      </div>
    </div>
  );
}
