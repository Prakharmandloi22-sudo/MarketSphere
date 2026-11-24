'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Star, ShieldCheck, CheckCircle2, AlertCircle, ShoppingCart, Truck, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

export default function ProductDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [product, setProduct] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [relatedRecs, setRelatedRecs] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getProduct(id)
      .then((res) => {
        if (res.success && res.data) {
          setProduct(res.data);
          if (res.data.variants && res.data.variants.length > 0) {
            setSelectedVariant(res.data.variants[0]);
            // Fetch Python Recommendation Service with current SKU
            api.getRecommendations(res.data.variants[0].sku, res.data.category_id)
              .then(recRes => setRelatedRecs(recRes.recommendations || []))
              .catch(() => {});
          }
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    try {
      await api.addToCart(selectedVariant.sku, quantity);
      alert(`Added ${quantity}x ${selectedVariant.title} to cart!`);
      window.location.href = '/cart';
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${api.getProducts.name ? 'http://localhost:5000/api/v1' : '/api/v1'}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('marketsphere_token')}`
        },
        body: JSON.stringify({
          productId: product.id,
          rating: reviewRating,
          comment: reviewComment
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Review submitted successfully!');
        window.location.reload();
      } else {
        alert(data.error?.message || 'Review failed');
      }
    } catch (err: any) {
      alert(`Error submitting review: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500">Loading product information...</div>;
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-slate-800">Product Not Found</h2>
        <Link href="/" className="mt-4 inline-block text-indigo-600 font-semibold hover:underline">
          Return to Marketplace Catalog
        </Link>
      </div>
    );
  }

  const availableStock = selectedVariant?.availableStock || 0;
  const isOutOfStock = availableStock <= 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Breadcrumb */}
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-600">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Catalog
        </Link>
      </div>

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left: Product Visuals */}
        <div className="space-y-4">
          <div className="aspect-square rounded-3xl bg-gradient-to-tr from-slate-200 via-indigo-50 to-slate-100 flex items-center justify-center p-8 border border-slate-200">
            <div className="text-center">
              <span className="text-6xl font-black text-indigo-900/10">MARKETSPHERE</span>
              <p className="text-sm font-semibold text-indigo-600 mt-2">{product.title}</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1"><Truck className="w-4 h-4 text-indigo-600" /> Fast Standard & Overnight Carrier</span>
            <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-emerald-600" /> 30-Day Return Guarantee</span>
          </div>
        </div>

        {/* Right: Product Details & Variant Purchasing */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                Seller: {product.seller?.store_name || 'Verified Partner'}
              </span>
              <div className="flex items-center gap-1 text-amber-500 text-sm font-bold">
                <Star className="w-4 h-4 fill-current" />
                <span>{product.avgRating}</span>
                <span className="text-slate-400 font-normal">({product.reviews?.length || 0} reviews)</span>
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">{product.title}</h1>
            <p className="text-slate-600 text-sm mt-3 leading-relaxed">{product.description}</p>
          </div>

          {/* Pricing */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-slate-900">
              ${parseFloat(selectedVariant?.price || product.base_price).toFixed(2)}
            </span>
            {selectedVariant?.compare_at_price && (
              <span className="text-sm text-slate-400 line-through">
                ${parseFloat(selectedVariant.compare_at_price).toFixed(2)}
              </span>
            )}
          </div>

          {/* Variant Selector */}
          {product.variants && product.variants.length > 0 && (
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Select Variant / SKU
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {product.variants.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`text-left p-3 rounded-xl border text-xs transition-all ${
                      selectedVariant?.id === v.id
                        ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-slate-900">{v.title}</div>
                    <div className="text-slate-500 font-mono text-[11px] mt-0.5">SKU: {v.sku}</div>
                    <div className="text-indigo-600 font-semibold mt-1">${parseFloat(v.price).toFixed(2)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Real-time Inventory Meter */}
          <div>
            {isOutOfStock ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                <AlertCircle className="w-4 h-4" /> Currently Out of Stock.
              </div>
            ) : availableStock <= 3 ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Hurry! Only {availableStock} unit(s) left in warehouse stock.
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                In Stock ({availableStock} units available for instant reservation)
              </div>
            )}
          </div>

          {/* Quantity and Add to Cart Action */}
          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center border border-slate-200 rounded-xl bg-white">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-2 text-slate-600 hover:text-black font-bold"
                disabled={isOutOfStock}
              >
                -
              </button>
              <span className="px-3 text-sm font-semibold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                className="px-3 py-2 text-slate-600 hover:text-black font-bold"
                disabled={isOutOfStock || quantity >= availableStock}
              >
                +
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-colors ${
                isOutOfStock
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              {isOutOfStock ? 'Sold Out' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>

      {/* Assessment 06: Machine Learning Frequently Bought Together */}
      {relatedRecs.length > 0 && (
        <div className="border-t border-slate-200 pt-8">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Frequently Bought Together & Recommended</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedRecs.map((rec, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-600">{rec.category}</span>
                  <div className="text-sm font-bold text-slate-900 mt-1">{rec.title}</div>
                  <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded">{rec.reason}</p>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400">SKU: {rec.sku}</span>
                  <button
                    onClick={() => {
                      api.addToCart(rec.sku, 1).then(() => {
                        alert(`Added ${rec.sku} to cart!`);
                        window.location.href = '/cart';
                      });
                    }}
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    + Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verified Reviews Section */}
      <div className="border-t border-slate-200 pt-8 space-y-6">
        <h3 className="text-xl font-bold text-slate-900">Verified Customer Reviews ({product.reviews?.length || 0})</h3>

        {/* Submit Review Form */}
        <form onSubmit={handleReviewSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
          <h4 className="text-sm font-bold text-slate-800">Write a Customer Review</h4>
          <div className="flex items-center gap-4">
            <label className="text-xs font-semibold text-slate-600">Rating:</label>
            <select
              value={reviewRating}
              onChange={(e) => setReviewRating(parseInt(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
            >
              <option value={5}>5 Stars - Outstanding</option>
              <option value={4}>4 Stars - Very Good</option>
              <option value={3}>3 Stars - Average</option>
              <option value={2}>2 Stars - Poor</option>
              <option value={1}>1 Star - Unacceptable</option>
            </select>
          </div>
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Share your verified experience with this product..."
            className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors"
          >
            Submit Review
          </button>
        </form>

        {/* Existing Reviews List */}
        <div className="space-y-3">
          {product.reviews && product.reviews.length > 0 ? (
            product.reviews.map((r: any) => (
              <div key={r.id} className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-amber-500">
                    {[...Array(r.rating)].map((_, idx) => (
                      <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  {r.is_verified_purchase && (
                    <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Verified Purchase
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700 mt-2 leading-relaxed">{r.comment}</p>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 italic">No reviews yet. Be the first verified customer to leave feedback.</p>
          )}
        </div>
      </div>
    </div>
  );
}
