'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CreditCard, CheckCircle2, ShieldCheck, Clock, Lock, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function CheckoutPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [carrier, setCarrier] = useState<string>('USPS Standard Ground');
  const [shippingRate, setShippingRate] = useState<number>(9.99);
  const [promoCode, setPromoCode] = useState<string>('WELCOME10');
  const [discountTotal, setDiscountTotal] = useState<number>(0);

  // Address
  const [address, setAddress] = useState({
    fullName: 'Alice Customer',
    street: '123 Market Street',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105'
  });

  // Result state
  const [orderConfirmed, setOrderConfirmed] = useState<any>(null);

  useEffect(() => {
    api.getCart().then(res => {
      if (res.success && res.data) {
        setItems(res.data.items);
        if (res.data.subtotal > 0) {
          api.validateCoupon('WELCOME10', res.data.subtotal)
            .then(cRes => {
              if (cRes.success) setDiscountTotal(cRes.data.discountAmount);
            })
            .catch(() => {});
        }
      }
    }).finally(() => setLoading(false));
  }, []);

  const subtotal = items.reduce((acc, i) => acc + i.lineTotal, 0);
  const taxable = Math.max(0, subtotal - discountTotal);
  const tax = parseFloat((taxable * 0.08).toFixed(2));
  const grandTotal = parseFloat((taxable + shippingRate + tax).toFixed(2));

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const orderPayload = {
        items: items.map(i => ({ sku: i.sku, quantity: i.quantity })),
        promoCode: discountTotal > 0 ? promoCode : undefined,
        shippingAddress: address,
        idempotencyKey: `idemp_${Date.now()}_${Math.random().toString(36).substring(7)}`
      };

      const res = await api.createOrder(orderPayload);
      if (res.success) {
        setOrderConfirmed(res.data);
      }
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!orderConfirmed) return;
    try {
      // Send mock Stripe webhook to simulate instantaneous sandbox capture
      const webhookPayload = {
        id: `evt_sim_${Date.now()}`,
        type: 'payment_intent.succeeded',
        data: {
          object: {
            orderId: orderConfirmed.order.id,
            amount: orderConfirmed.order.grand_total,
            paymentIntentId: `pi_sandbox_${Date.now()}`
          }
        }
      };

      const res = await fetch(`${api.getProducts.name ? 'http://localhost:5000/api/v1' : '/api/v1'}/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-event-id': webhookPayload.id
        },
        body: JSON.stringify(webhookPayload)
      });
      const data = await res.json();
      if (data.received) {
        alert('Sandbox Payment Capture Succeeded! Order is now PAID.');
        window.location.href = `/orders`;
      }
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto py-16 text-center text-slate-500">Preparing checkout session...</div>;
  }

  if (orderConfirmed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Order Placed & Stock Reserved!</h1>
        <p className="text-slate-600 text-sm">
          Order Number: <strong className="font-mono text-indigo-600">{orderConfirmed.order.order_number}</strong>
        </p>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-mono text-left space-y-1.5">
          <div>Status: <span className="text-amber-600 font-bold">{orderConfirmed.order.status}</span></div>
          <div>Reservation Token: <span className="text-slate-700">{orderConfirmed.reservationToken}</span></div>
          <div>Stock Lock Expiry: <span className="text-slate-700">{new Date(orderConfirmed.reservationExpiresAt).toLocaleTimeString()}</span></div>
          <div>Grand Total: <span className="font-bold text-slate-900">${orderConfirmed.order.grand_total.toFixed(2)}</span></div>
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={handleSimulatePayment}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
          >
            Simulate Instant Sandbox Payment Capture
          </button>
          <Link
            href="/orders"
            className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-colors"
          >
            View Orders Timeline
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Complete Your Purchase</h1>
        <p className="text-xs text-slate-500">Protected by atomic inventory reservation and sandbox payment simulation</p>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Shipping & Carrier */}
        <div className="lg:col-span-2 space-y-6">
          {/* Shipping Address */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
            <h2 className="text-sm font-bold text-slate-800">1. Shipping Address</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <input
                type="text"
                placeholder="Full Name"
                value={address.fullName}
                onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                className="p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <input
                type="text"
                placeholder="Street Address"
                value={address.street}
                onChange={(e) => setAddress({ ...address, street: e.target.value })}
                className="p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <input
                type="text"
                placeholder="City"
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                className="p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="State"
                  value={address.state}
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                  className="p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <input
                  type="text"
                  placeholder="ZIP Code"
                  value={address.zip}
                  onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                  className="p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Shipping Carrier Option */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
            <h2 className="text-sm font-bold text-slate-800">2. Select Shipping Method</h2>
            <div className="space-y-2 text-xs">
              {[
                { name: 'USPS Standard Ground (3-5 days)', cost: 9.99 },
                { name: 'FedEx Express 2-Day', cost: 19.99 },
                { name: 'UPS Overnight Priority', cost: 34.99 },
              ].map((c) => (
                <label
                  key={c.name}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    carrier === c.name ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="carrier"
                      checked={carrier === c.name}
                      onChange={() => { setCarrier(c.name); setShippingRate(c.cost); }}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-800">{c.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">${c.cost.toFixed(2)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sandbox Payment Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-indigo-600" /> 3. Payment Method (Sandbox Simulation)
            </h2>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Card Number (Sandbox Testing)</span>
                <span className="font-mono">4242 •••• •••• 4242</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Expires / CVC</span>
                <span className="font-mono">12/28 • 123</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Summary & Order Confirmation */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800">Items ({items.length})</h2>
            <div className="max-h-48 overflow-y-auto space-y-2 text-xs border-b border-slate-100 pb-3">
              {items.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center text-slate-600">
                  <span className="truncate max-w-[160px]">{item.quantity}x {item.productTitle}</span>
                  <span className="font-semibold text-slate-900">${item.lineTotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount (WELCOME10)</span>
                  <span>-${discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>${shippingRate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Tax (8%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-100 pt-2">
                <span>Grand Total</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              {submitting ? 'Reserving Stock...' : `Authorize & Reserve ($${grandTotal.toFixed(2)})`}
            </button>
          </div>

          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-xs text-indigo-700 space-y-1">
            <div className="font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 10-Minute Lock Guaranteed
            </div>
            <p className="leading-relaxed">
              Upon submission, stock is reserved using row-level locking. If payment is not completed within 10 minutes, the background sweep releases stock automatically.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
