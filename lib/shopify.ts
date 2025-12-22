/**
 * Shopify API integration
 * Fetches customer information, order history, and related data
 */

export interface ShopifyCustomer {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  totalSpent: number;
  ordersCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  acceptsMarketing: boolean;
  verifiedEmail: boolean;
  addresses?: ShopifyAddress[];
}

export interface ShopifyAddress {
  id: number;
  firstName?: string;
  lastName?: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province?: string;
  country: string;
  zip?: string;
  phone?: string;
  isDefault: boolean;
}

export interface ShopifyOrder {
  id: number;
  name: string; // Order number like "#1001"
  email: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancelled: boolean;
  financialStatus: string; // "paid", "pending", "refunded", etc.
  fulfillmentStatus?: string; // "fulfilled", "partial", "unfulfilled"
  totalPrice: string;
  totalPriceSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  lineItems: ShopifyLineItem[];
  customer?: ShopifyCustomer;
  shippingAddress?: ShopifyAddress;
  billingAddress?: ShopifyAddress;
  note?: string;
  tags: string[];
}

export interface ShopifyLineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  sku?: string;
  variantTitle?: string;
  productId?: number;
  variantId?: number;
  fulfillmentStatus?: string;
}

export interface ShopifyConfig {
  shopDomain: string; // e.g., "your-shop.myshopify.com"
  accessToken: string; // Private app access token
}

/**
 * Get Shopify API base URL
 */
function getShopifyApiUrl(shopDomain: string, endpoint: string): string {
  const cleanDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `https://${cleanDomain}/admin/api/2024-01/${endpoint}`;
}

/**
 * Make authenticated request to Shopify API
 */
async function shopifyRequest<T>(
  config: ShopifyConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getShopifyApiUrl(config.shopDomain, endpoint);
  
  // Sanitize the access token - remove any non-ASCII characters or whitespace
  const sanitizedToken = config.accessToken.trim().replace(/[^\x00-\x7F]/g, '');
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': sanitizedToken,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

/**
 * Find customer by email address
 */
export async function findCustomerByEmail(
  config: ShopifyConfig,
  email: string
): Promise<ShopifyCustomer | null> {
  try {
    // Sanitize email - trim and remove any non-ASCII characters
    const sanitizedEmail = email.trim().replace(/[^\x00-\x7F]/g, '');
    
    const response = await shopifyRequest<{ customers: any[] }>(
      config,
      `customers/search.json?query=email:${encodeURIComponent(sanitizedEmail)}&limit=1`
    );

    if (!response.customers || response.customers.length === 0) {
      return null;
    }

    const customer = response.customers[0];
    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      totalSpent: parseFloat(customer.total_spent || '0'),
      ordersCount: customer.orders_count || 0,
      tags: customer.tags ? customer.tags.split(',').map((t: string) => t.trim()) : [],
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
      acceptsMarketing: customer.accepts_marketing || false,
      verifiedEmail: customer.verified_email || false,
      addresses: customer.addresses?.map((addr: any) => ({
        id: addr.id,
        firstName: addr.first_name,
        lastName: addr.last_name,
        company: addr.company,
        address1: addr.address1,
        address2: addr.address2,
        city: addr.city,
        province: addr.province,
        country: addr.country,
        zip: addr.zip,
        phone: addr.phone,
        isDefault: addr.default || false,
      })),
    };
  } catch (error) {
    console.error('[Shopify] Error finding customer:', error);
    return null;
  }
}

/**
 * Get customer orders
 */
export async function getCustomerOrders(
  config: ShopifyConfig,
  customerId: number,
  limit: number = 10
): Promise<ShopifyOrder[]> {
  try {
    const response = await shopifyRequest<{ orders: any[] }>(
      config,
      `customers/${customerId}/orders.json?limit=${limit}&status=any`
    );

    if (!response.orders) {
      return [];
    }

    return response.orders.map((order: any) => ({
      id: order.id,
      name: order.name,
      email: order.email,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      cancelledAt: order.cancelled_at,
      cancelled: order.cancelled_at !== null,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      totalPrice: order.total_price,
      totalPriceSet: order.total_price_set || {
        shopMoney: {
          amount: order.total_price,
          currencyCode: order.currency || 'USD',
        },
      },
      lineItems: order.line_items?.map((item: any) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        price: item.price,
        sku: item.sku,
        variantTitle: item.variant_title,
        productId: item.product_id,
        variantId: item.variant_id,
        fulfillmentStatus: item.fulfillment_status,
      })) || [],
      shippingAddress: order.shipping_address ? {
        id: order.shipping_address.id || 0,
        firstName: order.shipping_address.first_name,
        lastName: order.shipping_address.last_name,
        company: order.shipping_address.company,
        address1: order.shipping_address.address1,
        address2: order.shipping_address.address2,
        city: order.shipping_address.city,
        province: order.shipping_address.province,
        country: order.shipping_address.country,
        zip: order.shipping_address.zip,
        phone: order.shipping_address.phone,
        isDefault: false,
      } : undefined,
      billingAddress: order.billing_address ? {
        id: order.billing_address.id || 0,
        firstName: order.billing_address.first_name,
        lastName: order.billing_address.last_name,
        company: order.billing_address.company,
        address1: order.billing_address.address1,
        address2: order.billing_address.address2,
        city: order.billing_address.city,
        province: order.billing_address.province,
        country: order.billing_address.country,
        zip: order.billing_address.zip,
        phone: order.billing_address.phone,
        isDefault: false,
      } : undefined,
      note: order.note,
      tags: order.tags ? order.tags.split(',').map((t: string) => t.trim()) : [],
    }));
  } catch (error) {
    console.error('[Shopify] Error fetching customer orders:', error);
    return [];
  }
}

