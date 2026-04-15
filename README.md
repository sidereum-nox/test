# GBC Analytics Dashboard

Тестовое задание — AI Tools Specialist @ GBC

## Стек

- **RetailCRM** — хранение заказов
- **Supabase** — PostgreSQL база данных (синхронизация из RetailCRM)
- **Next.js + Recharts** — дашборд (деплой на Vercel)
- **Node.js** — скрипты загрузки и синхронизации
- **Telegram Bot API** — уведомления о крупных заказах

---

## Быстрый старт

### 1. Клонировать репозиторий

```bash
git clone https://github.com/YOUR_USERNAME/gbc-analytics-dashboard
cd gbc-analytics-dashboard
npm install
```

### 2. Настроить переменные окружения

Создай `.env.local`:

```env
RETAILCRM_URL=https://YOUR_DOMAIN.retailcrm.ru
RETAILCRM_API_KEY=your_api_key
RETAILCRM_SITE=default

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_KEY=your_service_role_key

TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### 3. Создать таблицу в Supabase

Выполни в SQL Editor на supabase.com:

```sql
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
```

### 4. Загрузить заказы в RetailCRM

```bash
node scripts/upload-to-retailcrm.js
```

### 5. Синхронизировать в Supabase

```bash
node scripts/sync-to-supabase.js
```

### 6. Запустить бота

```bash
node scripts/telegram-bot.js
```

### 7. Запустить дашборд локально

```bash
npm run dev
```

### 8. Задеплоить на Vercel

```bash
npx vercel --prod
```

---

## Промпты, которые использовались в Claude Code

### Шаг 1 — Загрузка заказов в RetailCRM

```
Напиши Node.js скрипт который читает файл mock_orders.json 
и загружает каждый заказ в RetailCRM через POST /api/v5/orders/create.
Используй fetch API. Добавь задержку 300ms между запросами чтобы 
не превысить rate limit. Логируй прогресс с номером заказа.
Сумму считай как сумма (initialPrice * quantity) по всем items.
```

### Шаг 2 — Синхронизация RetailCRM → Supabase

```
Напиши скрипт sync-to-supabase.js который:
1) Получает все заказы из RetailCRM API с пагинацией (лимит 100 на страницу)
2) Трансформирует данные в плоскую структуру для Supabase
3) Делает upsert батчами по 50 записей чтобы избежать дублей
4) Использует @supabase/supabase-js клиент
5) Выводит статистику в конце
```

### Шаг 3 — Дашборд

```
Создай Next.js страницу pages/index.js с дашбордом заказов.
Данные из Supabase через @supabase/supabase-js.
Используй recharts для графиков:
- AreaChart: количество заказов по дням
- BarChart: выручка по дням  
- PieChart x3: источники трафика, города, статусы
Тёмная тема, фиолетовый акцент. Автообновление каждую минуту.
Карточки со статистикой: всего заказов, выручка, средний чек, VIP заказов.
```

### Шаг 4 — Telegram бот

```
Напиши Node.js скрипт для Telegram бота без внешних зависимостей 
(только встроенный https модуль).
Каждые 60 секунд проверяет новые заказы в RetailCRM за последний час.
Если сумма заказа > 50000 ₸ — отправляет уведомление в Telegram.
Запоминает отправленные заказы в JSON файл чтобы не дублировать.
Сообщение: клиент, телефон, город, источник, список товаров, итого.
```

---

## Где застрял и как решил

### Проблема 1: RetailCRM — формат тела запроса
RetailCRM ожидает `application/x-www-form-urlencoded`, а не JSON.
Заказ нужно передавать как `order=JSON.stringify(...)`.
**Решение:** поменял Content-Type и обернул данные в URLSearchParams.

### Проблема 2: Даты в mock_orders.json отсутствуют
В исходных данных нет поля `createdAt`, а RetailCRM требует дату.
**Решение:** генерирую случайные даты в диапазоне последних 30 дней.

### Проблема 3: Supabase RLS политики
По умолчанию Row Level Security блокирует запись через anon key.
**Решение:** для скриптов синхронизации используем service_role key,
для дашборда (чтение) достаточно anon key + политика SELECT для всех.

### Проблема 4: Сумма заказа не хранится в RetailCRM явно
RetailCRM вычисляет `summ` на своей стороне, но при GET заказов 
иногда возвращает 0 если позиции не прошли валидацию.
**Решение:** считаем сумму локально из items при трансформации.

---

## Структура проекта

```
gbc-analytics-dashboard/
├── mock_orders.json          # 50 тестовых заказов (из задания)
├── package.json
├── .env.local                # переменные окружения (не в git!)
├── .gitignore
├── pages/
│   └── index.js              # дашборд Next.js
└── scripts/
    ├── upload-to-retailcrm.js  # загрузка заказов в RetailCRM
    ├── sync-to-supabase.js     # синхронизация в Supabase
    └── telegram-bot.js         # Telegram уведомления
```
