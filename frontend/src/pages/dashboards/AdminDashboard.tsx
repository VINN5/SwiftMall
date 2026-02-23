// frontend/src/pages/dashboards/AdminDashboard.tsx
import { useState, useEffect, useCallback } from 'react';

const API = 'https://swiftmall-backend.onrender.com/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminUser   { name: string; email: string; initials: string; }
interface PlatformStats { totalUsers: number; totalSellers: number; totalBuyers: number; totalProducts: number; totalOrders: number; totalRevenue: number; activeProducts: number; pendingOrders: number; }
interface SellerUser  { id: string; username: string; email: string; phone: string; storeName: string; status: 'active'|'suspended'; joinedAt: string; totalProducts: number; totalRevenue: number; }
interface BuyerUser   { id: string; username: string; email: string; phone: string; status: 'active'|'suspended'; joinedAt: string; totalOrders: number; totalSpent: number; }
interface AdminOrder  { id: string; product: string; buyer: string; seller: string; date: string; status: 'delivered'|'shipped'|'processing'|'cancelled'; amount: number; emoji: string; }
interface AdminProduct{ id: string; name: string; seller: string; category: string; emoji: string; price: number; stock: number; isActive: boolean; soldCount: number; rating: number; }
interface AuditLog    { id: string; action: string; user: string; target: string; time: string; level: 'info'|'warn'|'error'; }

const statusConfig: Record<AdminOrder['status'], { label: string; color: string; bg: string }> = {
  delivered:  { label: 'Delivered',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  shipped:    { label: 'Shipped',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  processing: { label: 'Processing', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  cancelled:  { label: 'Cancelled',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const fmt = (n: number) => `KES ${n.toLocaleString()}`;

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useAdminUser() {
  const [user, setUser] = useState<AdminUser | null>(null);
  useEffect(() => {
    fetch(`${API}/admin/me`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data.username) {
          const initials = data.username.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
          setUser({ name: data.username, email: data.email, initials: initials || 'A' });
        }
      }).catch(() => {});
  }, []);
  return { user };
}

function usePlatformStats() {
  const [data, setData]       = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/admin/stats`, { headers: authHeaders() })
      .then(r => r.json()).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

function useSellers() {
  const [sellers, setSellers] = useState<SellerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const fetch_ = useCallback(() => {
    setLoading(true);
    const qs = search ? `?q=${encodeURIComponent(search)}` : '';
    fetch(`${API}/admin/sellers${qs}`, { headers: authHeaders() })
      .then(r => r.json()).then(setSellers).catch(() => setSellers([])).finally(() => setLoading(false));
  }, [search]);
  useEffect(() => { fetch_(); }, [fetch_]);
  const toggleStatus = async (id: string, status: 'active'|'suspended') => {
    setSellers(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    await fetch(`${API}/admin/sellers/${id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }) });
  };
  const deleteSeller = async (id: string) => {
    setSellers(prev => prev.filter(s => s.id !== id));
    await fetch(`${API}/admin/sellers/${id}`, { method: 'DELETE', headers: authHeaders() });
  };
  return { sellers, loading, search, setSearch, fetch_, toggleStatus, deleteSeller };
}

function useBuyers() {
  const [buyers, setBuyers]   = useState<BuyerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const fetch_ = useCallback(() => {
    setLoading(true);
    const qs = search ? `?q=${encodeURIComponent(search)}` : '';
    fetch(`${API}/admin/buyers${qs}`, { headers: authHeaders() })
      .then(r => r.json()).then(setBuyers).catch(() => setBuyers([])).finally(() => setLoading(false));
  }, [search]);
  useEffect(() => { fetch_(); }, [fetch_]);
  const toggleStatus = async (id: string, status: 'active'|'suspended') => {
    setBuyers(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    await fetch(`${API}/admin/buyers/${id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }) });
  };
  return { buyers, loading, search, setSearch, fetch_, toggleStatus };
}

function useAdminOrders() {
  const [orders, setOrders]   = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch_ = useCallback((status = 'all') => {
    setLoading(true);
    fetch(`${API}/admin/orders?status=${status}`, { headers: authHeaders() })
      .then(r => r.json()).then(setOrders).catch(() => setOrders([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetch_(); }, [fetch_]);
  return { orders, loading, fetch_ };
}

function useAdminProducts() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading]   = useState(true);
  const fetch_ = useCallback((search = '') => {
    setLoading(true);
    const qs = search ? `?q=${encodeURIComponent(search)}` : '';
    fetch(`${API}/admin/products${qs}`, { headers: authHeaders() })
      .then(r => r.json()).then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetch_(); }, [fetch_]);
  const toggleActive = async (id: string, isActive: boolean) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, isActive } : p));
    await fetch(`${API}/admin/products/${id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ is_active: isActive }) });
  };
  const removeProduct = async (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    await fetch(`${API}/admin/products/${id}`, { method: 'DELETE', headers: authHeaders() });
  };
  return { products, loading, fetch_, toggleActive, removeProduct };
}

