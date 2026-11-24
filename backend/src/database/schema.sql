-- ============================================================================
-- MarketSphere Core Commerce & Multi-Vendor PostgreSQL Schema
-- Version: 1.0.0
-- Assessment 03: Commerce Database Model
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Core Auth & Roles)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('customer', 'seller', 'warehouse', 'support', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Sellers Table (Onboarding, KYC, Commission)
CREATE TABLE IF NOT EXISTS sellers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_name VARCHAR(255) UNIQUE NOT NULL,
    business_number VARCHAR(100) NOT NULL,
    support_email VARCHAR(255) NOT NULL,
    kyc_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected', 'suspended')),
    commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 10.00 CHECK (commission_rate >= 0.00 AND commission_rate <= 100.00),
    payout_bank_account VARCHAR(100),
    rating DECIMAL(3, 2) DEFAULT 5.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sellers_kyc_status ON sellers(kyc_status);

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    commission_override DECIMAL(5, 2) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2) NOT NULL CHECK (base_price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_seller_product_slug UNIQUE (seller_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- 5. Product Variants & SKUs
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    compare_at_price DECIMAL(10, 2) CHECK (compare_at_price IS NULL OR compare_at_price >= price),
    barcode VARCHAR(100),
    weight_grams INT DEFAULT 0,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);

-- 6. Warehouses Table
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location_code VARCHAR(50) UNIQUE NOT NULL,
    address JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Inventory Levels Table (Available, Reserved, Safety Stock with Optimistic Locking Version)
CREATE TABLE IF NOT EXISTS inventory_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) NOT NULL REFERENCES product_variants(sku) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    available_stock INT NOT NULL DEFAULT 0 CHECK (available_stock >= 0),
    reserved_stock INT NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
    safety_stock INT NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sku_warehouse UNIQUE (sku, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_levels(sku);

-- 8. Inventory Ledger (Immutable Audit Trail for all Stock Movements)
CREATE TABLE IF NOT EXISTS inventory_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    change_qty INT NOT NULL,
    balance_after INT NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('STOCK_IN', 'RESERVATION_CREATED', 'RESERVATION_COMMITTED', 'RESERVATION_RELEASED', 'RESERVATION_EXPIRED', 'RETURN_RESTOCK', 'DAMAGE_WRITE_OFF', 'AUDIT_CORRECTION')),
    reference_type VARCHAR(50) NOT NULL,
    reference_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_sku ON inventory_ledger(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_ref ON inventory_ledger(reference_type, reference_id);

-- 9. Stock Reservations (Assessment 07 & Capstone Challenge)
CREATE TABLE IF NOT EXISTS stock_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_token VARCHAR(255) UNIQUE NOT NULL,
    order_id VARCHAR(255),
    sku VARCHAR(100) NOT NULL REFERENCES product_variants(sku),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMMITTED', 'RELEASED', 'EXPIRED')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reservations_token ON stock_reservations(reservation_token);
CREATE INDEX IF NOT EXISTS idx_reservations_expires_status ON stock_reservations(expires_at, status);

-- 10. Carts and Cart Items
CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cart_user UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL REFERENCES product_variants(sku),
    quantity INT NOT NULL CHECK (quantity > 0),
    price_at_add DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cart_sku UNIQUE (cart_id, sku)
);

-- 11. Discounts & Promotions
CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value DECIMAL(10, 2) NOT NULL CHECK (value > 0),
    min_order_value DECIMAL(10, 2) DEFAULT 0,
    max_uses INT DEFAULT NULL,
    current_uses INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESERVED', 'PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED')),
    subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
    discount_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_total >= 0),
    shipping_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (shipping_total >= 0),
    tax_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax_total >= 0),
    grand_total DECIMAL(10, 2) NOT NULL CHECK (grand_total >= 0),
    discount_id UUID REFERENCES discounts(id),
    shipping_address JSONB NOT NULL,
    billing_address JSONB NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);

-- 13. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES sellers(id),
    sku VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    variant_name VARCHAR(255) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
    platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    seller_payout DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    fulfillment_status VARCHAR(50) NOT NULL DEFAULT 'UNFULFILLED' CHECK (fulfillment_status IN ('UNFULFILLED', 'PICKED', 'PACKED', 'SHIPPED', 'DELIVERED', 'RETURNED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items(seller_id);

-- 14. Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'stripe_sandbox',
    provider_tx_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED')),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    webhook_event_id VARCHAR(255) UNIQUE,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_webhook_event ON payments(webhook_event_id);

-- 15. Shipments Table
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    carrier VARCHAR(100) NOT NULL,
    tracking_number VARCHAR(255) UNIQUE NOT NULL,
    label_url VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'LABEL_CREATED' CHECK (status IN ('LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_ATTEMPT')),
    estimated_delivery TIMESTAMP WITH TIME ZONE,
    actual_delivery TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Returns & Refunds Table
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    order_item_id UUID NOT NULL REFERENCES order_items(id),
    user_id UUID NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'ITEM_RECEIVED', 'REFUNDED')),
    refund_amount DECIMAL(10, 2) NOT NULL CHECK (refund_amount >= 0),
    is_restocked BOOLEAN NOT NULL DEFAULT FALSE,
    idempotency_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    order_id UUID REFERENCES orders(id),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_user_review UNIQUE (product_id, user_id)
);

-- 18. Seller Settlements Table
CREATE TABLE IF NOT EXISTS seller_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES sellers(id),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    gross_sales DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    commission_deducted DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    refund_deductions DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    net_payout DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED')),
    payout_tx_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 19. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID,
    actor_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    payload JSONB,
    ip_address VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
