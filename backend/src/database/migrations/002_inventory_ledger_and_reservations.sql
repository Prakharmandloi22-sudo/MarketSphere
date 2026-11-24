-- Migration 002: Warehouses, Inventory Levels, Inventory Ledger, and Stock Reservations
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location_code VARCHAR(50) UNIQUE NOT NULL,
    address JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS inventory_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    change_qty INT NOT NULL,
    balance_after INT NOT NULL,
    reason VARCHAR(50) NOT NULL,
    reference_type VARCHAR(50) NOT NULL,
    reference_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
