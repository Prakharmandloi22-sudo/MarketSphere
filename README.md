# MarketSphere • Multi-Vendor Commerce, Inventory & Order Platform

[![CI/CD Pipeline](https://github.com/marketsphere/marketsphere/actions/workflows/ci.yml/badge.svg)](https://github.com/marketsphere/marketsphere/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Containerized-Docker%20Compose-2496ED.svg)](https://www.docker.com/)

> **Assessment Level**: Advanced / Very Difficult  
> **Mandatory Exercises**: 15 Hands-on Assessments (Completed & Verified)  
> **Prepared for**: Orion LMS Technical Skills Evaluation Cohort

---

## 1. System Architecture & Component Diagram

MarketSphere adopts a decoupled, event-driven modular service architecture:
- **Frontend Layer**: Next.js App Router (TypeScript, Tailwind CSS, TanStack Query), providing responsive, accessible experiences for Customers, Sellers, Warehouse Staff, and Administrators.
- **Commerce Core API**: Node.js & Express.js REST API with JWT auth, role-based tenant isolation, atomic transaction boundaries, and immutable stock ledger.
- **Domain Processing Microservice**: Python 3 & FastAPI engine for bulk catalog normalization, tiered pricing rules, commission calculations, and explainable collaborative-filtering recommendations.
- **Persistence & Caching**: PostgreSQL 16 (System of Record with DDL constraints and row-level locks) and Redis 7 (sliding window rate-limiting and job queue).

```
 +---------------------------------------------------------------------------------------+
 |                                  CLIENT APPLICATIONS                                  |
 |   Customer Storefront  |   Seller Portal   |   Warehouse Hub   |   Admin & Ops Hub   |
 |                              (Next.js App Router :3000)                               |
 +-------------------------------------------+-------------------------------------------+
                                             | Reverse Proxy (Nginx :443)
                      +----------------------+----------------------+
                      |                                             |
                      v                                             v
        +----------------------------+                +----------------------------+
        |   Node.js Express API      |                |   FastAPI Analytics Engine |
        |   Port: 5000               |  Internal HTTP |   Port: 8000               |
        | - Auth & RBAC (JWT)        |<-------------->| - Dynamic Promotion Rules  |
        | - Inventory Reservation    |                | - Category Commissions     |
        | - Orders & Cart Lifecycle  |                | - Bulk Feed Normalization  |
        | - Stripe & Carrier Sandbox |                | - Cold-Start Recommender   |
        +-------------+--------------+                +----------------------------+
                      |
       +--------------+--------------+
       |                             |
       v                             v
+---------------+             +---------------+
| PostgreSQL 16 |             |    Redis 7    |
| System Record |             | Cache & Queue |
+---------------+             +---------------+
```

---

## 2. Database Entity Relationship (ER) Diagram

```
[users] 1 ----- 1 [sellers] 1 ----- N [products] 1 ----- N [product_variants]
   |                  |                                          |
   | 1                | 1                                        | 1
   |                  |                                          |
   N                  N                                          N
[orders] 1 ---- N [order_items]                             [inventory_levels]
   |                  |                                          |
   | 1                | 1                                        | 1
   |                  |                                          |
   N                  N                                          N
[payments]         [returns]                                [inventory_ledger]
                                                                 ^
                                                                 |
                                                    [stock_reservations]
```

---

## 3. Mandatory 15 Hands-on Assessments Matrix

| Assessment ID & Title | Technology & Module | Implementation Status | Automated Verification Evidence |
|:---|:---|:---:|:---|
| **01. Marketplace Storefront & Seller UI** | Next.js, Tailwind CSS, App Router | **COMPLETE** | Compiled 9 static/dynamic routes (`npm run build`) |
| **02. Commerce Backend APIs** | Node.js, Express, REST Router | **COMPLETE** | `backend/tests/catalog.test.js`, `checkout.test.js` |
| **03. Commerce Database Model** | PostgreSQL DDL, Schemas, Migrations | **COMPLETE** | `backend/src/database/schema.sql`, `migrate.js` |
| **04. Marketplace Security** | JWT, RBAC, Rate Limiter, Helmet | **COMPLETE** | `backend/tests/auth.test.js` (Role isolation 403 test) |
| **05. Python Pricing & Feed Engine** | Python 3, FastAPI, Pydantic | **COMPLETE** | `python-service/tests/test_pricing_engine.py`, `test_benchmark.py` |
| **06. FastAPI Recommendation Service** | Item-item CF & Explainable Cold-Start | **COMPLETE** | `python-service/tests/test_recommendation_service.py` |
| **07. Inventory Reservation Engine** | Mutex lock, CAS & Row-level locks | **COMPLETE** | `backend/tests/concurrency-capstone.test.js` |
| **08. Third-Party Integrations** | Stripe HMAC signature & Carrier Sandbox | **COMPLETE** | `backend/tests/webhook-idempotency.test.js` |
| **09. Docker Marketplace Environment** | Dockerfile, Compose, Healthchecks | **COMPLETE** | `docker-compose.yml`, multi-stage Dockerfiles |
| **10. Git Collaboration & Reviews** | Branches, PR Template, CODEOWNERS | **COMPLETE** | `.github/pull_request_template.md`, `CODEOWNERS` |
| **11. Marketplace CI/CD** | GitHub Actions Pipeline | **COMPLETE** | `.github/workflows/ci.yml` |
| **12. Commerce Test Suite** | Node.js Test Runner, Supertest | **COMPLETE** | 24 automated backend unit/integration tests |
| **13. API Documentation** | OpenAPI 3.0 & Postman Collection | **COMPLETE** | `docs/openapi.json`, `docs/MarketSphere.postman_collection.json` |
| **14. Marketplace Deployment** | Nginx, SSL/TLS, Backups, Metrics | **COMPLETE** | `deploy/nginx/default.conf`, `deploy/backup-restore.sh` |
| **15. Incident Simulation & RCA** | Root Cause Analysis & Runbooks | **COMPLETE** | `docs/INCIDENT_RCA.md`, `tests/incident-simulation.test.js` |

---

## 4. Domain-Specific Capstone Challenge Resolution

### Challenge Requirement:
> *Two customers attempt to buy the last item simultaneously. Only one may reserve it. Duplicate payment events must not create duplicate orders or refunds.*

### Concurrency Solution:
1. **Row-Level Mutex Locking**: During checkout creation, `InventoryService.reserveStock()` locks the requested SKU key.
2. **Conditional Check & Decrement**: Checks `available_stock >= requested_qty`. If sufficient, atomically decrements available stock, increments reserved stock, records an immutable audit ledger entry (`RESERVATION_CREATED`), and issues a time-bound reservation token (expires in 10 minutes).
3. **Graceful Conflict Handling**: When the second customer attempts to reserve the same unit concurrently, the lock releases after the winner's decrement. The second customer detects `available_stock = 0` and is immediately returned a safe `409 Conflict` with `OUT_OF_STOCK` error code.
4. **Verified Evidence**: Passed in `backend/tests/concurrency-capstone.test.js` and `tests/incident-simulation.test.js`.

### Idempotency & Duplicate Webhook Solution:
1. **Event Deduplication Store**: Incoming Stripe payment webhooks require a unique `webhook_event_id` or `idempotency_key`.
2. **Deterministic Response**: If a webhook event with the same ID arrives twice (e.g., due to network replay or gateway retry), the receiver queries existing records, logs the duplication, and immediately returns `200 OK` with `deduplicated: true`. No second order or refund is ever processed.
3. **Verified Evidence**: Passed in `backend/tests/webhook-idempotency.test.js` and `tests/incident-simulation.test.js`.

---

## 5. Quick Start & Local Run Guide

### Prerequisites
- Node.js v20+ and npm
- Python 3.11+
- Git

### 1. Clone & Configure Environment
```bash
git clone https://github.com/marketsphere/marketsphere.git
cd MarketSphere
cp .env.example .env
```

### 2. Run Database Migration & Seeds
```bash
node backend/src/database/migrate.js
node backend/src/database/seed.js
```
*Seeds 7 demo users, 2 fulfillment warehouses, 3 products, and active coupons.*

### 3. Run Automated Tests
```bash
# 1. Backend Commerce API Tests (24 tests)
node --test backend/tests/*.test.js

# 2. Python Pricing & Recommendation Tests (10 tests + benchmark)
$env:PYTHONPATH="python-service"
python -m pytest python-service/tests -v

# 3. Incident Simulation & RCA Drill (All 6 scenarios)
node tests/incident-simulation.test.js
```

### 4. Start Services Locally
```bash
# Terminal 1: Core Commerce Backend (:5000)
npm --prefix backend start

# Terminal 2: Python Pricing & Recommendation Engine (:8000)
cd python-service && python -m uvicorn app.main:app --port 8000

# Terminal 3: Storefront & Admin Frontend (:3000)
npm --prefix frontend run dev
```

### 5. Run with Docker Compose
```bash
docker compose up --build
```

---

## 6. Seed Credentials for Live Technical Review

| Persona / Role | Email | Password | Allowed Capabilities |
|:---|:---|:---|:---|
| **Platform Administrator** | `admin@marketsphere.local` | `Password123!` | Seller KYC approvals, commission rates, incident simulation |
| **Seller 1 (Electronics)** | `techseller@marketsphere.local` | `Password123!` | Add products, SKU variants, view stock, fulfill orders |
| **Seller 2 (Apparel)** | `apparel@marketsphere.local` | `Password123!` | Urban Threads catalog, stock levels, settlements |
| **Customer 1** | `customer1@marketsphere.local` | `Password123!` | Storefront browsing, cart, checkout, returns |
| **Customer 2** | `customer2@marketsphere.local` | `Password123!` | Storefront browsing, cart, concurrent checkout |
| **Warehouse Operator** | `warehouse@marketsphere.local` | `Password123!` | Inventory ledger adjustments, carrier label dispatch |
| **Support Agent** | `support@marketsphere.local` | `Password123!` | Customer order inspection, returns dispute approval |
