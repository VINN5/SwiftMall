// frontend/src/pages/dashboards/SellerDashboard.tsx
import { useState, useEffect, useRef, useCallback } from 'react';

const API = 'https://swiftmall-backend.onrender.com/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface User      { name: string; email: string; phone: string; initials: string; storeName: string; }
interface Stats     { totalProducts: number; totalOrders: number; totalRevenue: number; pendingOrders: number; avgRating: number; totalReviews: number; }
interface Product   { id: string; name: string; description: string; price: number; originalPrice: number; category: string; emoji: string; image: string | null; stock: number; isActive: boolean; soldCount: number; rating: number; createdAt: string; }
interface Order     { id: string; product: string; buyer: string; date: string; status: 'delivered'|'shipped'|'processing'|'cancelled'; amount: number; emoji: string; qty: number; }
interface Review    { id: string; product: string; buyer: string; rating: number; comment: string; date: string; }
interface Payout    { id: string; amount: number; status: 'paid'|'pending'|'processing'; date: string; method: string; }
interface Analytics { labels: string[]; revenue: number[]; orders: number[]; }

const STATUS_CFG: Record<Order['status'], { label: string; color: string; bg: string }> = {
  delivered:  { label: 'Delivered',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  shipped:    { label: 'Shipped',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  processing: { label: 'Processing', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  cancelled:  { label: 'Cancelled',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const PAYOUT_CFG: Record<Payout['status'], { color: string; bg: string }> = {
  paid:       { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  pending:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  processing: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
};

const fmt = (n: number) => `KES ${n.toLocaleString()}`;

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useUser() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    fetch(`${API}/seller/me`, { headers: authHeaders() }).then(r => r.json()).then(d => {
      if (d.username) {
        const initials = d.username.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
        setUser({ name: d.username, email: d.email, phone: d.phone || '', initials: initials || '?', storeName: d.store_name || d.username });
      }
    }).catch(() => {});
  }, []);
  return { user };
}

function useStats() {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/seller/stats`, { headers: authHeaders() }).then(r => r.json()).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch_ = useCallback(() => {
    setLoading(true);
    fetch(`${API}/seller/products`, { headers: authHeaders() }).then(r => r.json()).then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetch_(); }, [fetch_]);
  const toggle = async (id: string, isActive: boolean) => {
    setProducts(p => p.map(x => x.id === id ? { ...x, isActive } : x));
    await fetch(`${API}/seller/products/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ is_active: isActive }) });
  };
  const remove = async (id: string) => {
    setProducts(p => p.filter(x => x.id !== id));
    await fetch(`${API}/seller/products/${id}`, { method: 'DELETE', headers: authHeaders() });
  };
  return { products, loading, refetch: fetch_, toggle, remove };
}

function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchOrders = useCallback((status = 'all') => {
    setLoading(true);
    fetch(`${API}/seller/orders?status=${status}`, { headers: authHeaders() }).then(r => r.json()).then(setOrders).catch(() => setOrders([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  const updateStatus = async (id: string, status: Order['status']) => {
    setOrders(p => p.map(o => o.id === id ? { ...o, status } : o));
    await fetch(`${API}/seller/orders/${id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }) });
  };
  return { orders, loading, fetchOrders, updateStatus };
}

function useReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/seller/reviews`, { headers: authHeaders() }).then(r => r.json()).then(setReviews).catch(() => setReviews([])).finally(() => setLoading(false));
  }, []);
  return { reviews, loading };
}

function usePayouts() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/seller/payouts`, { headers: authHeaders() }).then(r => r.json()).then(setPayouts).catch(() => setPayouts([])).finally(() => setLoading(false));
  }, []);
  return { payouts, loading };
}

function useAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/seller/analytics?period=${period}`, { headers: authHeaders() }).then(r => r.json()).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [period]);
  return { data, loading, period, setPeriod };
}

