-- Выполни это в Supabase SQL Editor (supabase.com → SQL Editor)

-- 1. Создаём таблицу заказов
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  number TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  status TEXT,
  total_sum NUMERIC,
  city TEXT,
  utm_source TEXT,
  items JSONB,
  created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Индексы для быстрой аналитики
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_total_sum ON orders(total_sum);
CREATE INDEX IF NOT EXISTS idx_orders_utm_source ON orders(utm_source);
CREATE INDEX IF NOT EXISTS idx_orders_city ON orders(city);

-- 3. RLS: разрешить чтение всем (для дашборда)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON orders
  FOR SELECT USING (true);

-- 4. RLS: разрешить запись только через service_role (для скриптов)
-- service_role автоматически обходит RLS, ничего делать не нужно

-- Проверка
SELECT COUNT(*) FROM orders;
