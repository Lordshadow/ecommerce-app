'use client';

import React from 'react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { Star, Heart, ShoppingBag, Eye, Zap } from 'lucide-react';
import { formatCurrency } from '../lib/currency';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const isFavorited = isInWishlist(product.id);
  const discountPercent = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden">
      {/* Top Image Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
        <a href={`/product/${product.id}`} className="block w-full h-full">
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </a>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-none">
          {product.badge && (
            <span className="bg-slate-900/90 backdrop-blur-sm text-white text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full shadow-sm">
              {product.badge}
            </span>
          )}
          {discountPercent > 0 && (
            <span className="bg-rose-600 text-white text-[10px] uppercase font-black px-2 py-0.5 rounded-full shadow-sm">
              -{discountPercent}%
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product);
          }}
          className={`absolute top-3 right-3 p-2 rounded-full transition-all shadow-md z-10 ${
            isFavorited
              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
              : 'bg-white/90 backdrop-blur-sm text-slate-500 hover:text-rose-600 hover:bg-white'
          }`}
          aria-label={isFavorited ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-600' : ''}`} />
        </button>

        {/* Stock Urgency Tag */}
        {product.stock <= 5 && product.stock > 0 && (
          <div className="absolute bottom-2 left-2 right-2 bg-amber-500/95 backdrop-blur-xs text-slate-900 text-[10px] font-bold py-1 px-2.5 rounded-lg text-center flex items-center justify-center space-x-1 shadow">
            <Zap className="w-3 h-3 fill-slate-900" />
            <span>Only {product.stock} left in stock!</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Brand & Category */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-sky-600">
              {product.brand || 'Apex'}
            </span>
            <span>{product.category}</span>
          </div>

          {/* Title */}
          <a
            href={`/product/${product.id}`}
            className="text-sm font-semibold text-slate-900 hover:text-sky-600 transition-colors line-clamp-2 min-h-[40px]"
            title={product.title}
          >
            {product.title}
          </a>

          {/* Rating */}
          <div className="flex items-center space-x-1.5 mt-2">
            <div className="flex text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    product.rating > 0 && i < Math.floor(product.rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-200'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-slate-700">{product.rating > 0 ? product.rating.toFixed(1) : 'No ratings'}</span>
            {product.reviews_count > 0 && <span className="text-[11px] text-slate-400">({product.reviews_count})</span>}
          </div>
        </div>

        {/* Pricing & Add to Cart */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-lg font-black text-slate-900">
                {formatCurrency(product.price)}
              </span>
              {product.original_price && product.original_price > product.price && (
                <span className="text-xs text-slate-400 line-through">
                  {formatCurrency(product.original_price)}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => addToCart(product, 1)}
            disabled={product.stock === 0}
            className="flex items-center space-x-1.5 bg-slate-900 hover:bg-sky-600 disabled:bg-slate-300 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
            title="Add to Cart"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>
    </div>
  );
}
