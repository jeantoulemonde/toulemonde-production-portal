CREATE TABLE IF NOT EXISTS catalog_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES catalog_categories(id),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  default_image_url TEXT,
  unit_label TEXT DEFAULT 'pièce',
  price NUMERIC(12,2),
  currency TEXT DEFAULT 'EUR',
  stock_quantity NUMERIC(14,3),
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE catalog_products
ADD COLUMN IF NOT EXISTS default_image_url TEXT;

CREATE TABLE IF NOT EXISTS catalog_product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES catalog_products(id),
  image_url TEXT,
  storage_path TEXT,
  alt_text TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_product_color_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES catalog_products(id),
  color_name TEXT NOT NULL,
  color_hex TEXT,
  image_url TEXT,
  storage_path TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES catalog_products(id),
  reference TEXT NOT NULL UNIQUE,
  color_name TEXT NOT NULL,
  color_hex TEXT,
  image_url TEXT,
  availability_status TEXT DEFAULT 'available',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_orders (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES portal_clients(id),
  order_number TEXT NOT NULL UNIQUE,
  customer_reference TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  comment TEXT,
  internal_comment TEXT,
  requested_delivery_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_order_lines (
  id SERIAL PRIMARY KEY,
  catalog_order_id INTEGER NOT NULL REFERENCES catalog_orders(id),
  product_id INTEGER REFERENCES catalog_products(id),
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL,
  unit_label TEXT,
  unit_price NUMERIC(12,2),
  line_total NUMERIC(14,2),
  color_variant_id INTEGER,
  variant_reference TEXT,
  color_name TEXT,
  color_hex TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE catalog_order_lines
ADD COLUMN IF NOT EXISTS color_variant_id INTEGER;

ALTER TABLE catalog_order_lines
ADD COLUMN IF NOT EXISTS variant_reference TEXT;

ALTER TABLE catalog_order_lines
ADD COLUMN IF NOT EXISTS color_name TEXT;

ALTER TABLE catalog_order_lines
ADD COLUMN IF NOT EXISTS color_hex TEXT;

CREATE INDEX IF NOT EXISTS idx_catalog_products_category
ON catalog_products(category_id);

CREATE INDEX IF NOT EXISTS idx_catalog_products_active
ON catalog_products(is_active);

CREATE INDEX IF NOT EXISTS idx_catalog_product_colors_product
ON catalog_product_color_variants(product_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_product
ON product_variants(product_id);

CREATE INDEX IF NOT EXISTS idx_catalog_orders_client
ON catalog_orders(client_id);

CREATE INDEX IF NOT EXISTS idx_catalog_order_lines_order
ON catalog_order_lines(catalog_order_id);

INSERT INTO catalog_categories (name, slug, description, display_order, is_active)
VALUES
  ('Fils', 'fils', 'Fils textiles standards et techniques.', 10, true),
  ('Tissus', 'tissus', 'Tissus au mètre pour usage textile et ameublement.', 20, true),
  ('Mercerie', 'mercerie', 'Articles standards de mercerie et fournitures textile.', 30, true),
  ('Fibres techniques', 'fibres-techniques', 'Fils et fibres pour usages intensifs ou spécifiques.', 40, true),
  ('Aiguilles', 'aiguilles', 'Aiguilles pour travaux de couture, broderie et confection.', 10, true),
  ('Boutons', 'boutons', 'Boutons et petites fournitures de finition.', 20, true),
  ('Rubans', 'rubans', 'Rubans textiles pour finition, assemblage ou décoration.', 30, true),
  ('Fermetures', 'fermetures', 'Fermetures et accessoires de montage.', 40, true),
  ('Fils à coudre', 'fils-a-coudre', 'Fils standards pour confection et retouche.', 50, true),
  ('Accessoires', 'accessoires', 'Accessoires textiles courants.', 60, true),
  ('Outils', 'outils', 'Outils de préparation et de finition.', 70, true),
  ('Autres', 'autres', 'Autres références mercerie.', 80, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO catalog_products (category_id, sku, name, short_description, description, default_image_url, unit_label, currency, is_active, is_featured)
SELECT c.id, 'FIL-COTON-PREMIUM-120', 'Fil coton premium 120', 'Fil coton haute résistance adapté à la confection textile industrielle.', 'Fil coton haute résistance adapté à la confection textile industrielle.', NULL, 'bobine', 'EUR', true, true
FROM catalog_categories c
WHERE c.slug = 'fils'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO catalog_products (category_id, sku, name, short_description, description, default_image_url, unit_label, currency, is_active, is_featured)
SELECT c.id, 'TISSU-VELOURS-AMEUBLEMENT', 'Tissu velours ameublement', 'Velours épais pour rideaux et ameublement.', 'Velours épais pour rideaux et ameublement.', NULL, 'mètre', 'EUR', true, true
FROM catalog_categories c
WHERE c.slug = 'tissus'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO catalog_products (category_id, sku, name, short_description, description, default_image_url, unit_label, currency, is_active, is_featured)
SELECT c.id, 'FIL-POLYESTER-TECHNIQUE-80', 'Fil polyester technique 80', 'Fil polyester renforcé pour usage intensif.', 'Fil polyester renforcé pour usage intensif.', NULL, 'bobine', 'EUR', true, true
FROM catalog_categories c
WHERE c.slug = 'fibres-techniques'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO product_variants (product_id, reference, color_name, color_hex, image_url, availability_status)
SELECT p.id, v.reference, v.color_name, v.color_hex, v.image_url, 'available'
FROM catalog_products p
JOIN (
  VALUES
    ('FIL-COTON-PREMIUM-120', 'REF-COT-120-BLEU', 'Bleu marine', '#1E3A8A', '/uploads/sample-blue.jpg'),
    ('FIL-COTON-PREMIUM-120', 'REF-COT-120-ECRU', 'Écru', '#F5F0E6', '/uploads/sample-beige.jpg'),
    ('FIL-COTON-PREMIUM-120', 'REF-COT-120-NOIR', 'Noir', '#111111', '/uploads/sample-black.jpg'),
    ('TISSU-VELOURS-AMEUBLEMENT', 'REF-VEL-AME-BORDEAUX', 'Bordeaux', '#7F1D1D', '/uploads/sample-red.jpg'),
    ('TISSU-VELOURS-AMEUBLEMENT', 'REF-VEL-AME-BEIGE', 'Beige', '#E8DCC4', '/uploads/sample-beige.jpg'),
    ('TISSU-VELOURS-AMEUBLEMENT', 'REF-VEL-AME-GRIS', 'Gris clair', '#D1D5DB', '/uploads/sample-grey.jpg'),
    ('FIL-POLYESTER-TECHNIQUE-80', 'REF-POL-80-BLANC', 'Blanc', '#FFFFFF', '/uploads/sample-white.jpg'),
    ('FIL-POLYESTER-TECHNIQUE-80', 'REF-POL-80-ROUGE', 'Rouge', '#DC2626', '/uploads/sample-red.jpg'),
    ('FIL-POLYESTER-TECHNIQUE-80', 'REF-POL-80-VERT', 'Vert industriel', '#166534', '/uploads/sample-green.jpg')
) AS v(product_sku, reference, color_name, color_hex, image_url)
ON p.sku = v.product_sku
ON CONFLICT (reference) DO NOTHING;
