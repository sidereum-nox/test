/**
 * Шаг 3: Синхронизация RetailCRM → Supabase
 *
 * Промпт для Claude Code:
 * "Напиши скрипт который: 
 * 1) Забирает все заказы из RetailCRM API с пагинацией
 * 2) Создаёт таблицу orders в Supabase если её нет
 * 3) Делает upsert заказов чтобы избежать дублей
 * 4) Логирует прогресс"
 *
 * SQL для создания таблицы в Supabase (выполни в SQL Editor):
 * 
 * CREATE TABLE IF NOT EXISTS orders (
 *   id INTEGER PRIMARY KEY,
 *   number TEXT,
 *   first_name TEXT,
 *   last_name TEXT,
 *   phone TEXT,
 *   email TEXT,
 *   status TEXT,
 *   total_sum NUMERIC,
 *   city TEXT,
 *   utm_source TEXT,
 *   items JSONB,
 *   created_at TIMESTAMPTZ,
 *   synced_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// ===== НАСТРОЙКИ =====
const RETAILCRM_URL = process.env.RETAILCRM_URL || 'https://YOUR_DOMAIN.retailcrm.ru';
const RETAILCRM_API_KEY = process.env.RETAILCRM_API_KEY || 'YOUR_API_KEY';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'YOUR_ANON_OR_SERVICE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== ПОЛУЧЕНИЕ ЗАКАЗОВ ИЗ RETAILCRM =====
async function fetchOrdersPage(page = 1, limit = 100) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  const response = await fetch(
    `${RETAILCRM_URL}/api/v5/orders?${params}`,
    {
      headers: { 'X-API-KEY': RETAILCRM_API_KEY },
    }
  );

  if (!response.ok) {
    throw new Error(`RetailCRM API error: ${response.status}`);
  }

  return await response.json();
}

async function fetchAllOrders() {
  console.log('📥 Загружаем заказы из RetailCRM...');
  
  const allOrders = [];
  let page = 1;
  let totalPages = 1;

  do {
    const data = await fetchOrdersPage(page);
    
    if (!data.success) {
      throw new Error(`RetailCRM вернул ошибку: ${JSON.stringify(data)}`);
    }

    totalPages = data.pagination?.totalPageCount || 1;
    allOrders.push(...(data.orders || []));
    
    console.log(`  Страница ${page}/${totalPages} — загружено ${data.orders?.length || 0} заказов`);
    page++;

    // Небольшая задержка
    if (page <= totalPages) await new Promise(r => setTimeout(r, 200));
  } while (page <= totalPages);

  console.log(`✅ Всего загружено: ${allOrders.length} заказов\n`);
  return allOrders;
}

// ===== ТРАНСФОРМАЦИЯ ДАННЫХ =====
function transformOrder(order) {
  // Считаем сумму из items
  const totalSum = order.items
    ? order.items.reduce((sum, item) => sum + (item.initialPrice * item.quantity || 0), 0)
    : (order.summ || 0);

  return {
    id: order.id,
    number: order.number || String(order.id),
    first_name: order.firstName || '',
    last_name: order.lastName || '',
    phone: order.phone || '',
    email: order.email || '',
    status: order.status || 'new',
    total_sum: totalSum,
    city: order.delivery?.address?.city || '',
    utm_source: order.customFields?.utm_source || 'direct',
    items: order.items || [],
    created_at: order.createdAt || new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
}

// ===== СОХРАНЕНИЕ В SUPABASE =====
async function upsertOrders(orders) {
  console.log('💾 Сохраняем заказы в Supabase...');
  
  const transformed = orders.map(transformOrder);
  
  // Upsert батчами по 50
  const BATCH_SIZE = 50;
  let upserted = 0;

  for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
    const batch = transformed.slice(i, i + BATCH_SIZE);
    
    const { error } = await supabase
      .from('orders')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`❌ Ошибка при upsert батча ${i / BATCH_SIZE + 1}:`, error.message);
      throw error;
    }

    upserted += batch.length;
    console.log(`  Сохранено: ${upserted}/${transformed.length}`);
  }

  console.log(`\n✅ Все заказы сохранены в Supabase!`);
}

// ===== MAIN =====
async function main() {
  console.log('🔄 Синхронизация RetailCRM → Supabase\n');
  console.log(`RetailCRM: ${RETAILCRM_URL}`);
  console.log(`Supabase:  ${SUPABASE_URL}\n`);

  const orders = await fetchAllOrders();
  await upsertOrders(orders);

  // Статистика
  const { data: stats } = await supabase
    .from('orders')
    .select('total_sum, city, utm_source');
  
  if (stats) {
    const totalRevenue = stats.reduce((s, o) => s + (o.total_sum || 0), 0);
    console.log('\n📊 Статистика в Supabase:');
    console.log(`  Заказов: ${stats.length}`);
    console.log(`  Выручка: ${totalRevenue.toLocaleString('ru-RU')} ₸`);
  }

  console.log('\n🎉 Синхронизация завершена!');
}

main().catch(console.error);