/**
 * Search for orders by email (useful when customer ID is unknown)
 */
export async function searchOrdersByEmail(
  config: ShopifyConfig,
  email: string,
  limit: number = 10
): Promise<ShopifyOrder[]> {
  try {
    // Sanitize email - trim and remove any non-ASCII characters
    const sanitizedEmail = email.trim().replace(/[^\x00-\x7F]/g, '');
    
    const response = await shopifyRequest<{ orders: any[] }>(
      config,
      `orders.json?email=${encodeURIComponent(sanitizedEmail)}&limit=${limit}&status=any`
    );

    if (!response.orders) {
      return [];
    }

    // Map orders using the same transformation as getCustomerOrders
    return response.orders.map((order: any) => ({
      id: order.id,
      name: order.name,
      email: order.email,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      cancelledAt: order.cancelled_at,
      cancelled: order.cancelled_at !== null,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      totalPrice: order.total_price,
      totalPriceSet: order.total_price_set || {
        shopMoney: {
          amount: order.total_price,
          currencyCode: order.currency || 'USD',
        },
      },
      lineItems: order.line_items?.map((item: any) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        price: item.price,
        sku: item.sku,
        variantTitle: item.variant_title,
        productId: item.product_id,
        variantId: item.variant_id,
        fulfillmentStatus: item.fulfillment_status,
      })) || [],
      shippingAddress: order.shipping_address ? {
        id: order.shipping_address.id || 0,
        firstName: order.shipping_address.first_name,
        lastName: order.shipping_address.last_name,
        company: order.shipping_address.company,
        address1: order.shipping_address.address1,
        address2: order.shipping_address.address2,
        city: order.shipping_address.city,
        province: order.shipping_address.province,
        country: order.shipping_address.country,
        zip: order.shipping_address.zip,
        phone: order.shipping_address.phone,
        isDefault: false,
      } : undefined,
      billingAddress: order.billing_address ? {
        id: order.billing_address.id || 0,
        firstName: order.billing_address.first_name,
        lastName: order.billing_address.last_name,
        company: order.billing_address.company,
        address1: order.billing_address.address1,
        address2: order.billing_address.address2,
        city: order.billing_address.city,
        province: order.billing_address.province,
        country: order.billing_address.country,
        zip: order.billing_address.zip,
        phone: order.billing_address.phone,
        isDefault: false,
      } : undefined,
      note: order.note,
      tags: order.tags ? order.tags.split(',').map((t: string) => t.trim()) : [],
    }));
  } catch (error) {
    console.error('[Shopify] Error searching orders by email:', error);
    return [];
  }
}

/**
 * Get comprehensive customer data (customer info + orders)
 */
export async function getCustomerData(
  config: ShopifyConfig,
  email: string
): Promise<{
  customer: ShopifyCustomer | null;
  orders: ShopifyOrder[];
  totalSpent: number;
  recentOrders: ShopifyOrder[];
}> {
  const customer = await findCustomerByEmail(config, email);
  
  let orders: ShopifyOrder[] = [];
  if (customer) {
    orders = await getCustomerOrders(config, customer.id, 20);
  } else {
    // If customer not found, try searching orders by email
    orders = await searchOrdersByEmail(config, email, 20);
  }

  const totalSpent = customer
    ? customer.totalSpent
    : orders.reduce((sum, order) => sum + parseFloat(order.totalPrice || '0'), 0);

  const recentOrders = orders
    .filter(order => !order.cancelled)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return {
    customer,
    orders,
    totalSpent,
    recentOrders,
  };
}





