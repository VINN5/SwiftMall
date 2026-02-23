// frontend/src/pages/dashboards/BuyerDashboard.tsx
import { useState, useEffect, useRef, useCallback } from 'react';

const API = 'https://swiftmall-backend.onrender.com/api';
function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface User         { name: string; email: string; phone: string; initials: string; }
interface Order        { id: string; product: string; seller: string; date: string; status: 'delivered'|'shipped'|'processing'|'cancelled'; amount: number; emoji: string; }
interface WishlistItem { id: string; name: string; price: number; originalPrice: number; emoji: string; image?: string | null; inStock: boolean; }
interface Notification { id: string; message: string; time: string; read: boolean; type: 'order'|'promo'|'system'; }
interface Stats        { totalOrders: number; totalSpent: number; wishlistCount: number; reviewsGiven: number; }
interface Product      { id: string; name: string; price: number; originalPrice: number; category: string; seller: string; emoji: string; image?: string | null; inStock: boolean; rating: number; soldCount: number; stock: number; }
interface SearchResult { total: number; page: number; pages: number; results: Product[]; }
interface Suggestion   { name: string; category: string; price: number; }
interface CartItem     { id: string; productId: string; name: string; emoji: string; image?: string | null; price: number; sellerName: string; quantity: number; stock: number; inStock: boolean; }

const STATUS_CFG = {
  delivered:  { label: 'Delivered',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  shipped:    { label: 'Shipped',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  processing: { label: 'Processing', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  cancelled:  { label: 'Cancelled',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
} as const;

const fmt = (n: number) => `KES ${n.toLocaleString()}`;

// ── Reusable product thumbnail ─────────────────────────────────────────────
function ProductThumb({ image, emoji, size = 48 }: { image?: string | null; emoji: string; size?: number }) {
  if (image) {
    return (
      <img src={image} alt="" style={{ width: size, height: size, objectFit: 'cover', borderRadius: size * 0.18, flexShrink: 0, border: '1px solid var(--border)' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    );
  }
  return <span style={{ fontSize: size * 0.6, flexShrink: 0, lineHeight: 1 }}>{emoji}</span>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useUser() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        const s = JSON.parse(raw);
        const name = s.username || s.name || '';
        setUser({ name, email: s.email || '', phone: s.phone || '', initials: name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0,2) || '?' });
      } catch {}
    }
    fetch(`${API}/buyer/me`, { headers: authHeaders() }).then(r => r.json()).then(d => {
      if (d.username) setUser({ name: d.username, email: d.email, phone: d.phone || '', initials: d.username.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0,2) || '?' });
    }).catch(() => {});
  }, []);
  return user;
}

function useStats() {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/buyer/stats`, { headers: authHeaders() }).then(r => r.json()).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch_ = useCallback((status = 'all') => {
    setLoading(true);
    fetch(`${API}/buyer/orders?status=${status}`, { headers: authHeaders() }).then(r => r.json()).then(setOrders).catch(() => setOrders([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetch_(); }, [fetch_]);
  return { orders, loading, refetch: fetch_ };
}

function useWishlist() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/buyer/wishlist`, { headers: authHeaders() }).then(r => r.json()).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);
  const remove = async (id: string) => {
    setItems(p => p.filter(i => i.id !== id));
    fetch(`${API}/buyer/wishlist/${id}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {});
  };
  return { items, loading, remove };
}

function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/buyer/notifications`, { headers: authHeaders() }).then(r => r.json()).then(setNotifications).catch(() => setNotifications([])).finally(() => setLoading(false));
  }, []);
  const markAllRead = () => {
    setNotifications(p => p.map(n => ({ ...n, read: true })));
    fetch(`${API}/buyer/notifications/read-all`, { method: 'PATCH', headers: authHeaders() }).catch(() => {});
  };
  return { notifications, loading, markAllRead };
}

function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(() => {
    setLoading(true);
    fetch(`${API}/buyer/cart`, { headers: authHeaders() }).then(r => r.json()).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { refetch(); }, [refetch]);

  const addToCart = async (productId: string, qty = 1) => {
    const res = await fetch(`${API}/buyer/cart`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ product_id: productId, quantity: qty }) });
    if (res.ok) { refetch(); return true; }
    const e = await res.json(); alert(e.error || 'Could not add to cart'); return false;
  };
  const updateQty = async (id: string, quantity: number) => {
    setItems(p => p.map(i => i.id === id ? { ...i, quantity } : i));
    fetch(`${API}/buyer/cart/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ quantity }) }).catch(() => {});
  };
  const remove = async (id: string) => {
    setItems(p => p.filter(i => i.id !== id));
    fetch(`${API}/buyer/cart/${id}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {});
  };
  const clear = async () => { setItems([]); fetch(`${API}/buyer/cart/clear`, { method: 'DELETE', headers: authHeaders() }).catch(() => {}); };

  const total     = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  return { items, loading, refetch, addToCart, updateQty, remove, clear, total, itemCount };
}