function useAuditLog() {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/admin/audit-log`, { headers: authHeaders() })
      .then(r => r.json()).then(setLogs).catch(() => setLogs([])).finally(() => setLoading(false));
  }, []);
  return { logs, loading };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Skeleton({ height = 60, radius = 10 }: { height?: number; radius?: number }) {
  return <div style={{ height, borderRadius: radius, marginBottom: 10, background: 'linear-gradient(90deg,var(--border) 25%,var(--card-alt) 50%,var(--border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />;
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>{message}</div>
    </div>
  );
}

function StatCard({ icon, label, value, loading, color }: { icon: string; label: string; value?: string; loading: boolean; color?: string }) {
  return (
    <div style={{ background: 'var(--card)', border: `1px solid ${color ? color + '30' : 'var(--border)'}`, borderRadius: 16, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}>
      {color && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color }} />}
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      {loading ? <Skeleton height={26} radius={6} /> : <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-display)', color: color ?? 'var(--text)' }}>{value ?? '—'}</div>}
    </div>
  );
}

function SearchInput({ value, onChange, onSearch, placeholder }: { value: string; onChange: (v: string) => void; onSearch: () => void; placeholder: string }) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
      <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSearch()}
        placeholder={placeholder}
        style={{ width: '100%', padding: '10px 12px 10px 38px', background: 'var(--card-alt)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none' }}
      />
    </div>
  );
}

// ── Create Seller Modal ──────────────────────────────────────────────────────
function CreateSellerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ username: '', email: '', phone: '', password: '', store_name: '' });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const handle = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(''); setSuccess(''); setSaving(true);
    try {
      const res  = await fetch(`${API}/admin/sellers`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create seller'); }
      else { setSuccess('Seller account created successfully!'); onCreated(); setTimeout(onClose, 1500); }
    } catch { setError('Network error'); }
    setSaving(false);
  };

  const fields: [string, string, string][] = [
    ['Store / Business Name', 'store_name', 'text'],
    ['Full Name',             'username',   'text'],
    ['Email Address',         'email',      'email'],
    ['Phone Number',          'phone',      'tel'],
    ['Temporary Password',    'password',   'password'],
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 900 }}>Create Seller Account</h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Only admins can onboard new sellers.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20 }}>✕</button>
        </div>
        {fields.map(([label, key, type]) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</label>
            <input
              type={type}
              value={(form as Record<string, string>)[key]}
              onChange={e => handle(key, e.target.value)}
              style={{ width: '100%', padding: '11px 14px', background: 'var(--card-alt)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none' }}
            />
          </div>
        ))}
        {error   && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 14 }}>{error}</div>}
        {success && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#22c55e', fontSize: 13, marginBottom: 14 }}>{success}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Cancel</button>
          <button onClick={submit} disabled={saving || !form.username || !form.email || !form.password}
            style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)', color: 'var(--bg)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14 }}>
            {saving ? 'Creating...' : '+ Create Seller'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Dashboard ─────────────────────────────────────────────────────
type Tab = 'overview' | 'sellers' | 'buyers' | 'orders' | 'products' | 'audit' | 'settings';

export default function AdminDashboard() {
  const [tab, setTab]               = useState<Tab>('overview');
  const [orderFilter, setOrderFilter] = useState('all');
  const [showCreateSeller, setShowCreateSeller] = useState(false);
  const [prodSearch, setProdSearch] = useState('');

  const { user }                                    = useAdminUser();
  const { data: stats, loading: statsLoading }      = usePlatformStats();
  const { sellers, loading: sellersLoading, search: sellerSearch, setSearch: setSellerSearch, fetch_: fetchSellers, toggleStatus: toggleSellerStatus, deleteSeller } = useSellers();
  const { buyers, loading: buyersLoading, search: buyerSearch, setSearch: setBuyerSearch, fetch_: fetchBuyers, toggleStatus: toggleBuyerStatus } = useBuyers();
  const { orders, loading: ordersLoading, fetch_: fetchOrders } = useAdminOrders();
  const { products, loading: productsLoading, fetch_: fetchProducts, toggleActive, removeProduct } = useAdminProducts();
  const { logs, loading: auditLoading }             = useAuditLog();

  const handleSignOut = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/login'; };
  const today = new Date().toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric' });

  const navItems: { id: Tab; icon: string; label: string; badge?: number }[] = [
    { id: 'overview',  icon: '⊞',  label: 'Overview' },
    { id: 'sellers',   icon: '🏪', label: 'Sellers',  badge: sellers.length },
    { id: 'buyers',    icon: '👥', label: 'Buyers',   badge: buyers.length },
    { id: 'orders',    icon: '📦', label: 'Orders',   badge: orders.filter(o => o.status === 'processing').length },
    { id: 'products',  icon: '🏷',  label: 'Products' },
    { id: 'audit',     icon: '🔒', label: 'Audit Log' },
    { id: 'settings',  icon: '⚙',  label: 'Settings' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        :root {
          --bg: #06080f; --card: #0c0f1a; --card-alt: #111422; --border: #1a1f30;
          --text: #dde4f5; --muted: #4c5572; --accent: #4f7fff; --accent2: #c084fc; --danger: #f43f5e; --success: #10b981;
          --sidebar-w: 240px; --topbar-h: 64px; --nav-h: 62px;
          --font-display: 'Bricolage Grotesque', sans-serif; --font-body: 'Plus Jakarta Sans', sans-serif;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: var(--bg); }
        .ad { display: flex; min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--font-body); }

        .ad-sidebar { width: var(--sidebar-w); min-height: 100vh; background: var(--card); border-right: 1px solid var(--border); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; z-index: 40; }
        .ad-sidebar-logo { padding: 22px 20px; border-bottom: 1px solid var(--border); }
        .ad-sidebar nav { flex: 1; padding: 12px 10px; display: flex; flex-direction: column; gap: 2px; }
        .ad-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: none; background: transparent; color: var(--muted); font-family: var(--font-body); font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; width: 100%; text-align: left; }
        .ad-nav-item:hover { background: var(--card-alt); color: var(--text); }
        .ad-nav-item.active { background: rgba(79,127,255,0.12); color: var(--accent); }
        .ad-nav-item .nav-icon { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; }
        .ad-nav-badge { margin-left: auto; background: var(--accent); color: #fff; font-size: 10px; font-weight: 800; border-radius: 999px; min-width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
        .ad-sidebar-user { padding: 14px 18px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
        .ad-admin-badge { background: rgba(244,63,94,0.15); color: var(--danger); font-size: 10px; fontWeight: 800; padding: '2px 8px'; border-radius: 6px; }

        .ad-main { flex: 1; display: flex; flex-direction: column; margin-left: var(--sidebar-w); min-height: 100vh; }
        .ad-topbar { height: var(--topbar-h); background: var(--card); border-bottom: 1px solid var(--border); padding: 0 32px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 30; }
        .ad-content { flex: 1; padding: 32px; display: flex; flex-direction: column; gap: 22px; max-width: 1300px; width: 100%; }

        .stats-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .stats-grid-4b { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .section { background: var(--card); border: 1px solid var(--border); border-radius: 18px; padding: 22px; }
        .section-title { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .pill-btn { padding: 7px 15px; border-radius: 999px; border: 1px solid var(--border); background: transparent; color: var(--muted); cursor: pointer; font-size: 12px; font-weight: 600; font-family: var(--font-body); transition: all 0.15s; white-space: nowrap; }
        .pill-btn:hover { border-color: var(--accent); color: var(--accent); }
        .pill-btn.active-filter { background: var(--accent); border-color: var(--accent); color: #fff; }
        .pill-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
        .pill-btn.danger { border-color: var(--danger); color: var(--danger); }
        .pill-btn.danger:hover { background: rgba(244,63,94,0.08); }
        .pill-btn.success { border-color: var(--success); color: var(--success); }
        .avatar { border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent2)); display: flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; flex-shrink: 0; font-family: var(--font-display); }
        .table { width: 100%; border-collapse: collapse; }
        .table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 700; padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); }
        .table td { padding: 13px 12px; font-size: 13px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .table tr:last-child td { border-bottom: none; }
        .table tr:hover td { background: var(--card-alt); }
        .status-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 800; letter-spacing: 0.05em; padding: 3px 9px; border-radius: 999px; }
        .filter-row { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; margin-bottom: 18px; }
        .filter-row::-webkit-scrollbar { display: none; }
        .settings-row { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--border); gap: 12px; }
        .settings-row:last-of-type { border-bottom: none; }
        .ad-bottom-nav { display: none; }

        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        @media (max-width: 1100px) { .stats-grid-4, .stats-grid-4b { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 900px) {
          .ad-sidebar { display: none; }
          .ad-main { margin-left: 0; padding-bottom: var(--nav-h); }
          .ad-topbar { padding: 0 16px; }
          .ad-content { padding: 12px; gap: 12px; }
          .stats-grid-4, .stats-grid-4b { grid-template-columns: 1fr 1fr; gap: 10px; }
          .section { padding: 14px; border-radius: 14px; }
          .table th, .table td { padding: 10px 8px; font-size: 12px; }
          .ad-bottom-nav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; height: var(--nav-h); background: var(--card); border-top: 1px solid var(--border); z-index: 40; overflow-x: auto; scrollbar-width: none; }
          .ad-bottom-nav::-webkit-scrollbar { display: none; }
          .ad-bottom-btn { flex: 0 0 auto; min-width: 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border: none; background: transparent; cursor: pointer; color: var(--muted); font-family: var(--font-body); font-size: 9px; font-weight: 600; position: relative; transition: color 0.15s; padding: 0 10px; }
          .ad-bottom-btn.active { color: var(--accent); }
          .ad-bottom-btn .b-icon { font-size: 19px; line-height: 1; }
          .ad-mob-badge { position: absolute; top: 4px; right: 4px; background: var(--accent); color: #fff; font-size: 8px; font-weight: 800; border-radius: 999px; min-width: 15px; height: 15px; display: flex; align-items: center; justify-content: center; padding: 0 3px; }
        }
      `}</style>

      {showCreateSeller && (
        <CreateSellerModal
          onClose={() => setShowCreateSeller(false)}
          onCreated={fetchSellers}
        />
      )}

      <div className="ad">

        {/* ── Sidebar ── */}
        <aside className="ad-sidebar">
          <div className="ad-sidebar-logo">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>
              Swift<span style={{ color: 'var(--accent)' }}>Mall</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, background: 'rgba(244,63,94,0.12)', padding: '3px 10px', borderRadius: 6 }}>
              <span style={{ color: 'var(--danger)', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em' }}>🔒 ADMIN PANEL</span>
            </div>
          </div>
          <nav>
            {navItems.map(item => (
              <button key={item.id} className={`ad-nav-item${tab === item.id ? ' active' : ''}`} onClick={() => setTab(item.id)}>
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && item.badge > 0 ? <span className="ad-nav-badge">{item.badge > 99 ? '99+' : item.badge}</span> : null}
              </button>
            ))}
          </nav>
          <div className="ad-sidebar-user">
            <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{user?.initials ?? 'A'}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name ?? '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 700 }}>Administrator</div>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="ad-main">
          <header className="ad-topbar">
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                {navItems.find(n => n.id === tab)?.label}
              </h1>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{today}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name ?? '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 700 }}>Admin</div>
              </div>
              <div className="avatar" style={{ width: 40, height: 40, fontSize: 14 }}>{user?.initials ?? 'A'}</div>
            </div>
          </header>

          <main className="ad-content">

            {/* ─── Overview ─── */}
            {tab === 'overview' && (
              <>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>Platform Overview</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>Real-time metrics across SwiftMall.</div>
                </div>
                <div className="stats-grid-4">
                  <StatCard icon="👥" label="Total Users"    value={stats ? String(stats.totalUsers)    : undefined} loading={statsLoading} color="var(--accent)" />
                  <StatCard icon="🏪" label="Sellers"        value={stats ? String(stats.totalSellers)  : undefined} loading={statsLoading} color="var(--accent2)" />
                  <StatCard icon="🛒" label="Buyers"         value={stats ? String(stats.totalBuyers)   : undefined} loading={statsLoading} color="#22d1b0" />
                  <StatCard icon="🏷"  label="Products"      value={stats ? String(stats.totalProducts) : undefined} loading={statsLoading} color="#f59e0b" />
                </div>
                <div className="stats-grid-4b">
                  <StatCard icon="📦" label="Total Orders"   value={stats ? String(stats.totalOrders)   : undefined} loading={statsLoading} color="#3b82f6" />
                  <StatCard icon="💰" label="Platform Revenue" value={stats ? fmt(stats.totalRevenue)   : undefined} loading={statsLoading} color="#22c55e" />
                  <StatCard icon="✅" label="Active Products" value={stats ? String(stats.activeProducts): undefined} loading={statsLoading} color="#10b981" />
                  <StatCard icon="⏳" label="Pending Orders" value={stats ? String(stats.pendingOrders) : undefined} loading={statsLoading} color="#f59e0b" />
                </div>

                {/* Quick Actions */}
                <div className="section">
                  <div className="section-title">Quick Actions</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button className="pill-btn primary" style={{ padding: '10px 22px', fontSize: 13 }} onClick={() => { setTab('sellers'); setShowCreateSeller(true); }}>+ Onboard Seller</button>
                    <button className="pill-btn" style={{ padding: '10px 22px', fontSize: 13 }} onClick={() => setTab('orders')}>View All Orders</button>
                    <button className="pill-btn" style={{ padding: '10px 22px', fontSize: 13 }} onClick={() => setTab('audit')}>View Audit Log</button>
                  </div>
                </div>

                {/* Recent orders */}
                <div className="section">
                  <div className="section-title">
                    Latest Orders
                    <button className="pill-btn" onClick={() => setTab('orders')}>See All</button>
                  </div>
                  {ordersLoading ? [1,2,3].map(i => <Skeleton key={i} height={52} />) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Product</th><th>Buyer</th><th>Seller</th><th>Amount</th><th>Status</th><th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.slice(0, 5).map(o => <AdminOrderRow key={o.id} order={o} />)}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {/* ─── Sellers ─── */}
            {tab === 'sellers' && (
              <div className="section">
                <div className="section-title">
                  Sellers ({sellers.length})
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <SearchInput value={sellerSearch} onChange={setSellerSearch} onSearch={fetchSellers} placeholder="Search sellers..." />
                    <button className="pill-btn primary" onClick={() => setShowCreateSeller(true)}>+ New Seller</button>
                  </div>
                </div>
                {sellersLoading ? [1,2,3].map(i => <Skeleton key={i} height={60} />) : sellers.length === 0 ? (
                  <EmptyState icon="🏪" message="No sellers found." />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Store</th><th>Email</th><th>Phone</th><th>Products</th><th>Revenue</th><th>Joined</th><th>Status</th><th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sellers.map(s => (
                          <tr key={s.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{s.storeName || s.username}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.username}</div>
                            </td>
                            <td style={{ color: 'var(--muted)' }}>{s.email}</td>
                            <td style={{ color: 'var(--muted)' }}>{s.phone || '—'}</td>
                            <td>{s.totalProducts}</td>
                            <td style={{ fontWeight: 600 }}>{fmt(s.totalRevenue)}</td>
                            <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{s.joinedAt}</td>
                            <td>
                              <span className="status-pill" style={{ color: s.status === 'active' ? '#22c55e' : '#ef4444', background: s.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
                                {s.status === 'active' ? '● Active' : '● Suspended'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className={`pill-btn ${s.status === 'active' ? 'danger' : 'success'}`} onClick={() => toggleSellerStatus(s.id, s.status === 'active' ? 'suspended' : 'active')}>
                                  {s.status === 'active' ? 'Suspend' : 'Activate'}
                                </button>
                                <button className="pill-btn danger" onClick={() => { if(confirm('Delete this seller?')) deleteSeller(s.id); }}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ─── Buyers ─── */}
            {tab === 'buyers' && (
              <div className="section">
                <div className="section-title">
                  Buyers ({buyers.length})
                  <SearchInput value={buyerSearch} onChange={setBuyerSearch} onSearch={fetchBuyers} placeholder="Search buyers..." />
                </div>
                {buyersLoading ? [1,2,3].map(i => <Skeleton key={i} height={60} />) : buyers.length === 0 ? (
                  <EmptyState icon="👥" message="No buyers found." />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Spent</th><th>Joined</th><th>Status</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {buyers.map(b => (
                          <tr key={b.id}>
                            <td style={{ fontWeight: 600 }}>{b.username}</td>
                            <td style={{ color: 'var(--muted)' }}>{b.email}</td>
                            <td style={{ color: 'var(--muted)' }}>{b.phone || '—'}</td>
                            <td>{b.totalOrders}</td>
                            <td style={{ fontWeight: 600 }}>{fmt(b.totalSpent)}</td>
                            <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{b.joinedAt}</td>
                            <td>
                              <span className="status-pill" style={{ color: b.status === 'active' ? '#22c55e' : '#ef4444', background: b.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
                                {b.status === 'active' ? '● Active' : '● Suspended'}
                              </span>
                            </td>
                            <td>
                              <button className={`pill-btn ${b.status === 'active' ? 'danger' : 'success'}`} onClick={() => toggleBuyerStatus(b.id, b.status === 'active' ? 'suspended' : 'active')}>
                                {b.status === 'active' ? 'Suspend' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ─── Orders ─── */}
            {tab === 'orders' && (
              <div className="section">
                <div className="section-title">All Platform Orders ({orders.length})</div>
                <div className="filter-row">
                  {['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(f => (
                    <button key={f} className={`pill-btn${orderFilter === f.toLowerCase() ? ' active-filter' : ''}`} onClick={() => { setOrderFilter(f.toLowerCase()); fetchOrders(f.toLowerCase()); }}>{f}</button>
                  ))}
                </div>
                {ordersLoading ? [1,2,3].map(i => <Skeleton key={i} height={52} />) : orders.length === 0 ? (
                  <EmptyState icon="📦" message="No orders found." />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead><tr><th>Product</th><th>Buyer</th><th>Seller</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                      <tbody>{orders.map(o => <AdminOrderRow key={o.id} order={o} />)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ─── Products ─── */}
            {tab === 'products' && (
              <div className="section">
                <div className="section-title">
                  All Products ({products.length})
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <SearchInput value={prodSearch} onChange={setProdSearch} onSearch={() => fetchProducts(prodSearch)} placeholder="Search products..." />
                  </div>
                </div>
                {productsLoading ? [1,2,3].map(i => <Skeleton key={i} height={52} />) : products.length === 0 ? (
                  <EmptyState icon="🏷" message="No products found." />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead><tr><th></th><th>Name</th><th>Seller</th><th>Category</th><th>Price</th><th>Stock</th><th>Sold</th><th>Rating</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>
                        {products.map(p => (
                          <tr key={p.id}>
                            <td style={{ fontSize: 22 }}>{p.emoji}</td>
                            <td style={{ fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                            <td style={{ color: 'var(--muted)' }}>{p.seller}</td>
                            <td style={{ color: 'var(--muted)' }}>{p.category}</td>
                            <td style={{ fontWeight: 600 }}>{fmt(p.price)}</td>
                            <td>{p.stock}</td>
                            <td>{p.soldCount}</td>
                            <td>{p.rating > 0 ? `★ ${p.rating}` : '—'}</td>
                            <td>
                              <span className="status-pill" style={{ color: p.isActive ? '#22c55e' : 'var(--muted)', background: p.isActive ? 'rgba(34,197,94,0.12)' : 'var(--card-alt)' }}>
                                {p.isActive ? '● Active' : '○ Hidden'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="pill-btn" onClick={() => toggleActive(p.id, !p.isActive)}>{p.isActive ? 'Hide' : 'Show'}</button>
                                <button className="pill-btn danger" onClick={() => { if(confirm('Delete this product?')) removeProduct(p.id); }}>Del</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ─── Audit Log ─── */}
            {tab === 'audit' && (
              <div className="section">
                <div className="section-title">Audit Log</div>
                {auditLoading ? [1,2,3,4].map(i => <Skeleton key={i} height={52} />) : logs.length === 0 ? (
                  <EmptyState icon="🔒" message="No audit logs yet." />
                ) : (
                  <table className="table">
                    <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Level</th></tr></thead>
                    <tbody>
                      {logs.map(l => (
                        <tr key={l.id}>
                          <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: 12 }}>{l.time}</td>
                          <td style={{ fontWeight: 600, fontSize: 12 }}>{l.user}</td>
                          <td style={{ fontSize: 12 }}>{l.action}</td>
                          <td style={{ color: 'var(--muted)', fontSize: 12 }}>{l.target}</td>
                          <td>
                            <span className="status-pill" style={{
                              color: l.level === 'error' ? '#ef4444' : l.level === 'warn' ? '#f59e0b' : 'var(--accent)',
                              background: l.level === 'error' ? 'rgba(239,68,68,0.12)' : l.level === 'warn' ? 'rgba(245,158,11,0.12)' : 'rgba(79,127,255,0.12)',
                            }}>{l.level.toUpperCase()}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ─── Settings ─── */}
            {tab === 'settings' && (
              <>
                <div className="section" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div className="avatar" style={{ width: 64, height: 64, fontSize: 22 }}>{user?.initials ?? 'A'}</div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>{user?.name ?? '—'}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{user?.email ?? '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 700, marginTop: 4 }}>🔒 Platform Administrator</div>
                  </div>
                </div>
                <div className="section">
                  <div className="section-title">Admin Settings</div>
                  {[
                    { label: 'Display Name', sub: user?.name ?? '—' },
                    { label: 'Email',        sub: user?.email ?? '—' },
                    { label: 'Change Password', sub: 'Update your admin password' },
                  ].map(row => (
                    <div key={row.label} className="settings-row">
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{row.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{row.sub}</div>
                      </div>
                      <button className="pill-btn">Edit</button>
                    </div>
                  ))}
                </div>
                <div className="section">
                  <div className="section-title">Platform Config</div>
                  {[
                    { label: 'Commission Rate',     sub: 'Platform fee per transaction' },
                    { label: 'Payout Schedule',     sub: 'Seller payout frequency' },
                    { label: 'Seller Verification', sub: 'KYC & onboarding requirements' },
                    { label: 'Maintenance Mode',    sub: 'Pause platform operations' },
                  ].map(row => (
                    <div key={row.label} className="settings-row">
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{row.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{row.sub}</div>
                      </div>
                      <button className="pill-btn">›</button>
                    </div>
                  ))}
                </div>
                <div className="section">
                  <button className="pill-btn danger" onClick={handleSignOut} style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 14 }}>Sign Out</button>
                </div>
              </>
            )}

          </main>
        </div>

        {/* ── Mobile Nav ── */}
        <nav className="ad-bottom-nav">
          {navItems.map(item => (
            <button key={item.id} className={`ad-bottom-btn${tab === item.id ? ' active' : ''}`} onClick={() => setTab(item.id)}>
              {item.badge && item.badge > 0 ? <span className="ad-mob-badge">{item.badge > 9 ? '9+' : item.badge}</span> : null}
              <span className="b-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

      </div>
    </>
  );
}

function AdminOrderRow({ order }: { order: AdminOrder }) {
  const s = statusConfig[order.status] ?? statusConfig.processing;
  return (
    <tr>
      <td><span style={{ marginRight: 8 }}>{order.emoji}</span>{order.product}</td>
      <td style={{ color: 'var(--muted)' }}>{order.buyer}</td>
      <td style={{ color: 'var(--muted)' }}>{order.seller}</td>
      <td style={{ fontWeight: 700 }}>{fmt(order.amount)}</td>
      <td><span className="status-pill" style={{ color: s.color, background: s.bg }}>{s.label.toUpperCase()}</span></td>
      <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: 12 }}>{order.date}</td>
    </tr>
  );
}
