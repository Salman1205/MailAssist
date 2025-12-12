-- ============================================
-- Shopify Integration Schema
-- ============================================

-- Shopify Configuration Table
-- Stores Shopify API credentials per Gmail account
CREATE TABLE IF NOT EXISTS public.shopify_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  shop_domain TEXT NOT NULL, -- e.g., "your-shop.myshopify.com"
  access_token TEXT NOT NULL, -- Private app access token
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_email)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shopify_config_user_email ON public.shopify_config(user_email);

-- Trigger to update updated_at
CREATE TRIGGER update_shopify_config_updated_at 
  BEFORE UPDATE ON public.shopify_config 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.shopify_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only allow users to access their own Shopify config
DROP POLICY IF EXISTS "Users can read their own Shopify config" ON public.shopify_config;
CREATE POLICY "Users can read their own Shopify config" 
  ON public.shopify_config 
  FOR SELECT 
  TO authenticated 
  USING (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Admins can manage Shopify config" ON public.shopify_config;
CREATE POLICY "Admins can manage Shopify config" 
  ON public.shopify_config 
  FOR ALL 
  TO authenticated 
  USING (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.user_email = shopify_config.user_email 
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.user_email = shopify_config.user_email 
      AND users.role = 'admin'
    )
  );

-- Customer Cache Table (optional - for performance)
-- Caches customer data to reduce API calls
CREATE TABLE IF NOT EXISTS public.shopify_customer_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  shopify_customer_id BIGINT,
  customer_data JSONB NOT NULL, -- Full customer data from Shopify
  orders_data JSONB, -- Recent orders data
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_email, customer_email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shopify_cache_user_email ON public.shopify_customer_cache(user_email);
CREATE INDEX IF NOT EXISTS idx_shopify_cache_customer_email ON public.shopify_customer_cache(customer_email);
CREATE INDEX IF NOT EXISTS idx_shopify_cache_expires_at ON public.shopify_customer_cache(expires_at);

-- Enable RLS
ALTER TABLE public.shopify_customer_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cache
DROP POLICY IF EXISTS "Users can read their own cached customer data" ON public.shopify_customer_cache;
CREATE POLICY "Users can read their own cached customer data" 
  ON public.shopify_customer_cache 
  FOR SELECT 
  TO authenticated 
  USING (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can cache their own customer data" ON public.shopify_customer_cache;
CREATE POLICY "Users can cache their own customer data" 
  ON public.shopify_customer_cache 
  FOR ALL 
  TO authenticated 
  USING (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  )
  WITH CHECK (
    user_email IN (
      SELECT user_email FROM public.tokens WHERE user_email IS NOT NULL
    )
  );