function useSearch() {
  const [query, setQuery]             = useState('');
  const [results, setResults]         = useState<SearchResult | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [categories, setCategories]   = useState<string[]>([]);
  const [loading, setLoading]         = useState(false);
  const [category, setCategory]       = useState('');
  const [sort, setSort]               = useState('relevance');
  const [page, setPage]               = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => { fetch(`${API}/search/categories`).then(r => r.json()).then(setCategories).catch(() => {}); }, []);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.length < 2) { setSuggestions([]); return; }
    timer.current = setTimeout(() => {
      fetch(`${API}/search/suggestions?q=${encodeURIComponent(query)}`).then(r => r.json()).then(setSuggestions).catch(() => {});
    }, 280);
  }, [query]);

  const search = useCallback((q = query, cat = category, s = sort, p = 1) => {
    if (!q.trim() && !cat) return;
    setLoading(true); setSuggestions([]);
    fetch(`${API}/search/products?${new URLSearchParams({ q, category: cat, sort: s, page: String(p), per_page: '20' })}`)
      .then(r => r.json()).then(d => { setResults(d); setPage(p); }).catch(() => setResults(null)).finally(() => setLoading(false));
  }, [query, category, sort]);

  return { query, setQuery, results, suggestions, setSuggestions, categories, loading, category, setCategory, sort, setSort, page, search, changePage: (p: number) => search(query, category, sort, p) };
}

// ─── Small components ─────────────────────────────────────────────────────────
const Empty = ({ icon, msg }: { icon: string; msg: string }) => (
  <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--muted)' }}>
    <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
    <div style={{ fontSize: 13 }}>{msg}</div>
  </div>
);

const Skel = ({ h = 60, r = 10 }: { h?: number; r?: number }) => (
  <div style={{ height: h, borderRadius: r, marginBottom: 10, background: 'linear-gradient(90deg,var(--border) 25%,var(--card-alt) 50%,var(--border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
);

function StatCard({ icon, label, value, loading }: { icon: string; label: string; value?: string; loading: boolean }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600, lineHeight: 1.2 }}>{label}</div>
      {loading ? <Skel h={22} r={6} /> : <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{value ?? '—'}</div>}
    </div>
  );
}

