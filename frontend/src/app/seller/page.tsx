'use client';

import React, { useState, useEffect } from 'react';
import { Store, Plus, Package, DollarSign, Layers, Truck, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function SellerPortalPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // New Product Modal Form
  const [showNewProduct, setShowNewProduct] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newSku, setNewSku] = useState<string>('');
  const [newPrice, setNewPrice] = useState<string>('');
  const [newStock, setNewStock] = useState<string>('20');
  const [newDesc, setNewDesc] = useState<string>('');

  const fetchSellerData = async () => {
    setLoading(true);
    try {
      const [invRes, ordRes, setRes] = await Promise.all([
        api.getInventory(),
        api.getOrders(),
        api.getSettlements()
      ]);
      if (invRes.success) setInventory(invRes.data);
      if (ordRes.success) setOrders(ordRes.data);
      if (setRes.success) setSettlements(setRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerData();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${api.getProducts.name ? 'http://localhost:5000/api/v1' : '/api/v1'}/catalog/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('marketsphere_token')}`
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          basePrice: parseFloat(newPrice),
          variants: [
            {
              sku: newSku,
              title: `${newTitle} - Standard`,
              price: parseFloat(newPrice),
              initialStock: parseInt(newStock)
            }
          ]
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Product created and catalog updated!');
        setShowNewProduct(false);
        fetchSellerData();
      } else {
        alert(data.error?.message || 'Failed to create product');
      }
    } catch (err: any) {
      alert(`Error creating product: ${err.message}`);
    }
  };

  const handleFulfillOrder = async (orderId: string) => {
    try {
      const res = await fetch(`${api.getProducts.name ? 'http://localhost:5000/api/v1' : '/api/v1'}/shipping/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('marketsphere_token')}`
        },
        body: JSON.stringify({ orderId, carrier: 'FedEx Express Ground' })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Dispatched order! Tracking #: ${data.data.tracking_number}`);
        fetchSellerData();
      } else {
        alert(data.error?.message || 'Dispatch failed');
      }
    } catch (err: any) {
      alert(`Error fulfilling order: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto py-16 text-center text-slate-500">Loading Seller Dashboard...</div>;
  }

  const grossSales = settlements.reduce((acc, s) => acc + parseFloat(s.gross_sales), 0);
  const netPayout = settlements.reduce((acc, s) => acc + parseFloat(s.net_payout), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Seller Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Seller Merchant Operations</h1>
            <p className="text-xs text-slate-500">Manage catalog variants, warehouse stock, orders, and settlement ledgers</p>
          </div>
        </div>

        <button
          onClick={() => setShowNewProduct(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Product & SKU
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-500" /> Active SKUs
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{inventory.length}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-4 h-4 text-emerald-500" /> Total Available Stock
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {inventory.reduce((acc, i) => acc + i.available_stock, 0)} units
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-amber-500" /> Gross Sales
          </div>
          <div className="text-2xl font-extrabold text-slate-900">${grossSales.toFixed(2)}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-blue-500" /> Net Payout Due
          </div>
          <div className="text-2xl font-extrabold text-indigo-600">${netPayout.toFixed(2)}</div>
        </div>
      </div>

      {/* Real-time Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Warehouse Inventory Levels</h2>
          <span className="text-xs text-slate-400">Optimistic locking &amp; version tracking enabled</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="p-4">SKU Code</th>
                <th className="p-4">Warehouse Location</th>
                <th className="p-4">Available Stock</th>
                <th className="p-4">Reserved (Held)</th>
                <th className="p-4">Version</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {inventory.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-bold font-mono text-indigo-600">{inv.sku}</td>
                  <td className="p-4">{inv.warehouseName}</td>
                  <td className="p-4 font-bold text-slate-900">{inv.available_stock}</td>
                  <td className="p-4 text-amber-600 font-bold">{inv.reserved_stock}</td>
                  <td className="p-4 font-mono text-slate-400">v{inv.version}</td>
                  <td className="p-4">
                    {inv.available_stock > 3 ? (
                      <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">Healthy</span>
                    ) : inv.available_stock > 0 ? (
                      <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-bold">Low Stock</span>
                    ) : (
                      <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded font-bold">Out of Stock</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orders To Fulfill */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Orders Awaiting Fulfillment ({orders.length})</h2>
        </div>
        <div className="p-5 space-y-4">
          {orders.map((ord) => (
            <div key={ord.id} className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono font-bold text-slate-900">{ord.order_number}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Items: {ord.items?.map((i: any) => `${i.quantity}x ${i.product_name}`).join(', ')}
                </div>
                <div className="text-xs text-indigo-600 font-bold mt-1">Status: {ord.status}</div>
              </div>

              {ord.status === 'PAID' && (
                <button
                  onClick={() => handleFulfillOrder(ord.id)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <Truck className="w-3.5 h-3.5" /> Dispatch Carrier Label
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add Product Modal */}
      {showNewProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateProduct} className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Create New Catalog Product & SKU</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Product Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Apex 4K Ultra Webcam"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">SKU</label>
                  <input
                    type="text"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                    placeholder="WEBCAM-4K-01"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="129.99"
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Stock</label>
                  <input
                    type="number"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Features, specifications, warranty..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewProduct(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Publish to Catalog
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
