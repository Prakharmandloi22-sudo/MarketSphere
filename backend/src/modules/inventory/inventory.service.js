const { v4: uuidv4 } = require('uuid');
const db = require('../../database/db');

/**
 * Assessment 07 & Capstone Challenge: Inventory Reservation Engine
 * Protects against race conditions and concurrent checkout overselling.
 */
class InventoryService {
  /**
   * Atomically reserve stock across multiple SKUs.
   * If even a single SKU lacks sufficient available stock, the entire reservation
   * is aborted and rolled back.
   */
  static async reserveStock({ orderId = null, items, expiresInSeconds = 600 }) {
    if (!items || items.length === 0) {
      throw new Error('No items provided for stock reservation');
    }

    const reservationToken = `resv_${uuidv4().replace(/-/g, '')}`;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    // Use transaction and row-level locks
    return await db.transaction(async (tx) => {
      const lockedReleases = [];

      try {
        // 1. Acquire mutex lock on each requested SKU to prevent concurrent read-modify-write race
        for (const item of items) {
          const release = await db.acquireLock(`sku_lock_${item.sku}`);
          lockedReleases.push(release);
        }

        // 2. Check stock availability for all items atomically
        const reservationPlan = [];

        for (const item of items) {
          const invLevels = db.memoryDb.find('inventory_levels', inv => inv.sku === item.sku);
          const totalAvailable = invLevels.reduce((sum, inv) => sum + inv.available_stock, 0);

          if (totalAvailable < item.quantity) {
            const err = new Error(`Insufficient inventory for SKU '${item.sku}'. Requested: ${item.quantity}, Available: ${totalAvailable}`);
            err.statusCode = 409;
            err.code = 'OUT_OF_STOCK';
            err.sku = item.sku;
            err.available = totalAvailable;
            throw err;
          }

          // Pick warehouse with highest available stock
          invLevels.sort((a, b) => b.available_stock - a.available_stock);
          const selectedWh = invLevels[0];

          reservationPlan.push({
            sku: item.sku,
            warehouseId: selectedWh.warehouse_id,
            quantity: item.quantity,
            inventoryRecordId: selectedWh.id
          });
        }

        // 3. Perform atomic reservation adjustments
        const createdReservations = [];

        for (const plan of reservationPlan) {
          const inv = db.memoryDb.findById('inventory_levels', plan.inventoryRecordId);
          const updatedInv = db.memoryDb.update('inventory_levels', inv.id, {
            available_stock: inv.available_stock - plan.quantity,
            reserved_stock: inv.reserved_stock + plan.quantity,
            version: inv.version + 1
          });

          // Record in Immutable Inventory Ledger
          db.memoryDb.insert('inventory_ledger', {
            sku: plan.sku,
            warehouse_id: plan.warehouseId,
            change_qty: -plan.quantity,
            balance_after: updatedInv.available_stock,
            reason: 'RESERVATION_CREATED',
            reference_type: 'RESERVATION',
            reference_id: reservationToken
          });

          // Insert active reservation record
          const reservation = db.memoryDb.insert('stock_reservations', {
            reservation_token: reservationToken,
            order_id: orderId,
            sku: plan.sku,
            warehouse_id: plan.warehouseId,
            quantity: plan.quantity,
            status: 'ACTIVE',
            expires_at: expiresAt
          });

          createdReservations.push(reservation);
        }

        return {
          success: true,
          reservationToken,
          expiresAt,
          reservations: createdReservations
        };
      } finally {
        // Release all acquired row mutex locks
        for (const release of lockedReleases) {
          release();
        }
      }
    });
  }

  /**
   * Permanently commit a stock reservation upon successful payment.
   */
  static async commitReservation(reservationToken, orderId) {
    const reservations = db.memoryDb.find('stock_reservations', r => r.reservation_token === reservationToken);
    if (!reservations || reservations.length === 0) {
      throw new Error(`Reservation not found: ${reservationToken}`);
    }

    for (const resv of reservations) {
      if (resv.status !== 'ACTIVE') {
        continue;
      }

      // Decrement reserved stock permanently
      const inv = db.memoryDb.findOne('inventory_levels', i => i.sku === resv.sku && i.warehouse_id === resv.warehouse_id);
      if (inv) {
        db.memoryDb.update('inventory_levels', inv.id, {
          reserved_stock: Math.max(0, inv.reserved_stock - resv.quantity),
          version: inv.version + 1
        });

        db.memoryDb.insert('inventory_ledger', {
          sku: resv.sku,
          warehouse_id: resv.warehouse_id,
          change_qty: 0,
          balance_after: inv.available_stock,
          reason: 'RESERVATION_COMMITTED',
          reference_type: 'ORDER',
          reference_id: orderId || resv.order_id || reservationToken
        });
      }

      db.memoryDb.update('stock_reservations', resv.id, {
        status: 'COMMITTED',
        order_id: orderId || resv.order_id
      });
    }

    return { committed: true, reservationToken };
  }

  /**
   * Release reserved stock back to available pool (e.g. order cancelled, checkout abandoned).
   */
  static async releaseReservation(reservationToken, reason = 'RESERVATION_RELEASED') {
    const reservations = db.memoryDb.find('stock_reservations', r => r.reservation_token === reservationToken);
    if (!reservations || reservations.length === 0) {
      return { released: false, message: 'Reservation not found' };
    }

    for (const resv of reservations) {
      if (resv.status !== 'ACTIVE') {
        continue;
      }

      const inv = db.memoryDb.findOne('inventory_levels', i => i.sku === resv.sku && i.warehouse_id === resv.warehouse_id);
      if (inv) {
        const restored = db.memoryDb.update('inventory_levels', inv.id, {
          available_stock: inv.available_stock + resv.quantity,
          reserved_stock: Math.max(0, inv.reserved_stock - resv.quantity),
          version: inv.version + 1
        });

        db.memoryDb.insert('inventory_ledger', {
          sku: resv.sku,
          warehouse_id: resv.warehouse_id,
          change_qty: resv.quantity,
          balance_after: restored.available_stock,
          reason,
          reference_type: 'RESERVATION',
          reference_id: reservationToken
        });
      }

      db.memoryDb.update('stock_reservations', resv.id, {
        status: reason === 'RESERVATION_EXPIRED' ? 'EXPIRED' : 'RELEASED'
      });
    }

    return { released: true, reservationToken };
  }

  /**
   * Background sweep for expired reservations
   */
  static async sweepExpiredReservations() {
    const now = new Date().toISOString();
    const expiredActive = db.memoryDb.find('stock_reservations', r => r.status === 'ACTIVE' && r.expires_at < now);

    const distinctTokens = [...new Set(expiredActive.map(r => r.reservation_token))];
    for (const token of distinctTokens) {
      await this.releaseReservation(token, 'RESERVATION_EXPIRED');
    }
    return distinctTokens.length;
  }
}

module.exports = InventoryService;
