'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Truck, CheckCircle2, RotateCcw, AlertCircle, Clock } from 'lucide-react';
import { api } from '@/lib/api';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [returningItemId, setReturningItemId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState<string>('Item defective or different from description');

  const fetchOrders = () => {
    setLoading(true);
    api.getOrders()
      .then((res) => {
        if (res.success) {
          setOrders(res.data);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleRequestReturn = async (orderId: string, orderItemId: string) => {
    try {
      const res = await fetch(`${api.getProducts.name ? 'http://localhost:5000/api/v1' : '/api/v1'}/returns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('marketsphere_token')}`
        },
        body: JSON.stringify({
          orderId,
          orderItemId,
          reason: returnReason
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Return request filed successfully! Support will inspect and approve.');
        setReturningItemId(null);
        fetchOrders();
      } else {
        alert(`Error: ${data.error?.message || 'Could not file return'}`);
      }
    } catch (err: any) {
      alert(`Return request failed: ${err.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> PAID</span>;
      case 'RESERVED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> RESERVED</span>;
      case 'SHIPPED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> SHIPPED</span>;
      case 'DELIVERED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> DELIVERED</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> CANCELLED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto py-16 text-center text-slate-500">Loading your orders...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Orders & Fulfillment Tracking</h1>
          <p className="text-xs text-slate-500">View live shipment tracking, carrier dispatch updates, and request returns</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
          <p className="text-slate-600 font-medium">You haven&apos;t placed any orders yet.</p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Header */}
              <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-slate-400">Order Number</div>
                  <div className="text-sm font-bold font-mono text-slate-900">{order.order_number}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-400">Order Placed</div>
                  <div className="text-xs font-semibold text-slate-700">{new Date(order.created_at).toLocaleDateString()}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-400">Grand Total</div>
                  <div className="text-sm font-extrabold text-slate-900">${parseFloat(order.grand_total).toFixed(2)}</div>
                </div>
                <div>{getStatusBadge(order.status)}</div>
              </div>

              {/* Items */}
              <div className="p-5 divide-y divide-slate-100">
                {order.items?.map((item: any) => (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-slate-900">{item.product_name}</div>
                      <div className="text-xs text-slate-500">{item.variant_name} • SKU: {item.sku}</div>
                      <div className="text-xs font-semibold text-slate-700">
                        {item.quantity} x ${parseFloat(item.unit_price).toFixed(2)} = ${parseFloat(item.subtotal).toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {order.status === 'DELIVERED' || order.status === 'PAID' ? (
                        <button
                          onClick={() => setReturningItemId(item.id)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Return Item
                        </button>
                      ) : null}

                      {/* Return Modal prompt */}
                      {returningItemId === item.id && (
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
                            <h3 className="text-base font-bold text-slate-900">Request Item Return</h3>
                            <p className="text-xs text-slate-500">
                              State your reason for returning {item.product_name}. Refund will be issued upon warehouse inspection.
                            </p>
                            <textarea
                              value={returnReason}
                              onChange={(e) => setReturnReason(e.target.value)}
                              rows={3}
                              className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setReturningItemId(null)}
                                className="px-3 py-1.5 text-xs text-slate-600 font-semibold"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleRequestReturn(order.id, item.id)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                              >
                                Submit Request
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Carrier Tracking Code if available */}
              {order.shipment && (
                <div className="p-4 bg-indigo-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-900">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-indigo-600" />
                    <span>Carrier: <strong>{order.shipment.carrier}</strong></span>
                    <span>• Tracking: <strong className="font-mono">{order.shipment.tracking_number}</strong></span>
                  </div>
                  <span className="font-bold text-indigo-600 uppercase">{order.shipment.status}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
