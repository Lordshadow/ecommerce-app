'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../lib/currency';
import {
  Sparkles,
  X,
  Send,
  ShoppingBag,
  RotateCcw,
  Bot,
  User,
  ArrowRight,
  Star,
  Check,
  Package,
  ExternalLink
} from 'lucide-react';

export default function AIAssistant() {
  const { addToCart, setIsCartOpen } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "👋 Hi there! I can help with general store questions and point you to your account pages. For live product search, order details, tracking, or refunds, use the authenticated ApexStore tools.\n\nWhat do you need help with?",
      actionPills: [
        'Browse products',
        'View my orders',
        'Open my account',
        '🔄 Return & refund policy'
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [addedItems, setAddedItems] = useState({});
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (messageText) => {
    const query = (messageText || input).trim();
    if (!query || loading) return;

    const userMsg = { role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query })
      });
      const data = await res.json();

      if (data.success) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply,
            suggestedProducts: data.suggestedProducts || [],
            orderInfo: data.orderInfo || null,
            actionPills: data.actionPills || []
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: "Sorry, I ran into an issue connecting to the product database. Please try again."
          }
        ]);
      }
    } catch (err) {
      console.error('AI chat error:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I couldn't reach the backend server. Please verify the REST API is running on port 5000."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product) => {
    addToCart(product, 1);
    setAddedItems(prev => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedItems(prev => ({ ...prev, [product.id]: false }));
    }, 2000);
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Chat cleared! I can help with general store questions or direct you to the authenticated ApexStore tools for live shop data.",
        actionPills: [
          'Browse products',
          'View my orders',
          'Open my account'
        ]
      }
    ]);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-6 right-6 z-40">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center space-x-2.5 bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 hover:from-sky-500 hover:to-indigo-500 text-white px-5 py-3.5 rounded-full shadow-2xl hover:shadow-sky-500/25 transition-all duration-300 hover:scale-105"
            aria-label="Open AI Shopping Assistant"
          >
            <div className="relative">
              <Sparkles className="w-5 h-5 animate-spin-slow text-amber-300" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full animate-ping" />
            </div>
            <span className="text-xs font-black tracking-wide">
              Apex AI Assistant
            </span>
          </button>
        )}
      </div>

      {/* Chat Window Drawer / Modal */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[440px] max-h-[640px] h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold flex items-center space-x-1.5">
                  <span>Apex AI Assistant</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                </h3>
                <p className="text-[10px] text-slate-300">
                  Grounded in the ApexStore catalog
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={handleClearChat}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="Clear conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="Close chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Speech Bubble */}
                  <div
                    className={`rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white rounded-tr-none'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none whitespace-pre-line'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Order Tracking Preview Card if present */}
                  {msg.orderInfo && (
                    <div className="bg-white border border-emerald-200 rounded-2xl p-3.5 shadow-sm space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 font-mono">{msg.orderInfo.id}</span>
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200">
                          {msg.orderInfo.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Total: <strong className="text-slate-900">{formatCurrency(msg.orderInfo.total, msg.orderInfo.currency || 'INR')}</strong> &bull; Destination: {msg.orderInfo.city}
                      </div>
                      <a
                        href={`/orders?id=${msg.orderInfo.id}`}
                        className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center space-x-1"
                      >
                        <span>View complete fulfillment timeline</span>
                        <ArrowRight className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {/* Product Recommendation Cards Carousel */}
                  {msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                    <div className="space-y-2 pt-1 w-full">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Recommended Items ({msg.suggestedProducts.length}):
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {msg.suggestedProducts.map((prod) => (
                          <div
                            key={prod.id}
                            className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-3 shadow-xs hover:border-sky-300 transition-colors"
                          >
                            <img
                              src={prod.image}
                              alt={prod.title}
                              className="w-14 h-14 object-cover rounded-lg border border-slate-100 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-bold text-sky-600 uppercase">
                                {prod.category}
                              </span>
                              <a
                                href={`/product/${prod.id}`}
                                className="block text-xs font-bold text-slate-900 hover:text-sky-600 transition-colors truncate"
                                title={prod.title}
                              >
                                {prod.title}
                              </a>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-xs font-black text-slate-900">
                                  {formatCurrency(prod.price)}
                                </span>
                                <div className="flex items-center space-x-0.5 text-amber-400">
                                  <Star className="w-3 h-3 fill-amber-400" />
                                  <span className="text-[10px] font-bold text-slate-700">
                                    {prod.rating ? prod.rating.toFixed(1) : '4.8'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Add to Cart button */}
                            <button
                              onClick={() => handleAddToCart(prod)}
                              className={`p-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all ${
                                addedItems[prod.id]
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-900 hover:bg-sky-600 text-white shadow-sm'
                              }`}
                              title="Add to cart"
                            >
                              {addedItems[prod.id] ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <ShoppingBag className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestion Action Chips */}
                  {msg.actionPills && msg.actionPills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.actionPills.map((pill, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => handleSend(pill)}
                          className="bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200/80 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-xs transition-colors"
                        >
                          {pill}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing Loader */}
            {loading && (
              <div className="flex gap-3 items-center">
                <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-2.5 shadow-sm flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-600 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-sky-600 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-sky-600 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AI (e.g. drone under ₹50,000, track ORD-...)"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 disabled:opacity-50 text-white p-2.5 rounded-2xl shadow-md transition-all flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
