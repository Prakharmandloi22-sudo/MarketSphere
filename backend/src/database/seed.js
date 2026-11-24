const bcrypt = require('bcryptjs');
const db = require('./db');

async function seedDatabase() {
  console.log('[Seed] Seeding MarketSphere test and demo data...');
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('Password123!', salt);

  // 1. Warehouses
  const whEast = db.memoryDb.insert('warehouses', {
    name: 'East Coast Fulfillment Center',
    location_code: 'WH-EAST-01',
    address: { street: '100 Logistics Blvd', city: 'Secaucus', state: 'NJ', zip: '07094' },
    is_active: true
  });

  const whWest = db.memoryDb.insert('warehouses', {
    name: 'West Coast Distribution Hub',
    location_code: 'WH-WEST-01',
    address: { street: '500 Cargo Way', city: 'Ontario', state: 'CA', zip: '91761' },
    is_active: true
  });

  // 2. Users (Admin, Sellers, Customers, Warehouse, Support)
  const adminUser = db.memoryDb.insert('users', {
    email: 'admin@marketsphere.local',
    password_hash: passwordHash,
    full_name: 'MarketSphere Administrator',
    role: 'admin',
    is_active: true
  });

  const seller1User = db.memoryDb.insert('users', {
    email: 'techseller@marketsphere.local',
    password_hash: passwordHash,
    full_name: 'Apex Tech Brands Inc',
    role: 'seller',
    is_active: true
  });

  const seller2User = db.memoryDb.insert('users', {
    email: 'apparel@marketsphere.local',
    password_hash: passwordHash,
    full_name: 'Urban Thread Studios',
    role: 'seller',
    is_active: true
  });

  const customer1 = db.memoryDb.insert('users', {
    email: 'customer1@marketsphere.local',
    password_hash: passwordHash,
    full_name: 'Alice Customer',
    role: 'customer',
    is_active: true
  });

  const customer2 = db.memoryDb.insert('users', {
    email: 'customer2@marketsphere.local',
    password_hash: passwordHash,
    full_name: 'Bob Customer',
    role: 'customer',
    is_active: true
  });

  const warehouseStaff = db.memoryDb.insert('users', {
    email: 'warehouse@marketsphere.local',
    password_hash: passwordHash,
    full_name: 'Dave Logistics',
    role: 'warehouse',
    is_active: true
  });

  const supportAgent = db.memoryDb.insert('users', {
    email: 'support@marketsphere.local',
    password_hash: passwordHash,
    full_name: 'Sarah Support',
    role: 'support',
    is_active: true
  });

  // 3. Sellers
  const sellerApex = db.memoryDb.insert('sellers', {
    user_id: seller1User.id,
    store_name: 'Apex Tech Official',
    business_number: 'US-EIN-987654321',
    support_email: 'support@apextech.com',
    kyc_status: 'approved',
    commission_rate: 10.00,
    payout_bank_account: 'US-CHASE-****4491',
    rating: 4.9
  });

  const sellerUrban = db.memoryDb.insert('sellers', {
    user_id: seller2User.id,
    store_name: 'Urban Threads',
    business_number: 'US-EIN-123456789',
    support_email: 'hello@urbanthreads.io',
    kyc_status: 'approved',
    commission_rate: 12.50,
    payout_bank_account: 'US-BOA-****8820',
    rating: 4.8
  });

  // 4. Categories
  const catElectronics = db.memoryDb.insert('categories', {
    name: 'Electronics & Audio',
    slug: 'electronics',
    commission_override: 10.00
  });

  const catApparel = db.memoryDb.insert('categories', {
    name: 'Apparel & Fashion',
    slug: 'apparel',
    commission_override: 12.00
  });

  // 5. Products & Variants
  // Product A: Headphones
  const prodHeadphones = db.memoryDb.insert('products', {
    seller_id: sellerApex.id,
    category_id: catElectronics.id,
    title: 'Quantum Ultra Wireless Noise-Cancelling Headphones',
    slug: 'quantum-ultra-wireless-headphones',
    description: 'Studio-grade acoustics with active hybrid noise cancellation and 40h battery life.',
    base_price: 199.99,
    is_active: true
  });

  const skuHeadphones = 'HEADPHONE-BLK-01';
  db.memoryDb.insert('product_variants', {
    product_id: prodHeadphones.id,
    sku: skuHeadphones,
    title: 'Midnight Black / Standard Edition',
    price: 199.99,
    compare_at_price: 249.99,
    attributes: { color: 'Black', wireless: true, anc: true },
    is_active: true
  });

  db.memoryDb.insert('inventory_levels', {
    sku: skuHeadphones,
    warehouse_id: whEast.id,
    available_stock: 50,
    reserved_stock: 0,
    safety_stock: 5,
    version: 1
  });

  // Product B: Flash Sale Watch (Available Stock = 1, for Concurrency Capstone Challenge)
  const prodWatch = db.memoryDb.insert('products', {
    seller_id: sellerApex.id,
    category_id: catElectronics.id,
    title: 'Apex Chrono Limited Edition Smartwatch',
    slug: 'apex-chrono-smartwatch',
    description: 'Titanium chassis with sapphire glass. Only 1 unit remaining in flash sale.',
    base_price: 499.00,
    is_active: true
  });

  const skuWatch = 'WATCH-LTD-01';
  db.memoryDb.insert('product_variants', {
    product_id: prodWatch.id,
    sku: skuWatch,
    title: 'Titanium Gray / Single Release',
    price: 499.00,
    compare_at_price: 599.00,
    attributes: { material: 'Titanium', edition: 'Limited' },
    is_active: true
  });

  db.memoryDb.insert('inventory_levels', {
    sku: skuWatch,
    warehouse_id: whEast.id,
    available_stock: 1, // Exactly 1 item for concurrency overselling test!
    reserved_stock: 0,
    safety_stock: 0,
    version: 1
  });

  // Product C: Hoodie
  const prodHoodie = db.memoryDb.insert('products', {
    seller_id: sellerUrban.id,
    category_id: catApparel.id,
    title: 'Merino Wool Minimalist Pullover Hoodie',
    slug: 'merino-wool-minimalist-hoodie',
    description: '100% natural Merino wool crafted for lightweight insulation and breathability.',
    base_price: 89.00,
    is_active: true
  });

  const skuHoodie = 'HOODIE-M-GRY';
  db.memoryDb.insert('product_variants', {
    product_id: prodHoodie.id,
    sku: skuHoodie,
    title: 'Heather Gray / Medium',
    price: 89.00,
    compare_at_price: 110.00,
    attributes: { size: 'M', color: 'Gray', material: 'Merino Wool' },
    is_active: true
  });

  db.memoryDb.insert('inventory_levels', {
    sku: skuHoodie,
    warehouse_id: whWest.id,
    available_stock: 35,
    reserved_stock: 0,
    safety_stock: 2,
    version: 1
  });

  // 6. Discounts
  db.memoryDb.insert('discounts', {
    code: 'WELCOME10',
    type: 'percentage',
    value: 10.00,
    min_order_value: 50.00,
    max_uses: 1000,
    current_uses: 12,
    is_active: true,
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  });

  db.memoryDb.insert('discounts', {
    code: 'SAVE50',
    type: 'fixed',
    value: 50.00,
    min_order_value: 200.00,
    max_uses: 500,
    current_uses: 5,
    is_active: true,
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  });

  console.log('[Seed] Database seeded with 7 users, 2 warehouses, 2 sellers, 3 products, inventory & coupons.');
  return {
    adminUser,
    seller1User,
    customer1,
    customer2,
    whEast,
    whWest,
    skuHeadphones,
    skuWatch,
    skuHoodie
  };
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
