export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
export const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';

function getAuthHeader(): Record<string, string> {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('marketsphere_token');
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = 'An unexpected error occurred';
    try {
      const errJson = await res.json();
      errorMsg = errJson.error?.message || errJson.message || errorMsg;
    } catch {
      errorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  // 1. Auth
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse<{ success: boolean; data: { user: any; accessToken: string; refreshToken: string } }>(res);
  },

  async getMe() {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<{ success: boolean; data: { user: any; seller: any } }>(res);
  },

  // 2. Catalog
  async getProducts(params: { q?: string; category?: string; minPrice?: string; maxPrice?: string; inStock?: boolean; sort?: string } = {}) {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.append('q', params.q);
    if (params.category) searchParams.append('category', params.category);
    if (params.minPrice) searchParams.append('minPrice', params.minPrice);
    if (params.maxPrice) searchParams.append('maxPrice', params.maxPrice);
    if (params.inStock) searchParams.append('inStock', 'true');
    if (params.sort) searchParams.append('sort', params.sort);

    const res = await fetch(`${API_BASE_URL}/catalog/products?${searchParams.toString()}`);
    return handleResponse<{ success: boolean; data: any[]; count: number }>(res);
  },

  async getProduct(id: string) {
    const res = await fetch(`${API_BASE_URL}/catalog/products/${id}`);
    return handleResponse<{ success: boolean; data: any }>(res);
  },

  async getCategories() {
    const res = await fetch(`${API_BASE_URL}/catalog/categories`);
    return handleResponse<{ success: boolean; data: any[] }>(res);
  },

  // 3. Cart
  async getCart() {
    const res = await fetch(`${API_BASE_URL}/cart`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<{ success: boolean; data: { cartId: string; items: any[]; subtotal: number; itemCount: number } }>(res);
  },

  async addToCart(sku: string, quantity: number = 1) {
    const res = await fetch(`${API_BASE_URL}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ sku, quantity })
    });
    return handleResponse<{ success: boolean; data: any }>(res);
  },

  async updateCartItem(id: string, quantity: number) {
    const res = await fetch(`${API_BASE_URL}/cart/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ quantity })
    });
    return handleResponse<{ success: boolean; data: any }>(res);
  },

  // 4. Promotions
  async validateCoupon(code: string, subtotal: number) {
    const res = await fetch(`${API_BASE_URL}/promotions/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal })
    });
    return handleResponse<{ success: boolean; data: any }>(res);
  },

  // 5. Checkout
  async previewCheckout(payload: { items: { sku: string; quantity: number }[]; promoCode?: string }) {
    const res = await fetch(`${API_BASE_URL}/checkout/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    return handleResponse<{ success: boolean; data: any }>(res);
  },

  async createOrder(payload: any) {
    const res = await fetch(`${API_BASE_URL}/checkout/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    return handleResponse<{ success: boolean; data: { order: any; reservationToken: string; reservationExpiresAt: string } }>(res);
  },

  // 6. Orders
  async getOrders() {
    const res = await fetch(`${API_BASE_URL}/orders`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<{ success: boolean; data: any[] }>(res);
  },

  async getOrder(id: string) {
    const res = await fetch(`${API_BASE_URL}/orders/${id}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<{ success: boolean; data: any }>(res);
  },

  // 7. Inventory & Seller
  async getInventory() {
    const res = await fetch(`${API_BASE_URL}/inventory`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<{ success: boolean; data: any[] }>(res);
  },

  async getSettlements() {
    const res = await fetch(`${API_BASE_URL}/settlements`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse<{ success: boolean; data: any[] }>(res);
  },

  // 8. Python Recommendations
  async getRecommendations(currentSku?: string, category?: string) {
    const res = await fetch(`${PYTHON_API_URL}/api/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_sku: currentSku, category, limit: 4 })
    });
    return handleResponse<{ strategy_used: string; recommendations: any[] }>(res);
  }
};
