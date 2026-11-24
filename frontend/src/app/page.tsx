'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, Star, Sparkles, CheckCircle2, AlertCircle, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';

export default function StorefrontPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recStrategy, setRecStrategy] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);
  const [sortOption, setSortOption] = useState<string>('newest');

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await api.getProducts({
        q: searchQuery,
        category: selectedCategory,
        inStock: onlyInStock,
        sort: sortOption
      });
      if (res.success) {
        setProducts(res.data);
      }
    } catch (err) {
      console.error('Error fetching catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch of categories and products
    api.getCategories().then(res => {
      if (res.success) setCategories(res.data);
    }).catch(() => {});

    // Initial fetch of machine learning / cold-start recommendations
    api.getRecommendations().then(res => {
      if (res.recommendations) {
        setRecommendations(res.recommendations);
        setRecStrategy(res.strategy_used);
      }
    }).catch(() => {});

    fetchCatalog();
  }, [selectedCategory, onlyInStock, sortOption]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCatalog();
  };

  const handleQuickAddToCart = async (sku: string) => {
    try {
      await api.addToCart(sku, 1);
      alert(`Added SKU ${sku} to cart!`);
      window.location.reload();
    } catch (err: any) {
      alert(`Error adding to cart: ${err.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-8 md:p-12 overflow-hidden shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-semibold mb-4 backdrop-blur">
            <Sparkles className="w-3.5 h-3.5" /> High-Performance Multi-Vendor Engine
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
            Discover Verified Products from Independent Sellers
          </h1>
          <p className="text-indigo-100 text-sm md:text-base leading-relaxed mb-6">
            Multi-vendor catalog with atomic inventory reservations, verified reviews, 
            instant checkout sandbox, and explainable recommendations.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Real-Time Concurrency Protection
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Idempotent Payment Webhooks
            </div>
          </div>
        </div>
      </div>

      {/* Search and Multi-Facet Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, models, features..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </form>

        {/* Facet Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>{cat.name}</option>
            ))}
          </select>

          {/* In Stock Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={onlyInStock}
              onChange={(e) => setOnlyInStock(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            In Stock Only
          </label>

          {/* Sort Selector */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>
      </div>

      {/* Product Catalog Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Available Products ({products.length})</h2>
          <span className="text-xs text-slate-500 font-medium">Live inventory tracking enabled</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading marketplace catalog...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-slate-600 font-medium">No products match your active filters.</p>
            <button
              onClick={() => { setSelectedCategory(''); setSearchQuery(''); setOnlyInStock(false); }}
              className="mt-3 text-xs text-indigo-600 font-semibold hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              const primaryVariant = product.variants?.[0];
              const inStock = product.totalAvailableStock > 0;
              const isLowStock = product.totalAvailableStock > 0 && product.totalAvailableStock <= 3;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="p-6">
                    {/* Badges */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                        {product.sellerName}
                      </span>
                      <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{product.rating}</span>
                        <span className="text-slate-400 font-normal">({product.reviewCount})</span>
                      </div>
                    </div>

                    {/* Title */}
                    <Link href={`/product/${product.id}`} className="group">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                        {product.title}
                      </h3>
                    </Link>

                    {/* Description */}
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    {/* Stock Status Indicator */}
                    <div className="mt-4">
                      {isLowStock ? (
                        <div className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                          <AlertCircle className="w-3.5 h-3.5" /> Only {product.totalAvailableStock} left in stock!
                        </div>
                      ) : inStock ? (
                        <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5" /> In Stock ({product.totalAvailableStock} units available)
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                          <AlertCircle className="w-3.5 h-3.5" /> Out of stock
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing and Action Footer */}
                  <div className="p-6 pt-0 border-t border-slate-100 flex items-center justify-between mt-4">
                    <div>
                      <div className="text-xs text-slate-400">Starting from</div>
                      <div className="text-lg font-extrabold text-slate-900">
                        ${parseFloat(product.base_price).toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/product/${product.id}`}
                        className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        Details
                      </Link>
                      {primaryVariant && inStock && (
                        <button
                          onClick={() => handleQuickAddToCart(primaryVariant.sku)}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" /> Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assessment 06: Python Machine Learning Recommendation Rail */}
      {recommendations.length > 0 && (
        <div className="bg-slate-100/80 rounded-3xl p-6 md:p-8 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
                <Sparkles className="w-4 h-4" /> AI Discovery Engine (FastAPI)
              </div>
              <h2 className="text-xl font-bold text-slate-900">Recommended for You</h2>
            </div>
            <div className="text-xs font-mono bg-white px-3 py-1 rounded-lg border border-slate-200 text-slate-500 self-start sm:self-auto">
              Strategy: <span className="font-semibold text-slate-800">{recStrategy}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{rec.category}</div>
                  <h4 className="text-sm font-bold text-slate-800 line-clamp-1">{rec.title}</h4>
                  <p className="text-xs text-indigo-700 bg-indigo-50 p-2 rounded-lg mt-2 leading-relaxed font-medium">
                    &ldquo;{rec.reason}&rdquo;
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-500">Affinity Score: <strong className="text-slate-800">{rec.score}</strong></span>
                  <button
                    onClick={() => handleQuickAddToCart(rec.sku)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    + Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
