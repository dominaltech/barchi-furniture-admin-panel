-- ============================================================================
-- SUPABASE DATABASE & STORAGE SETUP FOR BARCHI FURNITURE
-- ============================================================================
-- Supabase URL: https://fyviuwmvyussvzeufuwg.supabase.co
-- Storage Bucket: barchi-image
-- ============================================================================
-- Copy and run this script in your Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. CREATE CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Categories
DROP POLICY IF EXISTS "Allow public read on categories" ON public.categories;
DROP POLICY IF EXISTS "Allow public insert on categories" ON public.categories;
DROP POLICY IF EXISTS "Allow public update on categories" ON public.categories;
DROP POLICY IF EXISTS "Allow public delete on categories" ON public.categories;

CREATE POLICY "Allow public read on categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow public insert on categories" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on categories" ON public.categories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on categories" ON public.categories FOR DELETE USING (true);


-- 2. CREATE PRODUCTS TABLE (WITH SPECIFICATIONS & DIMENSIONS)
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    image_url TEXT,
    description TEXT,
    material TEXT,
    colour TEXT,
    length TEXT,
    width TEXT,
    height TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add specification columns if products table already exists
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS material TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS colour TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS length TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS width TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS height TEXT;

-- Enable RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Products
DROP POLICY IF EXISTS "Allow public read on products" ON public.products;
DROP POLICY IF EXISTS "Allow public insert on products" ON public.products;
DROP POLICY IF EXISTS "Allow public update on products" ON public.products;
DROP POLICY IF EXISTS "Allow public delete on products" ON public.products;

CREATE POLICY "Allow public read on products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public insert on products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on products" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on products" ON public.products FOR DELETE USING (true);


-- 3. CREATE ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    client_name TEXT,
    mobile_number TEXT,
    total_amount NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'Pending', -- 'Pending', 'Confirmed', 'Processing', 'Delivered', 'Cancelled'
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Orders
DROP POLICY IF EXISTS "Allow public read on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public update on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public delete on orders" ON public.orders;

CREATE POLICY "Allow public read on orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert on orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on orders" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on orders" ON public.orders FOR DELETE USING (true);


-- ============================================================================
-- 4. STORAGE BUCKET (barchi-image) SETUP & RLS POLICIES
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('barchi-image', 'barchi-image', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS Policies for barchi-image bucket
DROP POLICY IF EXISTS "Public Read barchi-image" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload barchi-image" ON storage.objects;
DROP POLICY IF EXISTS "Public Update barchi-image" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete barchi-image" ON storage.objects;

CREATE POLICY "Public Read barchi-image" ON storage.objects FOR SELECT USING (bucket_id = 'barchi-image');
CREATE POLICY "Public Upload barchi-image" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'barchi-image');
CREATE POLICY "Public Update barchi-image" ON storage.objects FOR UPDATE USING (bucket_id = 'barchi-image');
CREATE POLICY "Public Delete barchi-image" ON storage.objects FOR DELETE USING (bucket_id = 'barchi-image');
