'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trash2, ShoppingBag, ArrowRight, ShieldCheck, Tag } from 'lucide-react';
import { api } from '@/lib/api';

export default function CartPage() {
  const [cartData, setCartData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [promoCode, setPromoCode] = useState<string>('WELCOME10');
  const [discountInfo, setDiscountInfo] = useState<any>(null);
  const [couponError, setCouponError] = useState<string>('');

  const fetchCart = () => {
    setLoading(true);
    api.getCart()
      .then((res) => {
        if (res.success) {
          setCartData(res.data);
          if (res.data.subtotal > 0 && promoCode) {
            checkPromo(promoCode, res.data.subtotal);
          }
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const checkPromo = async (code: string, subtotal: number) => {
    setCouponError('');
    try {
      const res = await api.validateCoupon(code, subtotal);
      if (res.success) {
        setDiscountInfo(res.data);
      }
    } catch (err: any) {
      setDiscountInfo(null);
      setCouponError(err.message || 'Invalid promotion code');
    }
  };

  const handleUpdateQty = async (itemId: string, newQty: number) => {
    try {
      await api.updateCartItem(itemId, newQty);
      fetchCart();
    } catch (err: any) {
      alert(`Error updating quantity: ${err.message}`);
    }
  };

  const handleRemove = async (itemId: string) => {
    try {
      await fetch(`${api.getProducts.name ? 'http://localhost:5000/api/v1' : '/api/v1'}/cart/items/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('marketsphere_token')}` }
      });
      fetchCart();
    } catch (err: any) {
      alert(`Error removing item: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500">Loading your shopping cart...</div>;
  }

  const items = cartData?.items || [];
  const subtotal = cartData?.subtotal || 0;
  const discountTotal = discountInfo?.discountAmount || 0;
  const grandTotal = Math.max(0, subtotal - discountTotal);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Shopping Cart</h1>
          <p className="text-xs text-slate-500">{items.length} unique line item(s) in active session</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
          <p className="text-slate-600 font-medium">Your cart is currently empty.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-sm hover:bg-indigo-700 transition-colors"
          >
            Explore Verified Catalog <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items List */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item: any) => (
              <div
                key={item.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    SKU: {item.sku}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{item.productTitle}</h3>
                  <div className="text-xs text-slate-500">{item.variantTitle}</div>
                  <div className="text-xs font-semibold text-slate-800">${parseFloat(item.unitPrice).toFixed(2)} each</div>
                </div>

                <div className="flex items-center gap-6 self-end sm:self-auto">
                  {/* Quantity Stepper */}
                  <div className="flex items-center border border-slate-200 rounded-lg bg-white text-xs">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, item.quantity - 1)}
                      className="px-2.5 py-1 text-slate-600 hover:text-black font-bold"
                    >
                      -
                    </button>
                    <span className="px-3 font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
                      className="px-2.5 py-1 text-slate-600 hover:text-black font-bold"
                    >
                      +
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="text-right min-w-[70px]">
                    <div className="text-sm font-extrabold text-slate-900">${item.lineTotal.toFixed(2)}</div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary & Coupon */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900">Order Summary</h2>

              {/* Coupon Form */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> Promotion Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="e.g. WELCOME10"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => checkPromo(promoCode, subtotal)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                  >
                    Apply
                  </button>
                </div>
                {couponError && <p className="text-[11px] text-red-600 font-medium">{couponError}</p>}
                {discountInfo && (
                  <p className="text-[11px] text-emerald-600 font-semibold">
                    ✓ Applied: {discountInfo.code} (-${discountInfo.discountAmount.toFixed(2)})
                  </p>
                )}
              </div>

              {/* Math breakdown */}
              <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-800">${subtotal.toFixed(2)}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount</span>
                    <span>-${discountTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Estimated Shipping</span>
                  <span className="text-slate-400 italic">Calculated at checkout</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-100 pt-2">
                  <span>Total</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <Link
                href="/checkout"
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-colors block text-center"
              >
                Proceed to Secure Checkout <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Inventory is held under a 10-minute atomic lock upon checkout submission.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
