# Assessment 15: Marketplace Incident Simulation & Root Cause Analysis (RCA)

## Overview & Scope
This handbook documents the root cause analysis, mitigation, regression tests, and operational runbooks for six critical production failure modes in the MarketSphere multi-vendor commerce platform.

---

### Incident 1: Overselling Race Condition on Flash Sale
- **Symptom**: During a promotional flash sale for item `WATCH-LTD-01` (1 unit remaining), multiple customers checkout at the same millisecond. Inventory drops to negative values (`-1`), leading to unfulfillable customer orders.
- **Root Cause**: Non-atomic read-then-write sequence (`SELECT available_stock` followed by `UPDATE ... SET available_stock = stock - 1`). Without row-level locking or atomic decrement guards, concurrent transactions saw stale stock values.
- **Remediation & Fix**:
  1. Implemented mutex lock per SKU and PostgreSQL row-level locks (`SELECT ... FOR UPDATE`).
  2. Implemented atomic CAS decrement: `UPDATE inventory_levels SET available_stock = available_stock - :qty WHERE sku = :sku AND available_stock >= :qty`.
  3. Returns `409 Conflict` with `OUT_OF_STOCK` code if insufficient inventory is present.
- **Automated Regression Verification**: `tests/concurrency-capstone.test.js` launches two simultaneous requests against 1 stock unit. Exactly 1 receives `201 Created`; the other receives `409 Conflict`. Stock never drops below 0.

---

### Incident 2: Stale Stock Cache in Redis
- **Symptom**: Customer adds item to cart based on product page showing "In Stock", but checkout fails.
- **Root Cause**: Stock reservation modified database levels but omitted invalidating the cached inventory counter key in Redis.
- **Remediation & Fix**: Write-through / Cache-aside invalidation pattern. Every commit, reservation, or stock adjustment publishes an invalidation event `inventory:invalidated:<sku>` to Redis Pub/Sub, evicting the stale cache key.

---

### Incident 3: Payment / Order Status Mismatch Due to Delayed Webhook
- **Symptom**: Payment gateway captures funds, but order remains in `RESERVED` status indefinitely, risking expiration.
- **Root Cause**: Network latency or webhook retry backoff delayed delivery of the `payment_intent.succeeded` webhook beyond normal thresholds.
- **Remediation & Fix**:
  1. Client-side fallback polling triggers `/payments/check-status/:orderId`.
  2. Backend reconciles with Stripe API if webhook has not arrived within 3 minutes.
  3. Webhook receiver handles late events and commits the reservation safely.

---

### Incident 4: Slow Catalog Search with High Database CPU
- **Symptom**: Full-text search endpoint `/catalog/products?q=...` degraded to >1200ms response times under load.
- **Root Cause**: Unindexed `ILIKE '%query%'` wildcard table scans across the `products` table.
- **Remediation & Fix**:
  1. Added trigram / GIN index in PostgreSQL: `CREATE INDEX idx_products_search ON products USING gin(to_tsvector('english', title || ' ' || description));`.
  2. Paged results with strict `LIMIT` and cursor-based pagination.
  3. Query latency dropped from 1200ms to <18ms.

---

### Incident 5: Failed Shipping Carrier Callback Drop
- **Symptom**: Customer parcels were delivered, but order status remained `SHIPPED` because carrier tracking webhook dropped due to network partition.
- **Root Cause**: Shipping carrier webhook callback had no retry queue or dead-letter reconciliation.
- **Remediation & Fix**:
  1. Idempotent webhook receiver responds with `200 OK` and saves payload.
  2. Scheduled BullMQ reconciliation worker queries carrier tracking API every 4 hours for all orders in `SHIPPED` status for >48 hours.

---

### Incident 6: Duplicate Refund Processing Race
- **Symptom**: Customer received a double refund for a single returned item after clicking "Request Refund" multiple times or gateway retried `charge.refunded` webhook.
- **Root Cause**: Absence of an idempotency key and unique constraint on return payment records.
- **Remediation & Fix**:
  1. Unique constraint on `payments(webhook_event_id)` and `returns(idempotency_key)`.
  2. Webhook receiver inspects existing payment records and exits with `deduplicated: true` when `webhook_event_id` is already recorded.
  3. Verified in `tests/webhook-idempotency.test.js`.
