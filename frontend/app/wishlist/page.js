'use client';

import React from 'react';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { Heart, ShoppingBag, Trash2, ArrowRight, Star } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';

export default function WishlistPage() {
  const { wishlist, removeFromWishlist } = useWishlist();
  const { addToCart, setIsCartOpen } = useCart();

  if (wishlist.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center mx-auto">
          <Heart className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900">Your Wishlist is Empty</h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Save your favorite gear to review later, track sales, or move to cart anytime.
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
      <div className="pb-6 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
          Saved Wishlist ({wishlist.length})
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review saved products or transfer them directly into your shopping cart.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {wishlist.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between group"
          >
            <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
              <a href={`/product/${item.id}`}>
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </a>
              <button
                onClick={() => removeFromWishlist(item.id)}
                className="absolute top-3 right-3 p-2 bg-white/90 rounded-full text-slate-400 hover:text-rose-600 shadow-md transition-colors"
                title="Remove from wishlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-sky-600 block mb-1">
                  {item.category}
                </span>
                <a
                  href={`/product/${item.id}`}
                  className="text-xs font-bold text-slate-900 hover:text-sky-600 transition-colors line-clamp-2"
                >
                  {item.title}
                </a>

                <div className="flex items-center space-x-1 text-amber-400 mt-2">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span className="text-xs font-bold text-slate-700">{item.rating || '4.8'}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-base font-black text-slate-900">
                  {formatCurrency(item.price)}
                </span>
                <button
                  onClick={() => {
                    addToCart(item, 1);
                    removeFromWishlist(item.id);
                    setIsCartOpen(true);
                  }}
                  className="flex items-center space-x-1.5 bg-slate-900 hover:bg-sky-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Move to Cart</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
