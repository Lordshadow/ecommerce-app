'use client';

import React from 'react';
import { useCart } from '../context/CartContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast() {
  const { toast } = useCart();

  if (!toast) return null;

  const isError = toast.type === 'error';
  const isInfo = toast.type === 'info';

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-200 bg-slate-900 text-white border-slate-700">
      {isError ? (
        <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
      ) : isInfo ? (
        <Info className="w-5 h-5 text-sky-400 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
      )}
      <span className="text-xs sm:text-sm font-semibold">{toast.message}</span>
    </div>
  );
}
