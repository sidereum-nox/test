// pages/index.js — Next.js дашборд для деплоя на Vercel
// Данные берутся из Supabase

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ===== УТИЛИТЫ =====
const fmt = (n) => n?.toLocaleString('ru-RU') ?? '0';

function groupByDate(orders) {
  const map = {};
  orders.forEach(o => {
    const date = new Date(o.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    if (!map[date]) map[date] = { date, count: 0, sum: 0 };
    map[date].count += 1;
    map[date].sum += o.total_sum || 0;
  });
  return Object.values(map).sort((a, b) => {
    const [da, ma] = a.date.split('.').map(Number);
    const [db, mb] = b.date.split('.').map(Number);
    return ma !== mb ? ma - mb : da - db;
  });
}

function groupByField(orders, field) {
  const map = {};
  orders.forEach(o => {
    const key = o[field] || 'Не указано';
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

// ===== ЦВЕТА =====
const PALETTE = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f59e0b', '#10b981'];

// ===== КОМПОНЕНТЫ =====
function StatCard({ icon, label, value, sub, color = '#6366f1' }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '24px 28px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ fontSize: 28 }}>{icon}</div>
      <div style={{ color: '#9ca3af', fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: '#f9fafb', fontSize: 28, fontWeight: 700, fontFamily: '"Space Mono", monospace' }}>{value}</div>
      {sub && <div style={{ color: color, fontSize: 13 }}>{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1e1b4b',
      border: '1px solid rgba(99,102,241,0.3)',
      borderRadius: 10,
      padding: '10px 16px',
      fontSize: 13,
      color: '#e5e7eb',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {p.name === 'Сумма' ? `${fmt(p.value)} ₸` : p.value}
        </div>
      ))}
    </div>
  );
};

// ===== ГЛАВНЫЙ КОМПОНЕНТ =====
export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 60_000);
    return () => clearInterval(interval);
  }, []);

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setOrders(data);
      setLastSync(new Date().toLocaleTimeString('ru-RU'));
    }
    setLoading(false);
  }

  // Метрики
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + (o.total_sum || 0), 0);
  const avgOrder = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;
  const bigOrders = orders.filter(o => o.total_sum > 50000).length;

  // Данные для графиков
  const byDate = groupByDate(orders);
  const bySource = groupByField(orders, 'utm_source');
  const byCity = groupByField(orders, 'city');
  const byStatus = groupByField(orders, 'status');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0c29 0%, #1a1040 50%, #0f0c29 100%)',
      color: '#f9fafb',
      fontFamily: '"Inter", system-ui, sans-serif',
      padding: '32px 24px',
    }}>
      {/* Фоновая сетка */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.04,
        backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
        {/* Шапка */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <div>
            <h1 style={{
              margin: 0, fontSize: 32, fontWeight: 800,
              background: 'linear-gradient(90deg, #a78bfa, #818cf8, #38bdf8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}>
              GBC Analytics
            </h1>
            <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 14 }}>
              Дашборд заказов Nova Collection
            </p>
          </div>
          <div style={{ textAlign: 'right', color: '#6b7280', fontSize: 12 }}>
            <div>Обновляется каждую минуту</div>
            {lastSync && <div style={{ color: '#818cf8' }}>Последнее: {lastSync}</div>}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#6b7280' }}>
            <div style={{ fontSize: 40 }}>⏳</div>
            <div style={{ marginTop: 16 }}>Загружаем данные из Supabase...</div>
          </div>
        ) : (
          <>
            {/* Карточки метрик */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
              <StatCard icon="📦" label="Всего заказов" value={fmt(totalOrders)} />
              <StatCard icon="💰" label="Выручка" value={`${fmt(totalRevenue)} ₸`} color="#10b981" />
              <StatCard icon="📊" label="Средний чек" value={`${fmt(avgOrder)} ₸`} color="#f59e0b" />
              <StatCard icon="🔥" label="VIP заказов >50K" value={bigOrders} sub={`${Math.round(bigOrders/totalOrders*100)}% от всех`} color="#ec4899" />
            </div>

            {/* Основной график */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: 24, marginBottom: 24,
            }}>
              <h2 style={{ margin: '0 0 20px', fontSize: 16, color: '#e5e7eb', fontWeight: 600 }}>
                📈 Заказы по дням
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={byDate}>
                  <defs>
                    <linearGradient id="gradCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" name="Заказов" stroke="#6366f1" fill="url(#gradCount)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Сумма по дням */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: 24, marginBottom: 24,
            }}>
              <h2 style={{ margin: '0 0 20px', fontSize: 16, color: '#e5e7eb', fontWeight: 600 }}>
                💵 Выручка по дням (₸)
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byDate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="sum" name="Сумма" fill="#818cf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Пирожки */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              {[
                { title: '📣 Источники трафика', data: bySource },
                { title: '🏙️ Города', data: byCity },
                { title: '📋 Статусы', data: byStatus },
              ].map(({ title, data }) => (
                <div key={title} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 16, padding: 24,
                }}>
                  <h2 style={{ margin: '0 0 16px', fontSize: 14, color: '#e5e7eb', fontWeight: 600 }}>{title}</h2>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                        dataKey="value" nameKey="name" paddingAngle={3}>
                        {data.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} />
                      <Legend formatter={v => <span style={{ color: '#9ca3af', fontSize: 11 }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>

            {/* Таблица последних заказов */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: 24, marginTop: 24,
            }}>
              <h2 style={{ margin: '0 0 20px', fontSize: 16, color: '#e5e7eb', fontWeight: 600 }}>
                🕐 Последние заказы
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                      {['#', 'Клиент', 'Город', 'Источник', 'Сумма', 'Дата'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...orders].reverse().slice(0, 10).map((o, i) => (
                      <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>{o.number || o.id}</td>
                        <td style={{ padding: '10px 12px', color: '#e5e7eb' }}>{o.first_name} {o.last_name}</td>
                        <td style={{ padding: '10px 12px', color: '#9ca3af' }}>{o.city || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                            padding: '2px 8px', borderRadius: 6, fontSize: 11,
                          }}>{o.utm_source || 'direct'}</span>
                        </td>
                        <td style={{
                          padding: '10px 12px',
                          color: o.total_sum > 50000 ? '#ec4899' : '#10b981',
                          fontWeight: 600, fontFamily: '"Space Mono", monospace',
                        }}>
                          {fmt(o.total_sum)} ₸
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                          {new Date(o.created_at).toLocaleDateString('ru-RU')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
