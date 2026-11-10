'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCart } from '../../../context/CartContext';
import { useWishlist } from '../../../context/WishlistContext';
import ProductCard from '../../../components/ProductCard';
import { formatCurrency, FREE_SHIPPING_THRESHOLD } from '../../../lib/currency';
import {
  Star,
  Heart,
  ShoppingBag,
  Truck,
  ShieldCheck,
  RotateCcw,
  Plus,
  Minus,
  CheckCircle2,
  Share2,
  Zap,
  ArrowLeft,
  MessageSquare
} from 'lucide-react';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart, setIsCartOpen } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [related, setRelated] = useState([]);
  const [selectedImage, setSelectedImage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Review Form State
  const [reviewAuthor, setReviewAuthor] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  useEffect(() => {
    if (!params.id) return;

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/products/${params.id}`);
        const data = await res.json();

        if (data.success && data.product) {
          setProduct(data.product);
          setReviews(data.reviews || []);
          setRelated(data.related || []);
          setSelectedImage(data.product.image);
        } else {
          setError(data.error || 'Product not found');
        }
      } catch (err) {
        console.error('Error fetching product details', err);
        setError('Failed to connect to product service.');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [params.id]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewAuthor.trim() || !reviewComment.trim()) return;

    setSubmittingReview(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          author: reviewAuthor.trim(),
          rating: reviewRating,
          comment: reviewComment.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setReviewSuccess(true);
        setReviews([
          {
            id: Date.now(),
            author: reviewAuthor.trim(),
            rating: reviewRating,
            comment: reviewComment.trim(),
            date: 'Just now',
            verified: 1
          },
          ...reviews
        ]);
        setReviewAuthor('');
        setReviewComment('');
      }
    } catch (err) {
      console.error('Review submit error', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 animate-pulse space-y-8">
        <div className="h-6 bg-slate-200 rounded w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="aspect-square bg-slate-200 rounded-3xl" />
          <div className="space-y-4">
            <div className="h-8 bg-slate-200 rounded w-3/4" />
            <div className="h-6 bg-slate-200 rounded w-1/3" />
            <div className="h-24 bg-slate-200 rounded w-full" />
            <div className="h-12 bg-slate-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Product Not Found</h2>
        <p className="text-sm text-slate-500">{error || 'This product is no longer available in our collection.'}</p>
        <a
          href="/"
          className="inline-flex items-center space-x-2 bg-sky-600 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Catalog</span>
        </a>
      </div>
    );
  }

  const isFavorited = isInWishlist(product.id);
  const images = product.images && product.images.length > 0 ? product.images : [product.image];
  const discountPercent = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  const handleBuyNow = () => {
    addToCart(product, quantity);
    router.push('/checkout');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-xs text-slate-500">
        <a href="/" className="hover:text-slate-900 transition-colors">Catalog</a>
        <span>/</span>
        <a href={`/?category=${encodeURIComponent(product.category)}`} className="hover:text-slate-900 transition-colors">
          {product.category}
        </a>
        <span>/</span>
        <span className="text-slate-900 font-semibold truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Main Product Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Gallery Column */}
        <div className="lg:col-span-6 space-y-4">
          {/* Main Large Image */}
          <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-md">
            <img
              src={selectedImage || product.image}
              alt={product.title}
              className="w-full h-full object-cover object-center transition-all duration-300"
            />
            {product.badge && (
              <span className="absolute top-4 left-4 bg-slate-900 text-white text-xs uppercase font-bold tracking-wider px-3 py-1.5 rounded-full shadow">
                {product.badge}
              </span>
            )}
            <button
              onClick={() => toggleWishlist(product)}
              className={`absolute top-4 right-4 p-3 rounded-full transition-all shadow-md ${
                isFavorited ? 'bg-rose-50 text-rose-600' : 'bg-white/90 text-slate-500 hover:text-rose-600'
              }`}
              aria-label="Wishlist"
            >
              <Heart className={`w-5 h-5 ${isFavorited ? 'fill-rose-600' : ''}`} />
            </button>
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="flex items-center space-x-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                    selectedImage === img ? 'border-sky-600 scale-105 shadow-md' : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details & Actions */}
        <div className="lg:col-span-6 space-y-6">
          <div>
            <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">
              {product.brand || 'ApexStore'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 leading-tight">
              {product.title}
            </h1>

            {/* Rating & Reviews */}
            <div className="flex items-center space-x-3 mt-3">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      product.rating > 0 && i < Math.floor(product.rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-bold text-slate-800">
                {product.rating > 0 ? product.rating.toFixed(1) : 'No ratings yet'}
              </span>
              <span className="text-xs text-slate-400">|</span>
              <a href="#reviews" className="text-xs text-sky-600 hover:underline font-semibold">
                {reviews.length || product.reviews_count ? `${reviews.length || product.reviews_count} customer reviews` : 'No reviews yet'}
              </a>
            </div>
          </div>

          {/* Price & Savings */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="flex items-baseline space-x-3">
                <span className="text-3xl font-black text-slate-900">
                  {formatCurrency(product.price)}
                </span>
                {product.original_price && product.original_price > product.price && (
                  <span className="text-base text-slate-400 line-through">
                    {formatCurrency(product.original_price)}
                  </span>
                )}
                {discountPercent > 0 && (
                  <span className="bg-rose-100 text-rose-700 text-xs font-black px-2 py-0.5 rounded-full">
                    Save {discountPercent}%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                GST calculated at checkout. Free delivery on orders over {formatCurrency(FREE_SHIPPING_THRESHOLD)}.
              </p>
            </div>

            {/* Stock indicator */}
            <div className="text-right">
              {product.stock > 0 ? (
                <div className="flex flex-col items-end">
                  <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>In Stock ({product.stock} units)</span>
                  </span>
                  {product.stock <= 5 && (
                    <span className="text-[10px] text-amber-600 font-bold mt-1">
                      Hurry, low stock!
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                  Out of Stock
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Overview
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {product.description}
            </p>
          </div>

          {product.source && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              Product details, images and reviews are sourced from the catalog provider. Price and availability are confirmed again when you place your order.
            </p>
          )}

          {product.specifications && product.specifications.length > 0 && (
            <section className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Specifications and listing details</h3>
              <dl className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {product.specifications.map((spec, index) => (
                  <div key={`${spec.label}-${index}`} className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-[10rem_1fr]">
                    <dt className="font-semibold text-slate-600">{spec.label}</dt>
                    <dd className="text-slate-800">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {product.faqs && product.faqs.length > 0 && (
            <section className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Product FAQs</h3>
              <div className="space-y-2">
                {product.faqs.map((faq, index) => (
                  <details key={`${faq.question}-${index}`} className="group rounded-2xl border border-slate-200 bg-white p-4">
                    <summary className="cursor-pointer list-none pr-6 text-sm font-bold text-slate-900 marker:hidden">{faq.question}</summary>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Specifications / Features Bullet points */}
          {product.features && product.features.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Key Highlights
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                {product.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start space-x-2 bg-white p-2.5 rounded-xl border border-slate-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 flex-shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Purchase Actions */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex items-center space-x-4">
              {/* Quantity Stepper */}
              <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-4 py-1.5 text-sm font-bold text-slate-800 bg-white">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add to Cart */}
              <button
                onClick={() => {
                  addToCart(product, quantity);
                  setIsCartOpen(true);
                }}
                disabled={product.stock === 0}
                className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white py-3 px-6 rounded-xl font-bold text-sm shadow-md flex items-center justify-center space-x-2 transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add to Cart &bull; {formatCurrency(product.price * quantity)}</span>
              </button>
            </div>

            {/* Instant Buy Now Button */}
            <button
              onClick={handleBuyNow}
              disabled={product.stock === 0}
              className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 disabled:opacity-50 text-white py-3 px-6 rounded-xl font-bold text-sm shadow-lg shadow-sky-600/20 flex items-center justify-center space-x-2 transition-all"
            >
              <Zap className="w-4 h-4" />
              <span>Instant Buy Now</span>
            </button>
          </div>

          {/* Trust Guarantees */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-500">
            <div className="flex flex-col items-center space-y-1">
              <Truck className="w-4 h-4 text-slate-700" />
              <span>Free 2-3 Day Delivery</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <RotateCcw className="w-4 h-4 text-slate-700" />
              <span>30-Day Hassle-Free Returns</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              <span>Product details shown</span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reviews Section */}
      <section id="reviews" className="pt-12 border-t border-slate-200 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-sky-600" />
              <span>Verified Customer Reviews</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Real feedback from shoppers who purchased this item.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Write Review Form */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Write a Review
            </h3>

            {reviewSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs space-y-2 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="font-bold">Thank you for your feedback!</p>
                <p className="text-slate-600">Your review was saved to the SQLite database and updated the product score.</p>
                <button
                  onClick={() => setReviewSuccess(false)}
                  className="text-xs text-emerald-700 underline font-semibold mt-1"
                >
                  Write another review
                </button>
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    value={reviewAuthor}
                    onChange={(e) => setReviewAuthor(e.target.value)}
                    placeholder="e.g. Jonathan Vance"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Star Rating</label>
                  <div className="flex items-center space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="p-1 focus:outline-none"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= reviewRating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-slate-700 ml-2">{reviewRating} Stars</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Your Review</label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={4}
                    placeholder="Describe build quality, ergonomics, daily use, or customer satisfaction..."
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold transition-colors"
                >
                  {submittingReview ? 'Submitting to SQLite...' : 'Submit Verified Review'}
                </button>
              </form>
            )}
          </div>

          {/* Reviews List */}
          <div className="lg:col-span-7 space-y-4">
            {reviews.length === 0 ? (
              <div className="p-8 bg-slate-50 rounded-2xl text-center text-xs text-slate-500">
                Be the first to review this product!
              </div>
            ) : (
              reviews.map((r, i) => (
                <div key={r.id || i} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center">
                        {r.author ? r.author.charAt(0) : 'U'}
                      </span>
                      <strong className="text-xs font-bold text-slate-900">{r.author}</strong>
                      {r.verified && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                          Verified Buyer
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">{r.date || 'Recent'}</span>
                  </div>

                  <div className="flex text-amber-400">
                    {[...Array(5)].map((_, idx) => (
                      <Star
                        key={idx}
                        className={`w-3.5 h-3.5 ${
                          idx < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {r.comment}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="pt-12 border-t border-slate-200 space-y-6">
          <h2 className="text-xl font-black text-slate-900">
            You Might Also Like
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
