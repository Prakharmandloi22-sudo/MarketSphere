'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, Store, ShieldCheck, User, Truck, Box } from 'lucide-react';
import { api } from '@/lib/api';

export default function Navbar() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cartCount, setCartCount] = useState<number>(0);

  useEffect(() => {
    const token = localStorage.getItem('marketsphere_token');
    const storedUser = localStorage.getItem('marketsphere_user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch {}
    }

    if (token) {
      api.getCart().then(res => {
        if (res.success && res.data) {
          setCartCount(res.data.itemCount);
        }
      }).catch(() => {});
    }
  }, []);

  const handleRoleSwitch = async (email: string) => {
    try {
      const res = await api.login(email, 'Password123!');
      if (res.success) {
        localStorage.setItem('marketsphere_token', res.data.accessToken);
        localStorage.setItem('marketsphere_user', JSON.stringify(res.data.user));
        setCurrentUser(res.data.user);
        window.location.reload();
      }
    } catch (err: any) {
      alert(`Login failed: ${err.message}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('marketsphere_token');
    localStorage.removeItem('marketsphere_user');
    setCurrentUser(null);
    window.location.href = '/';
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
                <Box className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  MarketSphere
                </span>
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                  Multi-Vendor Platform
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-600">
              <Link href="/" className="hover:text-indigo-600 transition-colors">Storefront</Link>
              <Link href="/seller" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
                <Store className="w-4 h-4 text-indigo-500" /> Seller Portal
              </Link>
              <Link href="/admin" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Admin & Ops
              </Link>
            </nav>
          </div>

          {/* Quick Demo Role Switcher & User Actions */}
          <div className="flex items-center gap-3">
            {/* Quick Demo Persona Switcher */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600">
              <span className="px-2 text-slate-400">Switch Role:</span>
              <button
                onClick={() => handleRoleSwitch('customer1@marketsphere.local')}
                className={`px-2 py-1 rounded transition-colors ${currentUser?.role === 'customer' ? 'bg-white shadow-sm text-indigo-600 font-semibold' : 'hover:bg-slate-200'}`}
              >
                Customer
              </button>
              <button
                onClick={() => handleRoleSwitch('techseller@marketsphere.local')}
                className={`px-2 py-1 rounded transition-colors ${currentUser?.role === 'seller' ? 'bg-white shadow-sm text-indigo-600 font-semibold' : 'hover:bg-slate-200'}`}
              >
                Seller
              </button>
              <button
                onClick={() => handleRoleSwitch('warehouse@marketsphere.local')}
                className={`px-2 py-1 rounded transition-colors ${currentUser?.role === 'warehouse' ? 'bg-white shadow-sm text-indigo-600 font-semibold' : 'hover:bg-slate-200'}`}
              >
                Warehouse
              </button>
              <button
                onClick={() => handleRoleSwitch('admin@marketsphere.local')}
                className={`px-2 py-1 rounded transition-colors ${currentUser?.role === 'admin' ? 'bg-white shadow-sm text-indigo-600 font-semibold' : 'hover:bg-slate-200'}`}
              >
                Admin
              </button>
            </div>

            {/* User Profile / Logout */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800">{currentUser.fullName}</div>
                  <div className="text-[10px] uppercase font-bold text-indigo-600 tracking-wide">{currentUser.role}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleRoleSwitch('customer1@marketsphere.local')}
                className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1.5 rounded-lg shadow-sm"
              >
                <User className="w-3.5 h-3.5" /> Sign In
              </button>
            )}

            {/* Cart Button */}
            <Link
              href="/cart"
              className="relative p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
