import React from 'react';
import Link from 'next/link';
import { Shield, Zap, RefreshCcw, Layers } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs py-12 border-t border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="text-white font-bold text-base mb-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            MarketSphere Commerce
          </div>
          <p className="leading-relaxed text-slate-400">
            Multi-vendor marketplace platform featuring real-time inventory ledger, atomic stock reservations, 
            FastAPI pricing engine, and payment webhook deduplication.
          </p>
        </div>

        <div>
          <h4 className="text-slate-200 font-semibold mb-3">Core Modules</h4>
          <ul className="space-y-1.5">
            <li><Link href="/" className="hover:text-white transition-colors">Catalog & SKUs</Link></li>
            <li><Link href="/seller" className="hover:text-white transition-colors">Seller Onboarding & KYC</Link></li>
            <li><Link href="/cart" className="hover:text-white transition-colors">Cart & Promotions</Link></li>
            <li><Link href="/orders" className="hover:text-white transition-colors">Order Tracking & Returns</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-slate-200 font-semibold mb-3">Architecture & Services</h4>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-indigo-400" /> Express REST API (:5000)</li>
            <li className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-400" /> Python FastAPI Engine (:8000)</li>
            <li className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-emerald-400" /> PostgreSQL & Redis Ledger</li>
            <li className="flex items-center gap-1.5"><RefreshCcw className="w-3.5 h-3.5 text-sky-400" /> Event-Driven Webhook Idempotency</li>
          </ul>
        </div>

        <div>
          <h4 className="text-slate-200 font-semibold mb-3">Compliance & Sandbox</h4>
          <p className="leading-relaxed text-slate-400">
            Educational evaluation standard for Orion LMS. Uses synthetic data, sandbox payment intents, and simulated carrier labels.
          </p>
          <div className="mt-3 text-[11px] text-slate-400 font-mono">
            API Health: <span className="text-emerald-400 font-semibold">200 OK</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
