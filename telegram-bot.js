/**
 * Шаг 5: Telegram-бот — уведомление при заказе > 50,000 ₸
 *
 * Промпт для Claude Code:
 * "Напиши Telegram-бота на Node.js с polling или webhook, который 
 * каждые 60 секунд проверяет новые заказы в RetailCRM через API 
 * и отправляет уведомление в Telegram если сумма заказа > 50000 ₸.
 * Запоминай уже отправленные заказы чтобы не дублировать."
 */
require('dotenv').config();
const https = require('https');
const fs = require('fs');

// ===== НАСТРОЙКИ =====
const RETAILCRM_URL = process.env.RETAILCRM_URL || 'https://YOUR_DOMAIN.retailcrm.ru';
const RETAILCRM_API_KEY = process.env.RETAILCRM_API_KEY || 'YOUR_API_KEY';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID';
const THRESHOLD = 50000; // ₸
const CHECK_INTERVAL_MS = 60 * 1000; // каждую минуту
const SEEN_ORDERS_FILE = './seen_orders.json';

// ===== ХРАНЕНИЕ ОТПРАВЛЕННЫХ ЗАКАЗОВ =====
function loadSeenOrders() {
  if (fs.existsSync(SEEN_ORDERS_FILE)) {
    return new Set(JSON.parse(fs.readFileSync(SEEN_ORDERS_FILE, 'utf-8')));
  }
  return new Set();
}

function saveSeenOrders(set) {
  fs.writeFileSync(SEEN_ORDERS_FILE, JSON.stringify([...set]));
}

// ===== HTTP УТИЛИТЫ =====
function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ===== RETAILCRM API =====
async function getRecentOrders() {
  // Заказы за последний час
  const since = new Date(Date.now() - 70 * 60 * 1000).toISOString();
  
  const params = new URLSearchParams({
    'filter[createdAtFrom]': since,
    limit: '100',
    page: '1',
  });

  const url = new URL(`${RETAILCRM_URL}/api/v5/orders?${params}`);

  const data = await httpsRequest(url.toString(), {
    method: 'GET',
    headers: { 'X-API-KEY': RETAILCRM_API_KEY },
    hostname: url.hostname,
    path: url.pathname + url.search,
  });

  return data.orders || [];
}

// ===== TELEGRAM =====
async function sendTelegramMessage(text) {
  const url = new URL(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`);
  const body = JSON.stringify({
    chat_id: TELEGRAM_CHAT_ID,
    text: text,
    parse_mode: 'HTML',
  });

  await httpsRequest(url.toString(), {
    method: 'POST',
    hostname: 'api.telegram.org',
    path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  });
}

function formatOrderMessage(order, totalSum) {
  const items = (order.items || [])
    .map(i => `  • ${i.productName} × ${i.quantity} = ${(i.initialPrice * i.quantity).toLocaleString('ru-RU')} ₸`)
    .join('\n');

  const source = order.customFields?.utm_source || 'direct';
  const city = order.delivery?.address?.city || '—';

  return `🔔 <b>Крупный заказ! ${totalSum.toLocaleString('ru-RU')} ₸</b>

👤 ${order.firstName} ${order.lastName}
📞 ${order.phone}
📍 ${city}
📣 Источник: ${source}

🛍️ Товары:
${items}

💰 Итого: <b>${totalSum.toLocaleString('ru-RU')} ₸</b>
🆔 Заказ #${order.number || order.id}`;
}

// ===== ОСНОВНАЯ ЛОГИКА =====
async function checkOrders(seenOrders) {
  const orders = await getRecentOrders();
  let notified = 0;

  for (const order of orders) {
    const orderId = String(order.id);
    
    // Пропускаем уже отправленные
    if (seenOrders.has(orderId)) continue;
    
    // Считаем сумму
    const totalSum = (order.items || []).reduce(
      (sum, item) => sum + (item.initialPrice * item.quantity || 0),
      0
    ) || order.summ || 0;

    if (totalSum > THRESHOLD) {
      console.log(`🔔 Крупный заказ обнаружен: #${order.id} на сумму ${totalSum.toLocaleString('ru-RU')} ₸`);
      
      const message = formatOrderMessage(order, totalSum);
      await sendTelegramMessage(message);
      
      console.log(`✅ Уведомление отправлено в Telegram`);
      notified++;
    }

    seenOrders.add(orderId);
  }

  return notified;
}

// ===== ЗАПУСК =====
async function main() {
  console.log('🤖 Telegram-бот запущен');
  console.log(`📊 Порог уведомления: ${THRESHOLD.toLocaleString('ru-RU')} ₸`);
  console.log(`⏱️  Интервал проверки: ${CHECK_INTERVAL_MS / 1000} сек\n`);

  // Отправляем стартовое сообщение
  await sendTelegramMessage(
    `✅ <b>Бот запущен!</b>\nОтслеживаю заказы > ${THRESHOLD.toLocaleString('ru-RU')} ₸`
  );

  const seenOrders = loadSeenOrders();

  const runCheck = async () => {
    const now = new Date().toLocaleTimeString('ru-RU');
    console.log(`[${now}] Проверяю заказы...`);
    
    try {
      const count = await checkOrders(seenOrders);
      saveSeenOrders(seenOrders);
      console.log(`[${now}] Готово. Уведомлений: ${count}`);
    } catch (err) {
      console.error(`[${now}] Ошибка:`, err.message);
    }
  };

  // Сразу запускаем
  await runCheck();

  // Повторяем по расписанию
  setInterval(runCheck, CHECK_INTERVAL_MS);
}

main().catch(console.error);
