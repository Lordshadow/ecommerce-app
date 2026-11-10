'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { convertLegacyUsdAmount, FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING_FEE, GST_RATE } from '../lib/currency';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [toast, setToast] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage
  useEffect(() => {
    try {
      const currentCart = localStorage.getItem('apex_cart_inr_v1');
      const currentCoupon = localStorage.getItem('apex_coupon_inr_v1');
      const savedCart = currentCart || localStorage.getItem('apex_cart');
      const savedCoupon = currentCoupon || localStorage.getItem('apex_coupon');
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setCart(currentCart ? parsedCart : parsedCart.map(item => ({ ...item, price: convertLegacyUsdAmount(item.price) })));
      }
      if (savedCoupon) {
        const parsedCoupon = JSON.parse(savedCoupon);
        setAppliedCoupon(currentCoupon ? parsedCoupon : { ...parsedCoupon, min_spend: convertLegacyUsdAmount(parsedCoupon.min_spend) });
      }
    } catch (e) {
      console.error('Failed to load cart from storage', e);
    }
    setIsLoaded(true);
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('apex_cart_inr_v1', JSON.stringify(cart));
      if (appliedCoupon) {
        localStorage.setItem('apex_coupon_inr_v1', JSON.stringify(appliedCoupon));
      } else {
        localStorage.removeItem('apex_coupon_inr_v1');
      }
    }
  }, [cart, appliedCoupon, isLoaded]);

  // Show Toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Add Item to Cart
  const addToCart = (product, quantity = 1) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === product.id);
      if (existing) {
        const newQty = existing.quantity + quantity;
        showToast(`Updated quantity for "${product.title}" (${newQty} in cart)`);
        return prevCart.map(item =>
          item.id === product.id ? { ...item, quantity: newQty } : item
        );
      } else {
        showToast(`Added "${product.title}" to cart!`);
        return [...prevCart, {
          id: product.id,
          title: product.title,
          price: product.price,
          image: product.image,
          stock: product.stock,
          category: product.category,
          quantity
        }];
      }
    });
  };

  // Update item quantity
  const updateQuantity = (productId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity: newQty } : item
      )
    );
  };

  // Remove Item
  const removeFromCart = (productId) => {
    setCart(prevCart => {
      const item = prevCart.find(i => i.id === productId);
      if (item) showToast(`Removed "${item.title}" from cart`, 'info');
      return prevCart.filter(i => i.id !== productId);
    });
  };

  // Clear Cart
  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
  };

  // Apply Coupon via backend or local validation
  const applyCoupon = async (code) => {
    if (!code || !code.trim()) return { success: false, error: 'Please enter a coupon code' };
    const cleanCode = code.trim().toUpperCase();

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/coupons/validate?code=${cleanCode}`);
      const data = await res.json();

      if (data.success && data.coupon) {
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        if (subtotal < data.coupon.min_spend) {
          const err = `Coupon requires minimum order of ₹${data.coupon.min_spend.toLocaleString('en-IN')}`;
          showToast(err, 'error');
          return { success: false, error: err };
        }
        setAppliedCoupon(data.coupon);
        showToast(`Coupon "${cleanCode}" applied! ${data.coupon.discount_percent}% OFF!`);
        return { success: true, coupon: data.coupon };
      } else {
        const err = data.error || 'Invalid coupon code';
        showToast(err, 'error');
        return { success: false, error: err };
      }
    } catch (e) {
      // Local fallback for common demo coupons
      const fallbackCoupons = {
        'WELCOME10': { code: 'WELCOME10', discount_percent: 10, min_spend: convertLegacyUsdAmount(20) },
        'SAVE20': { code: 'SAVE20', discount_percent: 20, min_spend: convertLegacyUsdAmount(80) },
        'SUPER30': { code: 'SUPER30', discount_percent: 30, min_spend: convertLegacyUsdAmount(150) },
      };
      if (fallbackCoupons[cleanCode]) {
        const c = fallbackCoupons[cleanCode];
        setAppliedCoupon(c);
        showToast(`Coupon "${cleanCode}" applied! ${c.discount_percent}% OFF!`);
        return { success: true, coupon: c };
      }
      showToast('Coupon code not found', 'error');
      return { success: false, error: 'Coupon code not found' };
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    showToast('Coupon removed', 'info');
  };

  // Totals
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discount = appliedCoupon ? (subtotal * appliedCoupon.discount_percent) / 100 : 0;
  const shippingFee = subtotal === 0 ? 0 : subtotal > FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
  const tax = (subtotal - discount) > 0 ? (subtotal - discount) * GST_RATE : 0;
  const total = Math.max(0, subtotal - discount + shippingFee + tax);
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        applyCoupon,
        removeCoupon,
        appliedCoupon,
        subtotal,
        discount,
        shippingFee,
        tax,
        total,
        totalItems,
        toast,
        showToast
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