// ─── Small components ─────────────────────────────────────────────────────────
function Skeleton({ height = 60, radius = 10 }: { height?: number; radius?: number }) {
  return <div style={{ height, borderRadius: radius, marginBottom: 10, background: 'linear-gradient(90deg,var(--border) 25%,var(--card-alt) 50%,var(--border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />;
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--muted)' }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{message}</div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, loading, accent }: { icon: string; label: string; value?: string; sub?: string; loading: boolean; accent?: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, borderRadius: '0 14px 0 60px', background: accent ? `${accent}18` : 'rgba(34,211,238,0.06)' }} />
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600, lineHeight: 1.2 }}>{label}</div>
      {loading ? <Skeleton height={22} radius={6} /> : <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text)', lineHeight: 1.1 }}>{value ?? '—'}</div>}
      {sub && !loading && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{sub}</div>}
    </div>
  );
}

function MiniChart({ data, color = 'var(--accent)' }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const pts  = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 80}`).join(' ');
  const area = `0,100 ${pts} 100,100`;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 60 }}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#cg)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Stars({ rating }: { rating: number }) {
  return <span style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 1 }}>{Array.from({ length: 5 }, (_, i) => i < Math.round(rating) ? '★' : '☆').join('')}</span>;
}

// ── Image Upload component ────────────────────────────────────────────────────
function ImageUpload({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const handleFile = (file: File) => {
    setError('');
    if (file.size > 2 * 1024 * 1024) { setError('Image must be under 2 MB'); return; }
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return; }
    const reader = new FileReader();
    reader.onload = e => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Product Photo (optional)
      </label>

      {value ? (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
          <img src={value} alt="preview" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)', display: 'block' }} />
          <button
            onClick={() => onChange(null)}
            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            ✕
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ position: 'absolute', bottom: 8, right: 8, padding: '5px 12px', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600 }}>
            Change
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '22px 16px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s', background: 'var(--card-alt)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>📷</div>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Tap to upload or drag & drop</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>JPEG, PNG, WebP · Max 2 MB</div>
        </div>
      )}

      {error && <div style={{ marginTop: 6, fontSize: 12, color: '#ef4444' }}>{error}</div>}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

// ── Product Modal ─────────────────────────────────────────────────────────────
function ProductModal({ onClose, onSave, editing }: { onClose: () => void; onSave: (data: Record<string, unknown>) => Promise<void>; editing?: Product | null }) {
  const [form, setForm] = useState({
    name:          editing?.name ?? '',
    description:   editing?.description ?? '',
    price:         String(editing?.price ?? ''),
    originalPrice: String(editing?.originalPrice ?? ''),
    category:      editing?.category ?? '',
    emoji:         editing?.emoji ?? '🛍',
    stock:         String(editing?.stock ?? ''),
  });
  const [image, setImage] = useState<string | null>(editing?.image ?? null);
  const [saving, setSaving] = useState(false);

  const handle = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) return;
    if (!form.price || Number(form.price) <= 0) return;
    setSaving(true);
    await onSave({
      name:           form.name,
      description:    form.description,
      price:          Number(form.price),
      original_price: Number(form.originalPrice) || Number(form.price),
      category:       form.category,
      emoji:          form.emoji,
      stock:          Number(form.stock),
      image:          image,
    });
    setSaving(false);
    onClose();
  };

  const fields: [string, string, string][] = [
    ['Product Name *', 'name', 'text'],
    ['Description', 'description', 'text'],
    ['Price (KES) *', 'price', 'number'],
    ['Original / Compare Price (KES)', 'originalPrice', 'number'],
    ['Category', 'category', 'text'],
    ['Emoji Icon', 'emoji', 'text'],
    ['Stock Quantity', 'stock', 'number'],
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      {/* Bottom sheet on mobile, centered modal on desktop */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px 20px 0 0', padding: '20px 18px 32px', width: '100%', maxWidth: 580, maxHeight: '93vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', alignSelf: 'center', marginBottom: 4 }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>{editing ? '✏️ Edit Product' : '➕ New Product'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, padding: 4 }}>✕</button>
        </div>

        {/* Image upload */}
        <ImageUpload value={image} onChange={setImage} />

        {/* Text fields */}
        {fields.map(([label, key, type]) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</label>
            <input
              type={type}
              value={(form as Record<string, string>)[key]}
              onChange={e => handle(key, e.target.value)}
              style={{ width: '100%', padding: '12px 14px', background: 'var(--card-alt)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 16, outline: 'none' }}
            />
          </div>
        ))}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px 0', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14 }}>Cancel</button>
          <button onClick={submit} disabled={saving || !form.name || !form.price}
            style={{ flex: 2, padding: '14px 0', borderRadius: 12, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)', color: saving ? 'var(--muted)' : 'var(--bg)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14 }}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
type Tab = 'overview'|'products'|'orders'|'analytics'|'reviews'|'payouts'|'settings';

export default function SellerDashboard() {
  const [tab, setTab]               = useState<Tab>('overview');
  const [orderFilter, setOrderFilter] = useState('all');
  const [showModal, setShowModal]   = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const { user }                                              = useUser();
  const { data: stats, loading: statsLoading }                = useStats();
  const { products, loading: prodLoading, refetch, toggle, remove } = useProducts();
  const { orders, loading: ordersLoading, fetchOrders, updateStatus } = useOrders();
  const { reviews, loading: reviewsLoading }                  = useReviews();
  const { payouts, loading: payoutsLoading }                  = usePayouts();
  const { data: analytics, loading: analyticsLoading, period, setPeriod } = useAnalytics();

  const today = new Date().toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric' });

  const saveProduct = async (data: Record<string, unknown>) => {
    if (editingProduct) {
      await fetch(`${API}/seller/products/${editingProduct.id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(data) });
    } else {
      await fetch(`${API}/seller/products`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
    }
    refetch();
    setEditingProduct(null);
  };

  const navItems: { id: Tab; icon: string; label: string; badge?: number }[] = [
    { id: 'overview',  icon: '⊞',  label: 'Overview' },
    { id: 'products',  icon: '🏷',  label: 'Products', badge: products.length },
    { id: 'orders',    icon: '📦', label: 'Orders',   badge: orders.filter(o => o.status === 'processing').length },
    { id: 'analytics', icon: '📈', label: 'Analytics' },
    { id: 'reviews',   icon: '⭐', label: 'Reviews' },
    { id: 'payouts',   icon: '💳', label: 'Payouts' },
    { id: 'settings',  icon: '⚙',  label: 'Settings' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@500;700;800;900&family=Satoshi:wght@400;500;600;700&display=swap');
        :root {
          --bg:#080b12;--card:#0e1119;--card-alt:#131720;--border:#1c2133;
          --text:#e8ecf5;--muted:#5a6380;--accent:#22d1b0;--accent2:#7b5ea7;--danger:#ef4444;
          --sidebar-w:240px;--topbar-h:60px;--nav-h:66px;
          --font-display:'Cabinet Grotesk',sans-serif;--font-body:'Satoshi',sans-serif;
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{height:100%;background:var(--bg);}
        body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}

        /* Prevent zoom on input focus on iOS */
        input,select,textarea{font-size:16px;}

        .sd{display:flex;min-height:100vh;background:var(--bg);color:var(--text);font-family:var(--font-body);}

        /* ── Sidebar (desktop only) ── */
        .sd-sidebar{width:var(--sidebar-w);min-height:100vh;background:var(--card);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;z-index:40;}
        .sd-logo{padding:22px 20px;border-bottom:1px solid var(--border);}
        .sd-sidebar nav{flex:1;padding:12px 10px;display:flex;flex-direction:column;gap:2px;overflow-y:auto;}
        .nav-btn{display:flex;align-items:center;gap:11px;padding:10px 13px;border-radius:10px;border:none;background:transparent;color:var(--muted);font-family:var(--font-body);font-size:14px;font-weight:500;cursor:pointer;transition:all .15s;width:100%;text-align:left;}
        .nav-btn:hover{background:var(--card-alt);color:var(--text);}
        .nav-btn.on{background:rgba(34,209,176,.1);color:var(--accent);}
        .nav-icon{font-size:17px;width:20px;text-align:center;flex-shrink:0;}
        .nav-badge{margin-left:auto;background:var(--accent);color:var(--bg);font-size:10px;font-weight:800;border-radius:999px;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;padding:0 4px;}
        .sd-user{padding:14px 18px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;}

        /* ── Main area ── */
        .sd-main{flex:1;display:flex;flex-direction:column;margin-left:var(--sidebar-w);min-height:100vh;}

        /* ── Topbar ── */
        .topbar{height:var(--topbar-h);background:var(--card);border-bottom:1px solid var(--border);padding:0 28px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:30;}

        /* ── Content area ── */
        .content{flex:1;padding:24px 28px;display:flex;flex-direction:column;gap:20px;max-width:1200px;width:100%;}

        /* ── Grids ── */
        .stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
        .prod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;}
        .order-list{display:flex;flex-direction:column;gap:10px;}

        /* ── Sections ── */
        .section{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;}
        .section-title{font-family:var(--font-display);font-size:15px;font-weight:700;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}

        /* ── Pills / Filters ── */
        .pill{padding:7px 14px;border-radius:999px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-size:12px;font-weight:600;font-family:var(--font-body);transition:all .15s;white-space:nowrap;-webkit-tap-highlight-color:transparent;}
        .pill:hover{border-color:var(--accent);color:var(--accent);}
        .pill.on{background:var(--accent);border-color:var(--accent);color:var(--bg);}
        .pill.primary{background:var(--accent);border-color:var(--accent);color:var(--bg);}
        .pill.danger{border-color:var(--danger);color:var(--danger);}
        .pill.danger:hover{background:rgba(239,68,68,.08);}

        /* ── Filter row ── */
        .filter-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;margin-bottom:16px;-webkit-overflow-scrolling:touch;}
        .filter-row::-webkit-scrollbar{display:none;}

        /* ── Avatar ── */
        .avatar{border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--bg);flex-shrink:0;font-family:var(--font-display);}

        /* ── Toggle switch ── */
        .toggle{position:relative;display:inline-block;width:38px;height:22px;flex-shrink:0;}
        .toggle input{opacity:0;width:0;height:0;}
        .toggle-slider{position:absolute;inset:0;background:var(--border);border-radius:22px;cursor:pointer;transition:.2s;}
        .toggle-slider:before{content:'';position:absolute;width:16px;height:16px;left:3px;top:3px;background:var(--muted);border-radius:50%;transition:.2s;}
        input:checked+.toggle-slider{background:var(--accent);}
        input:checked+.toggle-slider:before{transform:translateX(16px);background:var(--bg);}

        /* ── Settings rows ── */
        .settings-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border);gap:12px;}
        .settings-row:last-of-type{border-bottom:none;}

        /* ── Mobile nav ── */
        .mob-nav{display:none;}

        /* ── Animations ── */
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

        /* ════════════════════════════════════
           MOBILE BREAKPOINT — max-width 768px
           ════════════════════════════════════ */
        @media(max-width:768px){
          /* Hide sidebar, shift main */
          .sd-sidebar{display:none;}
          .sd-main{margin-left:0;padding-bottom:calc(var(--nav-h) + env(safe-area-inset-bottom, 0px));}

          /* Topbar — slimmer, no email */
          .topbar{height:54px;padding:0 14px;}
          .topbar-email{display:none;}

          /* Content padding */
          .content{padding:12px 12px;gap:12px;}

          /* Stats: 2 columns on phone */
          .stats-grid{grid-template-columns:1fr 1fr;gap:8px;}

          /* Products: 2 columns */
          .prod-grid{grid-template-columns:1fr 1fr;gap:10px;}

          /* Section padding */
          .section{padding:14px 12px;border-radius:14px;}
          .section-title{font-size:14px;margin-bottom:14px;}

          /* Bottom nav */
          .mob-nav{
            display:flex;
            position:fixed;
            bottom:0;left:0;right:0;
            height:var(--nav-h);
            padding-bottom:env(safe-area-inset-bottom, 0px);
            background:var(--card);
            border-top:1px solid var(--border);
            z-index:40;
            overflow-x:auto;
            scrollbar-width:none;
          }
          .mob-nav::-webkit-scrollbar{display:none;}
          .mob-btn{
            flex:1 0 auto;
            min-width:52px;
            max-width:80px;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            gap:3px;
            border:none;
            background:transparent;
            cursor:pointer;
            color:var(--muted);
            font-family:var(--font-body);
            font-size:9px;
            font-weight:600;
            position:relative;
            transition:color .15s;
            padding:0 6px;
            -webkit-tap-highlight-color:transparent;
          }
          .mob-btn.on{color:var(--accent);}
          .mob-btn .bi{font-size:19px;line-height:1;}
          .mob-badge{
            position:absolute;
            top:6px;right:calc(50% - 16px);
            background:var(--accent);
            color:var(--bg);
            font-size:8px;
            font-weight:800;
            border-radius:999px;
            min-width:15px;
            height:15px;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:0 3px;
          }

          /* Order rows: stack action button */
          .order-action-btn{width:100%;margin-top:8px;margin-left:0!important;}

          /* Product card adjustments */
          .prod-card-img{height:120px!important;}
          .prod-card-info{padding:10px!important;}
          .prod-card-name{font-size:12px!important;}
          .prod-card-sub{font-size:10px!important;}
          .prod-card-price{font-size:12px!important;}

          /* Welcome heading */
          .welcome-heading{font-size:18px!important;}

          /* Hide non-critical topbar items */
          .topbar-store-name{font-size:12px!important;}
        }

        /* ── Very small screens ── */
        @media(max-width:360px){
          .stats-grid{grid-template-columns:1fr 1fr;gap:6px;}
          .content{padding:10px;gap:10px;}
          .mob-btn{min-width:44px;font-size:8px;}
        }

        /* ── Tablet breakpoint ── */
        @media(min-width:769px) and (max-width:1024px){
          :root{--sidebar-w:200px;}
          .content{padding:20px 22px;gap:18px;}
          .stats-grid{grid-template-columns:repeat(3,1fr);}
        }
      `}</style>

      {showModal && (
        <ProductModal
          editing={editingProduct}
          onClose={() => { setShowModal(false); setEditingProduct(null); }}
          onSave={saveProduct}
        />
      )}

      <div className="sd">
        {/* Sidebar (desktop) */}
        <aside className="sd-sidebar">
          <div className="sd-logo">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20 }}>Swift<span style={{ color: 'var(--accent)' }}>Mall</span></div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>Seller Portal</div>
          </div>
          <nav>
            {navItems.map(n => (
              <button key={n.id} className={`nav-btn${tab === n.id ? ' on' : ''}`} onClick={() => setTab(n.id)}>
                <span className="nav-icon">{n.icon}</span>
                <span>{n.label}</span>
                {n.badge && n.badge > 0 ? <span className="nav-badge">{n.badge > 99 ? '99+' : n.badge}</span> : null}
              </button>
            ))}
          </nav>
          <div className="sd-user">
            <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>{user?.initials ?? '?'}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.storeName ?? '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--accent)' }}>Seller</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="sd-main">
          <header className="topbar">
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{navItems.find(n => n.id === tab)?.label}</h1>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{today}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign: 'right' }} className="topbar-email">
                <div className="topbar-store-name" style={{ fontSize: 13, fontWeight: 600 }}>{user?.storeName ?? '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.email ?? ''}</div>
              </div>
              <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{user?.initials ?? '?'}</div>
            </div>
          </header>

          <main className="content">

            {/* ── Overview ── */}
            {tab === 'overview' && (
              <>
                <div>
                  <div className="welcome-heading" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900, lineHeight: 1.2 }}>
                    {user ? `Welcome, ${user.storeName.split(' ')[0]} 👋` : 'Your Store Dashboard'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5 }}>Here's your store at a glance.</div>
                </div>
                <div className="stats-grid">
                  <StatCard icon="📦" label="Total Orders"   value={stats ? String(stats.totalOrders)   : undefined} loading={statsLoading} accent="var(--accent)" />
                  <StatCard icon="💰" label="Revenue"        value={stats ? fmt(stats.totalRevenue)     : undefined} loading={statsLoading} accent="#22c55e" />
                  <StatCard icon="⏳" label="Pending"        value={stats ? String(stats.pendingOrders) : undefined} loading={statsLoading} accent="#f59e0b" />
                  <StatCard icon="🏷" label="Products"       value={stats ? String(stats.totalProducts) : undefined} loading={statsLoading} accent="var(--accent2)" />
                  <StatCard icon="⭐" label="Avg Rating"     value={stats ? `${stats.avgRating}/5` : undefined} sub={stats ? `${stats.totalReviews} reviews` : undefined} loading={statsLoading} accent="#f59e0b" />
                  <StatCard icon="💳" label="Next Payout"    value="—" loading={false} />
                </div>
                <div className="section">
                  <div className="section-title">Revenue Trend <button className="pill" onClick={() => setTab('analytics')}>Full Analytics</button></div>
                  {analyticsLoading ? <Skeleton height={70} /> : analytics ? <MiniChart data={analytics.revenue} color="var(--accent)" /> : <EmptyState icon="📈" message="No data yet" />}
                </div>
                <div className="section">
                  <div className="section-title">Recent Orders <button className="pill" onClick={() => setTab('orders')}>See All</button></div>
                  {ordersLoading
                    ? [1,2,3].map(i => <Skeleton key={i} height={72} />)
                    : orders.length === 0
                      ? <EmptyState icon="📦" message="No orders yet." />
                      : <div className="order-list">{orders.slice(0, 4).map(o => <OrderRow key={o.id} order={o} onStatusChange={updateStatus} />)}</div>
                  }
                </div>
              </>
            )}

            {/* ── Products ── */}
            {tab === 'products' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--muted)' }}>{products.length} product{products.length !== 1 ? 's' : ''}</div>
                  <button className="pill primary" onClick={() => { setEditingProduct(null); setShowModal(true); }}>+ Add Product</button>
                </div>
                {prodLoading
                  ? <div className="prod-grid">{[1,2,3,4].map(i => <Skeleton key={i} height={280} radius={14} />)}</div>
                  : products.length === 0
                    ? <EmptyState icon="🏷" message="No products yet. Add your first product!" />
                    : <div className="prod-grid">{products.map(p => (
                        <ProductCard key={p.id} product={p} onToggle={toggle} onEdit={() => { setEditingProduct(p); setShowModal(true); }} onDelete={remove} />
                      ))}</div>
                }
              </>
            )}

            {/* ── Orders ── */}
            {tab === 'orders' && (
              <div className="section">
                <div className="section-title">Orders</div>
                <div className="filter-row">
                  {['All','Processing','Shipped','Delivered','Cancelled'].map(f => (
                    <button key={f} className={`pill${orderFilter === f.toLowerCase() ? ' on' : ''}`} onClick={() => { setOrderFilter(f.toLowerCase()); fetchOrders(f.toLowerCase()); }}>{f}</button>
                  ))}
                </div>
                {ordersLoading
                  ? [1,2,3].map(i => <Skeleton key={i} height={80} />)
                  : orders.length === 0
                    ? <EmptyState icon="📦" message="No orders found." />
                    : <div className="order-list">{orders.map(o => <OrderRow key={o.id} order={o} onStatusChange={updateStatus} showActions />)}</div>
                }
              </div>
            )}

            {/* ── Analytics ── */}
            {tab === 'analytics' && (
              <>
                <div className="filter-row">
                  {[['7d','7 Days'],['30d','30 Days'],['90d','3 Months'],['365d','1 Year']].map(([v, l]) => (
                    <button key={v} className={`pill${period === v ? ' on' : ''}`} onClick={() => setPeriod(v)}>{l}</button>
                  ))}
                </div>
                <div className="section">
                  <div className="section-title">Revenue</div>
                  {analyticsLoading ? <Skeleton height={90} /> : analytics ? <>
                    <MiniChart data={analytics.revenue} color="var(--accent)" />
                    <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                      {analytics.labels.slice(-5).map((l, i) => (
                        <div key={i} style={{ fontSize: 11, color: 'var(--muted)' }}>
                          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt(analytics.revenue[i])}</span><br />{l}
                        </div>
                      ))}
                    </div>
                  </> : <EmptyState icon="📈" message="No analytics data." />}
                </div>
                <div className="section">
                  <div className="section-title">Order Volume</div>
                  {analyticsLoading ? <Skeleton height={90} /> : analytics ? <MiniChart data={analytics.orders} color="var(--accent2)" /> : <EmptyState icon="📦" message="No data." />}
                </div>
              </>
            )}

            {/* ── Reviews ── */}
            {tab === 'reviews' && (
              <div className="section">
                <div className="section-title">
                  <span>Customer Reviews</span>
                  {stats && <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Stars rating={stats.avgRating} />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{stats.avgRating}/5 · {stats.totalReviews}</span>
                  </div>}
                </div>
                {reviewsLoading ? [1,2,3].map(i => <Skeleton key={i} height={80} />) : reviews.length === 0 ? <EmptyState icon="⭐" message="No reviews yet." /> : reviews.map(r => <ReviewRow key={r.id} review={r} />)}
              </div>
            )}

            {/* ── Payouts ── */}
            {tab === 'payouts' && (
              <>
                <div className="stats-grid">
                  <StatCard icon="💰" label="Total Earned"  value={payouts.filter(p=>p.status==='paid').reduce((a,b)=>a+b.amount,0) > 0 ? fmt(payouts.filter(p=>p.status==='paid').reduce((a,b)=>a+b.amount,0)) : '—'} loading={payoutsLoading} />
                  <StatCard icon="⏳" label="Pending"       value={payouts.filter(p=>p.status==='pending').reduce((a,b)=>a+b.amount,0) > 0 ? fmt(payouts.filter(p=>p.status==='pending').reduce((a,b)=>a+b.amount,0)) : '—'} loading={payoutsLoading} />
                  <StatCard icon="📋" label="Total Payouts" value={String(payouts.length)} loading={payoutsLoading} />
                </div>
                <div className="section">
                  <div className="section-title">Payout History</div>
                  {payoutsLoading ? [1,2,3].map(i => <Skeleton key={i} height={64} />) : payouts.length === 0 ? <EmptyState icon="💳" message="No payouts yet." /> : payouts.map(p => <PayoutRow key={p.id} payout={p} />)}
                </div>
              </>
            )}

            {/* ── Settings ── */}
            {tab === 'settings' && (
              <>
                <div className="section" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="avatar" style={{ width: 56, height: 56, fontSize: 20, flexShrink: 0 }}>{user?.initials ?? '?'}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.storeName ?? '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email ?? '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 3 }}>Verified Seller</div>
                  </div>
                </div>
                <div className="section">
                  <div className="section-title">Store Info</div>
                  {[{ label: 'Store Name', sub: user?.storeName ?? '—' }, { label: 'Email', sub: user?.email ?? '—' }, { label: 'Phone', sub: user?.phone || 'Not set' }].map(row => (
                    <div key={row.label} className="settings-row">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{row.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.sub}</div>
                      </div>
                      <button className="pill" style={{ flexShrink: 0 }}>Edit</button>
                    </div>
                  ))}
                </div>
                <div className="section">
                  <div className="section-title">Preferences</div>
                  {[{ label: 'Payout Method', sub: 'M-Pesa / Bank account' }, { label: 'Notifications', sub: 'Order alerts & promotions' }, { label: 'Change Password', sub: 'Update your password' }].map(row => (
                    <div key={row.label} className="settings-row">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{row.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{row.sub}</div>
                      </div>
                      <button className="pill" style={{ flexShrink: 0 }}>›</button>
                    </div>
                  ))}
                </div>
                <div className="section">
                  <button className="pill danger" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/login'; }}
                    style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 14 }}>
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </main>
        </div>

        {/* ── Mobile bottom nav ── */}
        <nav className="mob-nav">
          {navItems.map(n => (
            <button key={n.id} className={`mob-btn${tab === n.id ? ' on' : ''}`} onClick={() => setTab(n.id)}>
              {n.badge && n.badge > 0 ? <span className="mob-badge">{n.badge > 9 ? '9+' : n.badge}</span> : null}
              <span className="bi">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}

// ─── Helper sub-components ────────────────────────────────────────────────────
function OrderRow({ order, onStatusChange, showActions }: { order: Order; onStatusChange: (id: string, s: Order['status']) => void; showActions?: boolean }) {
  const s    = STATUS_CFG[order.status] ?? STATUS_CFG.processing;
  const next = ({ processing: 'shipped', shipped: 'delivered', delivered: null, cancelled: null } as Record<string, Order['status'] | null>)[order.status];
  return (
    <div style={{ background: 'var(--card-alt)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 12 }}>
      <span style={{ fontSize: 24, flexShrink: 0, lineHeight: 1.4 }}>{order.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.product}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>
          {order.id.slice(-6)} · {order.buyer} · Qty: {order.qty}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{order.date}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>{s.label.toUpperCase()}</span>
          <span style={{ fontWeight: 800, fontSize: 13 }}>{fmt(order.amount)}</span>
          {showActions && next && (
            <button
              onClick={() => onStatusChange(order.id, next)}
              className="order-action-btn"
              style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
              Mark {next.charAt(0).toUpperCase() + next.slice(1)} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product: p, onToggle, onEdit, onDelete }: { product: Product; onToggle: (id: string, v: boolean) => void; onEdit: () => void; onDelete: (id: string) => void }) {
  const disc = p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
  return (
    <div style={{ background: 'var(--card-alt)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: p.isActive ? 1 : 0.55 }}>
      {/* Image */}
      <div className="prod-card-img" style={{ height: 140, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        {p.image
          ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 44 }}>{p.emoji}</span>
        }
        {disc > 0 && <span style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent2)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 999 }}>{disc}% OFF</span>}
        {!p.isActive && <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,11,18,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff', fontSize: 10, fontWeight: 700, background: 'rgba(0,0,0,0.6)', padding: '3px 8px', borderRadius: 6 }}>HIDDEN</span></div>}
      </div>

      {/* Info */}
      <div className="prod-card-info" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div>
          <div className="prod-card-name" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
          <div className="prod-card-sub" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Stock: {p.stock}</div>
        </div>
        {p.rating > 0 && <div style={{ fontSize: 10, color: 'var(--muted)' }}>★ {p.rating} ({p.soldCount} sold)</div>}
        <div style={{ display: 'flex', gap: 5, alignItems: 'baseline' }}>
          <span className="prod-card-price" style={{ fontWeight: 800, fontSize: 13 }}>{fmt(p.price)}</span>
          {disc > 0 && <span style={{ fontSize: 10, color: 'var(--muted)', textDecoration: 'line-through' }}>{fmt(p.originalPrice)}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
          <label className="toggle" title={p.isActive ? 'Active' : 'Inactive'}>
            <input type="checkbox" checked={p.isActive} onChange={e => onToggle(p.id, e.target.checked)} />
            <span className="toggle-slider" />
          </label>
          <span style={{ fontSize: 10, color: 'var(--muted)', flex: 1 }}>{p.isActive ? 'Active' : 'Hidden'}</span>
          <button onClick={onEdit} style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-body)' }}>Edit</button>
          <button onClick={() => onDelete(p.id)} style={{ padding: '4px 7px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', fontSize: 11 }}>🗑</button>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ review: r }: { review: Review }) {
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 5, gap: 8 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{r.buyer}</span>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>on {r.product}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <Stars rating={r.rating} />
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{r.date}</div>
        </div>
      </div>
      {r.comment && <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{r.comment}</div>}
    </div>
  );
}

function PayoutRow({ payout: p }: { payout: Payout }) {
  const s = PAYOUT_CFG[p.status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>💳</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(p.amount)}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.method} · {p.date}</div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, color: s.color, background: s.bg, flexShrink: 0 }}>{p.status.toUpperCase()}</span>
    </div>
  );
}
