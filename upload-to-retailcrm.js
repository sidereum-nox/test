/**
 * Шаг 2: Загрузка заказов из mock_orders.json в RetailCRM
 * 
 * Промпт для Claude Code:
 * "Напиши скрипт на Node.js, который читает mock_orders.json и загружает 
 * каждый заказ в RetailCRM через API /api/v5/orders/create. 
 * Добавь задержку между запросами чтобы не превысить rate limit."
 */
require('dotenv').config();
const fs = require('fs');

// ===== НАСТРОЙКИ =====
const RETAILCRM_URL = process.env.RETAILCRM_URL || 'https://maymemento0.retailcrm.ru';
const RETAILCRM_API_KEY = process.env.RETAILCRM_API_KEY || '';
const SITE = process.env.RETAILCRM_SITE || 'default';
const DELAY_MS = 300; // задержка между запросами (ms)

// ===== УТИЛИТЫ =====
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function createOrder(order, index) {
  // Считаем итоговую сумму заказа
  const totalSum = order.items.reduce((sum, item) => {
    return sum + (item.initialPrice * item.quantity);
  }, 0);

  // Формируем тело запроса в формате RetailCRM
  const orderPayload = {
    firstName: order.firstName,
    lastName: order.lastName,
    phone: order.phone,
    email: order.email,
    
    status: order.status,
    items: order.items.map(item => ({
      productName: item.productName,
      quantity: item.quantity,
      initialPrice: item.initialPrice,
    })),
    delivery: order.delivery,
    customFields: order.customFields,
    // Добавляем дату создания (распределяем заказы за последние 30 дней)
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
    summ: totalSum,
  };

  const formData = new URLSearchParams();
  formData.append('order', JSON.stringify(orderPayload));
  formData.append('site', SITE);

  const response = await fetch(`${RETAILCRM_URL}/api/v5/orders/create`, {
    method: 'POST',
    headers: {
      'X-API-KEY': RETAILCRM_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(`Ошибка при создании заказа #${index + 1}: ${JSON.stringify(data.errors || data)}`);
  }

  return data;
}

async function main() {
  console.log('🚀 Начинаем загрузку заказов в RetailCRM...\n');

  // Читаем файл с заказами
  const rawData = fs.readFileSync('./mock_orders.json', 'utf-8');
  const orders = JSON.parse(rawData);

  console.log(`📦 Найдено заказов: ${orders.length}\n`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const orderNum = i + 1;

    try {
      const result = await createOrder(order, i);
      successCount++;
      const totalSum = order.items.reduce((sum, item) => sum + (item.initialPrice * item.quantity), 0);
      console.log(`✅ [${orderNum}/${orders.length}] ${order.firstName} ${order.lastName} — ${totalSum.toLocaleString('ru-RU')} ₸ (ID: ${result.id})`);
    } catch (err) {
      errorCount++;
      errors.push({ index: orderNum, name: `${order.firstName} ${order.lastName}`, error: err.message });
      console.error(`❌ [${orderNum}/${orders.length}] ${order.firstName} ${order.lastName}: ${err.message}`);
    }

    // Задержка между запросами
    if (i < orders.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log('\n=== ИТОГ ===');
  console.log(`✅ Успешно: ${successCount}`);
  console.log(`❌ Ошибки: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\nДетали ошибок:');
    errors.forEach(e => console.log(`  #${e.index} ${e.name}: ${e.error}`));
  }
}

main().catch(console.error);
