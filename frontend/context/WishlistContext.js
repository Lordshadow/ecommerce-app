'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { convertLegacyUsdAmount } from '../lib/currency';

const WishlistContext = createContext();

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const current = localStorage.getItem('apex_wishlist_inr_v1');
      const saved = current || localStorage.getItem('apex_wishlist');
      if (saved) {
        const products = JSON.parse(saved);
        setWishlist(current ? products : products.map(item => ({
          ...item,
          price: convertLegacyUsdAmount(item.price),
          original_price: item.original_price ? convertLegacyUsdAmount(item.original_price) : item.original_price
        })));
      }
    } catch (e) {
      console.error('Failed to load wishlist', e);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('apex_wishlist_inr_v1', JSON.stringify(wishlist));
    }
  }, [wishlist, isLoaded]);

  const toggleWishlist = (product) => {
    setWishlist(prev => {
      const exists = prev.some(item => item.id === product.id);
      if (exists) {
        return prev.filter(item => item.id !== product.id);
      } else {
        return [...prev, {
          id: product.id,
          title: product.title,
          price: product.price,
          original_price: product.original_price,
          image: product.image,
          rating: product.rating,
          category: product.category,
          stock: product.stock
        }];
      }
    });
  };

  const isInWishlist = (productId) => {
    return wishlist.some(item => item.id === productId);
  };

  const removeFromWishlist = (productId) => {
    setWishlist(prev => prev.filter(item => item.id !== productId));
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        toggleWishlist,
        isInWishlist,
        removeFromWishlist,
        wishlistCount: wishlist.length
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