function OrderCard({ o }: { o: Order }) {
  const s = STATUS_CFG[o.status] ?? STATUS_CFG.processing;
  return (
    <div style={{ background: 'var(--card-alt)', border: '1px solid var(--border)', borderRadius: 13, padding: '12px 14px', display: 'flex', gap: 12 }}>
      <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1.4 }}>{o.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.product}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{o.seller}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.date}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', padding: '3px 8px', borderRadius: 999, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>{s.label.toUpperCase()}</span>
          <span style={{ fontWeight: 800, fontSize: 13 }}>{fmt(o.amount)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────
function ProductCard({ p, onAdd }: { p: Product; onAdd: (id: string) => Promise<boolean> }) {
  const disc = p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
  const [adding, setAdding] = useState(false);
  return (
    <div style={{ background: 'var(--card-alt)', border: '1px solid var(--border)', borderRadius: 13, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ height: 130, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
        {p.image
          ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 44 }}>{p.emoji}</span>
        }
      </div>
      {disc > 0 && <span style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent2)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 999 }}>{disc}% OFF</span>}
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{p.seller}</div>
        </div>
        {p.rating > 0 && <div style={{ fontSize: 10, color: 'var(--muted)' }}>★ {p.rating} ({p.soldCount})</div>}
        <div style={{ display: 'flex', gap: 5, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 13 }}>{fmt(p.price)}</span>
          {disc > 0 && <span style={{ fontSize: 10, color: 'var(--muted)', textDecoration: 'line-through' }}>{fmt(p.originalPrice)}</span>}
        </div>
        <div style={{ fontSize: 10, color: p.stock > 0 ? 'var(--muted)' : '#ef4444' }}>{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</div>
        <button disabled={!p.inStock || adding} onClick={async () => { setAdding(true); await onAdd(p.id); setAdding(false); }}
          style={{ padding: '8px 0', borderRadius: 9, border: 'none', cursor: p.inStock && !adding ? 'pointer' : 'not-allowed', background: p.inStock ? 'var(--accent)' : 'var(--border)', color: p.inStock ? '#fff' : 'var(--muted)', fontWeight: 700, fontSize: 11, fontFamily: 'var(--font-body)', opacity: adding ? 0.7 : 1, marginTop: 'auto', WebkitTapHighlightColor: 'transparent' }}>
          {adding ? 'Adding…' : p.inStock ? '🛒 Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
}

// ── M-Pesa Checkout Modal ─────────────────────────────────────────────────────
function CheckoutModal({ items, total, onClose, onSuccess }: { items: CartItem[]; total: number; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm]           = useState({ delivery_address: '', phone: '' });
  const [step, setStep]           = useState<'details'|'waiting'|'done'>('details');
  const [error, setError]         = useState('');
  const [mpesaCode, setMpesaCode] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => () => stopPoll(), []);

  const startPolling = (cid: string) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res  = await fetch(`${API}/mpesa/status/${cid}`, { headers: authHeaders() });
        const data = await res.json();
        if (data.status === 'success') { stopPoll(); setMpesaCode(data.mpesa_code || ''); setStep('done'); setTimeout(onSuccess, 2500); }
        else if (data.status === 'failed') { stopPoll(); setError(data.result_desc || 'Payment cancelled. Please try again.'); setStep('details'); }
        else if (attempts >= 30) { stopPoll(); setError('Payment timed out. If you paid, check My Orders.'); setStep('details'); }
      } catch {}
    }, 3000);
  };

  const handlePay = async () => {
    if (!form.delivery_address.trim()) { setError('Please enter a delivery address.'); return; }
    if (!form.phone.trim())            { setError('Please enter your M-Pesa phone number.'); return; }
    setError('');
    const orderRes  = await fetch(`${API}/buyer/orders`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ delivery_address: form.delivery_address, phone: form.phone }) });
    const orderData = await orderRes.json();
    if (!orderRes.ok) { setError(orderData.error || 'Failed to create orders.'); return; }
    setStep('waiting');
    const mpesaRes  = await fetch(`${API}/mpesa/stk-push`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ phone: form.phone, amount: total, order_ids: orderData.order_ids, description: 'SwiftMall Order' }) });
    const mpesaData = await mpesaRes.json();
    if (!mpesaRes.ok) { setError(mpesaData.error || 'M-Pesa request failed.'); setStep('details'); return; }
    startPolling(mpesaData.checkout_request_id);
  };

  return (
    /* Bottom-sheet style on mobile */
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '20px 20px 0 0', padding: '20px 18px 32px', width: '100%', maxWidth: 580, maxHeight: '93vh', overflowY: 'auto' }}>
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800 }}>
            {step === 'done' ? '✅ Payment Confirmed' : step === 'waiting' ? '⏳ Check Your Phone' : '💳 Checkout'}
          </h2>
          {step === 'details' && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, padding: 4 }}>✕</button>}
        </div>

        {step === 'details' && (
          <>
            <div style={{ background: 'var(--card-alt)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Order Summary</div>
              {items.map(i => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                    <ProductThumb image={i.image} emoji={i.emoji} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>Qty {i.quantity} · {i.sellerName}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{fmt(i.price * i.quantity)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)' }}>{fmt(total)}</span>
              </div>
            </div>

            {[['Delivery Address','delivery_address','text','e.g. 123 Moi Avenue, Nairobi'],['M-Pesa Phone','phone','tel','e.g. 0712 345 678']].map(([lbl,key,type,ph]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>{lbl}</label>
                <input type={type} placeholder={ph} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '12px 14px', background: 'var(--card-alt)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 16, outline: 'none' }} />
              </div>
            ))}

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}

            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>📱</span>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>You'll receive an <strong style={{ color: 'var(--text)' }}>M-Pesa STK push</strong> on your phone. Enter your PIN to complete.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '13px 0', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13 }}>Cancel</button>
              <button onClick={handlePay} style={{ flex: 2, padding: '13px 0', borderRadius: 12, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                📱 Pay {fmt(total)}
              </button>
            </div>
          </>
        )}

        {step === 'waiting' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 50, marginBottom: 14 }}>📱</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, marginBottom: 10 }}>Enter Your M-Pesa PIN</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
              A request of <strong style={{ color: 'var(--text)' }}>{fmt(total)}</strong> was sent to <strong style={{ color: 'var(--text)' }}>{form.phone}</strong>.<br />
              Enter your <strong style={{ color: '#22c55e' }}>M-Pesa PIN</strong> to confirm.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />)}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Waiting… (up to 90s)</p>
            <button onClick={() => { stopPoll(); setStep('details'); setError(''); }} style={{ marginTop: 18, padding: '10px 24px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13 }}>Cancel</button>
            <style>{`@keyframes bounce{0%,80%,100%{transform:scale(.6);opacity:.5}40%{transform:scale(1);opacity:1}}`}</style>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 50, marginBottom: 14 }}>🎉</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, marginBottom: 10 }}>Payment Successful!</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 14 }}>Your payment of <strong style={{ color: 'var(--text)' }}>{fmt(total)}</strong> was confirmed.</p>
            {mpesaCode && (
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '12px 20px', display: 'inline-block', marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>M-PESA RECEIPT</div>
                <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#22c55e', letterSpacing: 2 }}>{mpesaCode}</div>
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Redirecting to your orders…</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
type Tab = 'overview'|'search'|'cart'|'orders'|'wishlist'|'notifications'|'settings';

export default function BuyerDashboard() {
  const [tab, setTab]             = useState<Tab>('overview');
  const [orderFilter, setOrderFilter] = useState('all');
  const [showCheckout, setShowCheckout] = useState(false);
  const user                      = useUser();
  const { data: stats, loading: statsLoading }                      = useStats();
  const { orders, loading: ordersLoading, refetch: refetchOrders }  = useOrders();
  const { items: wishItems, loading: wishLoading, remove: removeWish } = useWishlist();
  const { notifications, loading: notifsLoading, markAllRead }      = useNotifications();
  const { items: cartItems, loading: cartLoading, refetch: refetchCart, addToCart, updateQty, remove: removeCartItem, clear: clearCart, total: cartTotal, itemCount } = useCart();
  const { query, setQuery, results, suggestions, setSuggestions, categories, loading: searchLoading, category, setCategory, sort, setSort, search, changePage, page } = useSearch();
  const unread    = notifications.filter(n => !n.read).length;
  const searchRef = useRef<HTMLInputElement>(null);
  const today     = new Date().toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric' });

  const navItems: { id: Tab; icon: string; label: string; badge?: number }[] = [
    { id: 'overview',      icon: '⊞',  label: 'Overview' },
    { id: 'search',        icon: '🔍', label: 'Shop' },
    { id: 'cart',          icon: '🛒', label: 'Cart',      badge: itemCount },
    { id: 'orders',        icon: '📦', label: 'Orders' },
    { id: 'wishlist',      icon: '♡',  label: 'Wishlist',  badge: wishItems.length },
    { id: 'notifications', icon: '🔔', label: 'Alerts',    badge: unread },
    { id: 'settings',      icon: '⚙', label: 'Account' },
  ];

  const goTab = (t: Tab) => { setTab(t); if (t === 'search') setTimeout(() => searchRef.current?.focus(), 80); };
  const handlePaySuccess = () => { setShowCheckout(false); refetchCart(); setTab('orders'); refetchOrders(); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');
        :root{
          --bg:#0d0f14;--card:#141720;--card-alt:#1a1e2b;--border:#1e2330;
          --text:#eef0f6;--muted:#6b7280;--accent:#6c63ff;--accent2:#ff6584;
          --sidebar-w:240px;--topbar-h:60px;--nav-h:66px;
          --font-display:'Syne',sans-serif;--font-body:'DM Sans',sans-serif;
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{height:100%;background:var(--bg);}
        body{-webkit-font-smoothing:antialiased;}

        /* Prevent iOS zoom on input focus */
        input,select,textarea{font-size:16px;}

        .bd{display:flex;min-height:100vh;background:var(--bg);color:var(--text);font-family:var(--font-body);}

        /* ── Sidebar (desktop) ── */
        .sidebar{width:var(--sidebar-w);min-height:100vh;background:var(--card);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;z-index:40;}
        .sidebar-logo{padding:22px 20px;border-bottom:1px solid var(--border);}
        .sidebar nav{flex:1;padding:14px 12px;display:flex;flex-direction:column;gap:3px;overflow-y:auto;}
        .nav-btn{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;border:none;background:transparent;color:var(--muted);font-family:var(--font-body);font-size:14px;font-weight:500;cursor:pointer;transition:all .15s;width:100%;text-align:left;}
        .nav-btn:hover{background:var(--card-alt);color:var(--text);}
        .nav-btn.on{background:rgba(108,99,255,.12);color:var(--accent);}
        .nav-icon{font-size:17px;width:22px;text-align:center;flex-shrink:0;}
        .nav-badge{margin-left:auto;background:var(--accent2);color:#fff;font-size:10px;font-weight:800;border-radius:999px;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;padding:0 4px;}
        .sidebar-user{padding:14px 20px;border-top:1px solid var(--border);display:flex;align-items:center;gap:12px;}

        /* ── Main ── */
        .main{flex:1;display:flex;flex-direction:column;margin-left:var(--sidebar-w);min-height:100vh;}

        /* ── Topbar ── */
        .topbar{height:var(--topbar-h);background:var(--card);border-bottom:1px solid var(--border);padding:0 28px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:30;}

        /* ── Content ── */
        .content{flex:1;padding:24px 28px;display:flex;flex-direction:column;gap:20px;max-width:1200px;width:100%;}

        /* ── Grids ── */
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}
        .grid-2{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;}
        .grid-3{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;}
        .order-list{display:flex;flex-direction:column;gap:10px;}

        /* ── Card ── */
        .card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;}
        .card-title{font-family:var(--font-display);font-size:15px;font-weight:700;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}

        /* ── Pills ── */
        .pill{padding:7px 14px;border-radius:999px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-size:12px;font-weight:600;font-family:var(--font-body);transition:all .15s;white-space:nowrap;-webkit-tap-highlight-color:transparent;}
        .pill:hover{border-color:var(--accent);color:var(--accent);}
        .pill.on{background:var(--accent);border-color:var(--accent);color:#fff;}
        .pill.danger{border-color:#ef4444;color:#ef4444;}
        .pill.danger:hover{background:rgba(239,68,68,.08);}

        /* ── Search ── */
        .search-wrap{position:relative;}
        .search-box{width:100%;padding:13px 48px;background:var(--card-alt);border:1px solid var(--border);border-radius:13px;color:var(--text);font-family:var(--font-body);font-size:15px;outline:none;transition:border-color .2s;}
        .search-box::placeholder{color:var(--muted);}
        .search-box:focus{border-color:var(--accent);}
        .search-icon{position:absolute;left:15px;top:50%;transform:translateY(-50%);font-size:17px;pointer-events:none;}
        .search-clear{position:absolute;right:13px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:17px;padding:4px;}
        .suggests{position:absolute;top:calc(100% + 5px);left:0;right:0;background:var(--card);border:1px solid var(--border);border-radius:12px;z-index:50;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.4);}
        .suggest-item{padding:11px 16px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:background .12s;-webkit-tap-highlight-color:transparent;}
        .suggest-item:hover{background:var(--card-alt);}

        /* ── Filters ── */
        .filter-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;margin-bottom:16px;-webkit-overflow-scrolling:touch;}
        .filter-row::-webkit-scrollbar{display:none;}
        .fselect{padding:7px 12px;border-radius:10px;border:1px solid var(--border);background:var(--card-alt);color:var(--text);font-family:var(--font-body);font-size:12px;cursor:pointer;outline:none;}

        /* ── Pagination ── */
        .pages{display:flex;gap:6px;align-items:center;justify-content:center;padding-top:8px;flex-wrap:wrap;}
        .page-btn{width:34px;height:34px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;}
        .page-btn:hover{border-color:var(--accent);color:var(--accent);}
        .page-btn.cur{background:var(--accent);border-color:var(--accent);color:#fff;}
        .page-btn:disabled{opacity:.3;cursor:not-allowed;}

        /* ── Notification ── */
        .notif-item{display:flex;gap:12px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--border);}
        .notif-item:last-child{border-bottom:none;}

        /* ── Settings ── */
        .settings-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border);gap:12px;}
        .settings-row:last-of-type{border-bottom:none;}

        /* ── Avatar ── */
        .avatar{border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;flex-shrink:0;}

        /* ── Cart item ── */
        .cart-item{display:flex;gap:12px;align-items:center;padding:14px 0;border-bottom:1px solid var(--border);}
        .cart-item:last-child{border-bottom:none;}
        .qty-btn{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--card-alt);color:var(--text);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;font-weight:700;-webkit-tap-highlight-color:transparent;}
        .qty-btn:hover{border-color:var(--accent);color:var(--accent);}

        /* ── Mobile nav ── */
        .mob-nav{display:none;}

        /* ── Animations ── */
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

        /* ════════════════════════════════════
           MOBILE — max-width 768px
           ════════════════════════════════════ */
        @media(max-width:768px){
          /* Hide sidebar */
          .sidebar{display:none;}
          .main{margin-left:0;padding-bottom:calc(var(--nav-h) + env(safe-area-inset-bottom, 0px));}

          /* Topbar */
          .topbar{height:54px;padding:0 12px;}
          .topbar-right-text{display:none;}

          /* Content */
          .content{padding:10px 10px;gap:12px;}

          /* Stats: 2 cols */
          .stats-grid{grid-template-columns:1fr 1fr;gap:8px;}

          /* Product grids: 2 cols */
          .grid-2,.grid-3{grid-template-columns:1fr 1fr;gap:8px;}

          /* Cards */
          .card{padding:12px 12px;border-radius:14px;}
          .card-title{font-size:14px;margin-bottom:14px;}

          /* Search box smaller padding */
          .search-box{padding:12px 44px;font-size:14px;}
          .search-icon{left:13px;font-size:16px;}

          /* Cart items stack qty controls */
          .cart-item{flex-wrap:wrap;gap:10px;}
          .cart-item-controls{width:100%;display:flex;justify-content:space-between;align-items:center;}

          /* Checkout button full-width */
          .checkout-bar{flex-direction:column;gap:12px;}
          .checkout-btn{width:100%;}

          /* Welcome text */
          .welcome-text{font-size:18px!important;}

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
            min-width:50px;
            max-width:76px;
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
            padding:0 4px;
            -webkit-tap-highlight-color:transparent;
          }
          .mob-btn.on{color:var(--accent);}
          .mob-btn .bi{font-size:19px;line-height:1;}
          .mob-badge{
            position:absolute;
            top:6px;right:calc(50% - 16px);
            background:var(--accent2);
            color:#fff;
            font-size:8px;
            font-weight:800;
            border-radius:999px;
            min-width:15px;height:15px;
            display:flex;align-items:center;justify-content:center;
            padding:0 3px;
          }

          /* Wishlist items */
          .wishlist-item-img{height:100px!important;}
        }

        /* ── Very small ── */
        @media(max-width:360px){
          .content{padding:8px;gap:10px;}
          .stats-grid{gap:6px;}
          .grid-2,.grid-3{gap:6px;}
          .mob-btn{min-width:42px;font-size:8px;}
        }

        /* ── Tablet ── */
        @media(min-width:769px) and (max-width:1024px){
          :root{--sidebar-w:200px;}
          .content{padding:18px 20px;gap:16px;}
          .stats-grid{grid-template-columns:repeat(2,1fr);}
        }
      `}</style>

      {showCheckout && <CheckoutModal items={cartItems} total={cartTotal} onClose={() => setShowCheckout(false)} onSuccess={handlePaySuccess} />}

      <div className="bd">
        {/* Sidebar (desktop) */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 21 }}>Swift<span style={{ color: 'var(--accent)' }}>Mall</span></div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>Buyer Portal</div>
          </div>
          <nav>
            {navItems.map(n => (
              <button key={n.id} className={`nav-btn${tab === n.id ? ' on' : ''}`} onClick={() => goTab(n.id)}>
                <span className="nav-icon">{n.icon}</span>
                <span>{n.label}</span>
                {n.badge && n.badge > 0 ? <span className="nav-badge">{n.badge > 9 ? '9+' : n.badge}</span> : null}
              </button>
            ))}
          </nav>
          <div className="sidebar-user">
            <div className="avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{user?.initials ?? '?'}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name ?? '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--accent)' }}>Buyer</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="main">
          <header className="topbar">
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{navItems.find(n => n.id === tab)?.label}</h1>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{today}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {/* Cart icon shortcut — always visible on mobile */}
              <button onClick={() => goTab('cart')} style={{ position: 'relative', background: 'var(--card-alt)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 17, WebkitTapHighlightColor: 'transparent' }}>
                🛒
                {itemCount > 0 && <span style={{ position: 'absolute', top: -5, right: -5, background: 'var(--accent2)', color: '#fff', fontSize: 8, fontWeight: 800, borderRadius: 999, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{itemCount > 9 ? '9+' : itemCount}</span>}
              </button>
              {/* Name + email (hidden on mobile via CSS) */}
              <div className="topbar-right-text" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name ?? '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.email ?? ''}</div>
              </div>
              <div className="avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{user?.initials ?? '?'}</div>
            </div>
          </header>

          <main className="content">

            {/* ── Overview ── */}
            {tab === 'overview' && (
              <>
                <div>
                  <div className="welcome-text" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
                    {user ? `Hi, ${user.name.split(' ')[0]} 👋` : 'Welcome back 👋'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5 }}>Here's what's happening today.</div>
                </div>
                <div className="stats-grid">
                  <StatCard icon="📦" label="Orders"      value={stats ? String(stats.totalOrders) : undefined} loading={statsLoading} />
                  <StatCard icon="💰" label="Total Spent" value={stats ? fmt(stats.totalSpent) : undefined}     loading={statsLoading} />
                  <StatCard icon="🛒" label="In Cart"     value={String(itemCount)}                             loading={cartLoading} />
                  <StatCard icon="♡"  label="Wishlist"    value={stats ? String(stats.wishlistCount) : undefined} loading={statsLoading} />
                </div>
                <div className="card">
                  <div className="card-title">Recent Orders <button className="pill" onClick={() => goTab('orders')}>See All</button></div>
                  {ordersLoading ? [1,2,3].map(i => <Skel key={i} h={78} />) : orders.length === 0 ? <Empty icon="📦" msg="No orders yet. Start shopping!" /> : <div className="order-list">{orders.slice(0,3).map(o => <OrderCard key={o.id} o={o} />)}</div>}
                </div>
                <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                  <button onClick={() => goTab('search')} style={{ padding: '14px 32px', borderRadius: 13, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>🛍 Browse & Shop</button>
                </div>
              </>
            )}

            {/* ── Shop / Search ── */}
            {tab === 'search' && (
              <>
                <div className="search-wrap">
                  <span className="search-icon">🔍</span>
                  <input ref={searchRef} className="search-box" placeholder="Search products…" value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') search(); if (e.key === 'Escape') setSuggestions([]); }} />
                  {query && <button className="search-clear" onClick={() => { setQuery(''); setSuggestions([]); }}>✕</button>}
                  {suggestions.length > 0 && (
                    <div className="suggests">
                      {suggestions.map((s, i) => (
                        <div key={i} className="suggest-item" onClick={() => { setQuery(s.name); setSuggestions([]); search(s.name); }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.category}</div>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{fmt(s.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select className="fselect" value={category} onChange={e => { setCategory(e.target.value); search(query, e.target.value, sort); }}>
                    <option value="">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="fselect" value={sort} onChange={e => { setSort(e.target.value); search(query, category, e.target.value); }}>
                    <option value="relevance">Best Match</option>
                    <option value="price_asc">Price: Low → High</option>
                    <option value="price_desc">Price: High → Low</option>
                    <option value="newest">Newest</option>
                  </select>
                  <button className="pill on" onClick={() => search()}>{searchLoading ? 'Searching…' : '🔍 Search'}</button>
                  {results && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{results.total} result{results.total !== 1 ? 's' : ''}</span>}
                </div>
                <div className="card">
                  {searchLoading
                    ? <div className="grid-3">{[1,2,3,4,5,6].map(i => <Skel key={i} h={280} r={13} />)}</div>
                    : !results ? <Empty icon="🔍" msg="Search for products above." />
                    : results.results.length === 0 ? <Empty icon="😕" msg="No products found." />
                    : <>
                        <div className="grid-3">{results.results.map(p => <ProductCard key={p.id} p={p} onAdd={addToCart} />)}</div>
                        {results.pages > 1 && (
                          <div className="pages" style={{ marginTop: 20 }}>
                            <button className="page-btn" disabled={page <= 1} onClick={() => changePage(page - 1)}>‹</button>
                            {Array.from({ length: Math.min(5, results.pages) }, (_, i) => {
                              const pg = Math.max(1, Math.min(results.pages - 4, page - 2)) + i;
                              return <button key={pg} className={`page-btn${pg === page ? ' cur' : ''}`} onClick={() => changePage(pg)}>{pg}</button>;
                            })}
                            <button className="page-btn" disabled={page >= results.pages} onClick={() => changePage(page + 1)}>›</button>
                          </div>
                        )}
                      </>
                  }
                </div>
              </>
            )}

            {/* ── Cart ── */}
            {tab === 'cart' && (
              <div className="card">
                <div className="card-title">
                  <span>My Cart {cartItems.length > 0 && <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>({itemCount} item{itemCount !== 1 ? 's' : ''})</span>}</span>
                  {cartItems.length > 0 && <button className="pill danger" onClick={clearCart}>Clear All</button>}
                </div>
                {cartLoading ? [1,2,3].map(i => <Skel key={i} h={80} />) : cartItems.length === 0 ? <Empty icon="🛒" msg="Your cart is empty." /> : (
                  <>
                    {cartItems.map(item => (
                      <div key={item.id} className="cart-item">
                        <ProductThumb image={item.image} emoji={item.emoji} size={48} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{item.sellerName}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', marginTop: 3 }}>{fmt(item.price)}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button className="qty-btn" onClick={() => item.quantity > 1 ? updateQty(item.id, item.quantity - 1) : removeCartItem(item.id)}>−</button>
                            <span style={{ fontSize: 14, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{item.quantity}</span>
                            <button className="qty-btn" onClick={() => item.quantity < item.stock ? updateQty(item.id, item.quantity + 1) : null} style={{ opacity: item.quantity >= item.stock ? 0.4 : 1 }}>+</button>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{fmt(item.price * item.quantity)}</span>
                          <button onClick={() => removeCartItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11, padding: 0, WebkitTapHighlightColor: 'transparent' }}>Remove</button>
                        </div>
                      </div>
                    ))}
                    <div className="checkout-bar" style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Total</div>
                        <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--accent)', lineHeight: 1.1 }}>{fmt(cartTotal)}</div>
                      </div>
                      <button className="checkout-btn" onClick={() => setShowCheckout(true)} style={{ padding: '13px 24px', borderRadius: 12, border: 'none', background: '#22c55e', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, WebkitTapHighlightColor: 'transparent' }}>
                        📱 Pay with M-Pesa
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Orders ── */}
            {tab === 'orders' && (
              <div className="card">
                <div className="card-title">My Orders</div>
                <div className="filter-row">
                  {['All','Processing','Shipped','Delivered','Cancelled'].map(f => (
                    <button key={f} className={`pill${orderFilter === f.toLowerCase() ? ' on' : ''}`} onClick={() => { setOrderFilter(f.toLowerCase()); refetchOrders(f.toLowerCase()); }}>{f}</button>
                  ))}
                </div>
                {ordersLoading ? [1,2,3].map(i => <Skel key={i} h={78} />) : orders.length === 0 ? <Empty icon="📦" msg="No orders found." /> : <div className="order-list">{orders.map(o => <OrderCard key={o.id} o={o} />)}</div>}
              </div>
            )}

            {/* ── Wishlist ── */}
            {tab === 'wishlist' && (
              <div className="card">
                <div className="card-title">My Wishlist</div>
                {wishLoading ? <div className="grid-2">{[1,2,3,4].map(i => <Skel key={i} h={240} r={13} />)}</div>
                  : wishItems.length === 0 ? <Empty icon="♡" msg="Your wishlist is empty." />
                  : <div className="grid-2">
                      {wishItems.map(item => {
                        const disc = item.originalPrice > item.price ? Math.round((1 - item.price / item.originalPrice) * 100) : 0;
                        return (
                          <div key={item.id} style={{ background: 'var(--card-alt)', border: '1px solid var(--border)', borderRadius: 13, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            <div className="wishlist-item-img" style={{ height: 120, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              {item.image
                                ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <span style={{ fontSize: 38 }}>{item.emoji}</span>
                              }
                            </div>
                            {disc > 0 && <span style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent2)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 999 }}>{disc}% OFF</span>}
                            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.name}</div>
                              <div style={{ display: 'flex', gap: 5, alignItems: 'baseline' }}>
                                <span style={{ fontWeight: 800, fontSize: 13 }}>{fmt(item.price)}</span>
                                {disc > 0 && <span style={{ fontSize: 10, color: 'var(--muted)', textDecoration: 'line-through' }}>{fmt(item.originalPrice)}</span>}
                              </div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                                <button disabled={!item.inStock} onClick={() => item.inStock && addToCart(item.id)}
                                  style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', cursor: item.inStock ? 'pointer' : 'not-allowed', background: item.inStock ? 'var(--accent)' : 'var(--border)', color: item.inStock ? '#fff' : 'var(--muted)', fontWeight: 700, fontSize: 11, fontFamily: 'var(--font-body)', WebkitTapHighlightColor: 'transparent' }}>
                                  {item.inStock ? '🛒 Add' : 'Out of Stock'}
                                </button>
                                <button onClick={() => removeWish(item.id)} style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, WebkitTapHighlightColor: 'transparent' }}>🗑</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                }
              </div>
            )}

            {/* ── Notifications ── */}
            {tab === 'notifications' && (
              <div className="card">
                <div className="card-title">Notifications {unread > 0 && <button className="pill" onClick={markAllRead}>Mark all read</button>}</div>
                {notifsLoading ? [1,2,3].map(i => <Skel key={i} h={60} />) : notifications.length === 0 ? <Empty icon="🔔" msg="You're all caught up!" /> : (
                  notifications.map(n => (
                    <div key={n.id} className="notif-item">
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: n.read ? 'var(--border)' : 'var(--accent)', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: n.read ? 'var(--muted)' : 'var(--text)', lineHeight: 1.5 }}>{n.message}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{n.time}</div>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', padding: '3px 8px', borderRadius: 999, flexShrink: 0,
                        background: n.type === 'order' ? 'rgba(59,130,246,.12)' : n.type === 'promo' ? 'rgba(245,158,11,.12)' : 'rgba(108,99,255,.12)',
                        color: n.type === 'order' ? '#3b82f6' : n.type === 'promo' ? '#f59e0b' : 'var(--accent)' }}>{n.type.toUpperCase()}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Settings ── */}
            {tab === 'settings' && (
              <>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="avatar" style={{ width: 54, height: 54, fontSize: 19, flexShrink: 0 }}>{user?.initials ?? '?'}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name ?? '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email ?? '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 3 }}>Buyer Account</div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Personal Info</div>
                  {[{ label: 'Full Name', sub: user?.name ?? '—' }, { label: 'Email', sub: user?.email ?? '—' }, { label: 'Phone', sub: user?.phone || 'Not set' }].map(row => (
                    <div key={row.label} className="settings-row">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{row.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.sub}</div>
                      </div>
                      <button className="pill" style={{ flexShrink: 0 }}>Edit</button>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <div className="card-title">Preferences</div>
                  {[{ label: 'Saved Addresses', sub: 'Manage delivery addresses' }, { label: 'M-Pesa', sub: 'Payment settings' }, { label: 'Notifications', sub: 'Email & SMS preferences' }, { label: 'Password', sub: 'Change your password' }].map(row => (
                    <div key={row.label} className="settings-row">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{row.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{row.sub}</div>
                      </div>
                      <button className="pill" style={{ flexShrink: 0 }}>›</button>
                    </div>
                  ))}
                </div>
                <div className="card">
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
            <button key={n.id} className={`mob-btn${tab === n.id ? ' on' : ''}`} onClick={() => goTab(n.id)}>
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
