// src/pages/Home.tsx
import React, { useEffect, useRef } from 'react';

const Home: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number; y: number; r: number; dx: number; dy: number; alpha: number }[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,210,255,${p.alpha})`;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  const features = [
    { icon: '🛒', title: 'Shop Anything', desc: 'Browse thousands of products across every category — from electronics to fresh produce, all in one place.' },
    { icon: '📱', title: 'Pay with M-Pesa', desc: 'Checkout in seconds with M-Pesa STK push. No card required, no hassle — just your PIN.' },
    { icon: '🏪', title: 'Sell with Ease', desc: 'Open your store in minutes. Manage products, track orders, and receive payouts directly to your M-Pesa.' },
    { icon: '📦', title: 'Real-Time Tracking', desc: 'Follow your order every step of the way, from processing to delivery, right from your dashboard.' },
    { icon: '🔒', title: 'Trusted & Secure', desc: 'Every transaction is protected. Buyer and seller accounts are verified for a safe marketplace experience.' },
    { icon: '⚡', title: 'Built for Speed', desc: 'Snappy performance on any device. SwiftMall is optimized for Kenya mobile-first users.' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        .home {
          min-height: 100vh;
          background: #050a14;
          color: #e8f0ff;
          font-family: 'Outfit', sans-serif;
          position: relative;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
        }

        .home-canvas {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
          z-index: 0;
        }
        .orb-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(56,114,255,0.18) 0%, transparent 70%);
          top: -150px; left: -100px;
          animation: drift1 18s ease-in-out infinite alternate;
        }
        .orb-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(120,60,220,0.14) 0%, transparent 70%);
          bottom: -80px; right: -80px;
          animation: drift2 22s ease-in-out infinite alternate;
        }
        .orb-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(0,210,160,0.1) 0%, transparent 70%);
          top: 40%; left: 50%;
          transform: translate(-50%, -50%);
          animation: drift3 15s ease-in-out infinite alternate;
        }

        @keyframes drift1 { from { transform: translate(0,0); } to { transform: translate(60px, 80px); } }
        @keyframes drift2 { from { transform: translate(0,0); } to { transform: translate(-50px, -60px); } }
        @keyframes drift3 { from { transform: translate(-50%,-50%); } to { transform: translate(-45%,-55%); } }

        /* ── Nav ── */
        .nav {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 48px;
        }
        .nav-logo {
          font-family: 'Instrument Serif', serif;
          font-size: 24px; color: #fff; letter-spacing: -0.5px;
        }
        .nav-logo span { color: #4d8dff; font-style: italic; }
        .nav-links { display: flex; gap: 32px; }
        .nav-link {
          font-size: 12px; font-weight: 500; color: rgba(232,240,255,0.5);
          text-decoration: none; letter-spacing: 0.04em; text-transform: uppercase;
          transition: color 0.2s;
        }
        .nav-link:hover { color: #e8f0ff; }
        .nav-cta {
          padding: 9px 20px; border-radius: 999px;
          background: rgba(77,141,255,0.15); border: 1px solid rgba(77,141,255,0.4);
          color: #7ab0ff; font-size: 13px; font-weight: 600;
          text-decoration: none; transition: all 0.2s;
        }
        .nav-cta:hover { background: rgba(77,141,255,0.25); color: #fff; }

        /* ── Hero ── */
        .hero {
          position: relative; z-index: 10;
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; padding: 48px 20px 60px;
        }

        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 14px; border-radius: 999px;
          background: rgba(77,141,255,0.08); border: 1px solid rgba(77,141,255,0.2);
          font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
          color: #7ab0ff; margin-bottom: 32px;
          animation: fadeUp 0.8s ease both;
        }
        .hero-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #4d8dff; box-shadow: 0 0 8px #4d8dff;
          animation: pulse 2s infinite; flex-shrink: 0;
        }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }

        .hero-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(44px, 11vw, 110px);
          line-height: 0.95; letter-spacing: -1px; color: #fff;
          margin-bottom: 12px;
          animation: fadeUp 0.8s 0.1s ease both;
          word-break: break-word;
        }
        .hero-title-accent {
          font-style: italic;
          background: linear-gradient(135deg, #4d8dff 0%, #a78bfa 50%, #34d399 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-sub {
          font-size: clamp(14px, 3.5vw, 18px); font-weight: 300;
          color: rgba(232,240,255,0.5); max-width: 500px;
          line-height: 1.7; margin: 24px auto 44px;
          animation: fadeUp 0.8s 0.2s ease both;
          padding: 0 8px;
        }
        .hero-sub strong { color: rgba(232,240,255,0.8); font-weight: 500; }

        .hero-actions {
          display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
          animation: fadeUp 0.8s 0.3s ease both;
          padding: 0 16px;
        }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 28px; border-radius: 999px;
          background: linear-gradient(135deg, #3b7bff, #6c40f0);
          color: #fff; font-family: 'Outfit', sans-serif;
          font-size: 14px; font-weight: 600; text-decoration: none;
          box-shadow: 0 0 40px rgba(59,123,255,0.35), 0 2px 8px rgba(0,0,0,0.3);
          transition: all 0.25s; white-space: nowrap;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 60px rgba(59,123,255,0.5), 0 4px 16px rgba(0,0,0,0.3); }

        .btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 28px; border-radius: 999px;
          background: transparent; border: 1px solid rgba(232,240,255,0.15);
          color: rgba(232,240,255,0.7); font-family: 'Outfit', sans-serif;
          font-size: 14px; font-weight: 500; text-decoration: none;
          transition: all 0.25s; backdrop-filter: blur(10px); white-space: nowrap;
        }
        .btn-secondary:hover { border-color: rgba(232,240,255,0.35); color: #fff; transform: translateY(-2px); }

        /* ── Stats ── */
        .stats-bar {
          position: relative; z-index: 10;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          padding: 0 24px 60px;
          animation: fadeUp 0.8s 0.5s ease both;
          max-width: 700px;
          margin: 0 auto;
          width: 100%;
        }
        .stat-item {
          padding: 16px 12px;
          border-left: 1px solid rgba(232,240,255,0.07);
          text-align: center;
        }
        .stat-item:first-child { border-left: none; }
        .stat-num {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(18px, 4vw, 28px); color: #fff; line-height: 1;
        }
        .stat-label {
          font-size: 9px; font-weight: 500; letter-spacing: 0.06em;
          text-transform: uppercase; color: rgba(232,240,255,0.35); margin-top: 6px;
        }

        /* ── Features ── */
        .features {
          position: relative; z-index: 10;
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: rgba(232,240,255,0.06);
          border-top: 1px solid rgba(232,240,255,0.06);
          border-bottom: 1px solid rgba(232,240,255,0.06);
          margin: 0 0 60px;
        }
        .feature {
          background: #050a14; padding: 32px 24px; transition: background 0.2s;
        }
        .feature:hover { background: rgba(77,141,255,0.04); }
        .feature-icon { font-size: 26px; margin-bottom: 14px; display: block; }
        .feature-title { font-size: 15px; font-weight: 600; color: #e8f0ff; margin-bottom: 8px; }
        .feature-desc { font-size: 13px; color: rgba(232,240,255,0.4); line-height: 1.65; }

        /* ── CTA ── */
        .cta-section {
          position: relative; z-index: 10;
          text-align: center; padding: 0 20px 80px;
          animation: fadeUp 0.8s 0.4s ease both;
        }
        .cta-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(26px, 6vw, 52px); color: #fff; margin-bottom: 12px;
        }
        .cta-sub { font-size: 14px; color: rgba(232,240,255,0.4); margin-bottom: 32px; }
        .cta-buttons {
          display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
        }

        /* ── Footer ── */
        .footer {
          position: relative; z-index: 10;
          border-top: 1px solid rgba(232,240,255,0.06);
          padding: 24px 32px;
          display: flex; align-items: center; justify-content: space-between;
          font-size: 12px; color: rgba(232,240,255,0.25);
          flex-wrap: wrap; gap: 8px;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Tablet ── */
        @media (max-width: 768px) {
          .nav { padding: 16px 20px; }
          .nav-links { display: none; }
          .features { grid-template-columns: 1fr 1fr; }
          .stats-bar { grid-template-columns: repeat(2, 1fr); padding: 0 16px 48px; }
          .stat-item { border-left: none; border-bottom: 1px solid rgba(232,240,255,0.07); }
          .stat-item:nth-child(odd) { border-right: 1px solid rgba(232,240,255,0.07); }
          .footer { justify-content: center; text-align: center; padding: 20px; }
        }

        /* ── Phone ── */
        @media (max-width: 480px) {
          .nav { padding: 14px 16px; }
          .nav-logo { font-size: 20px; }
          .nav-cta { padding: 8px 16px; font-size: 12px; }
          .hero { padding: 36px 16px 48px; }
          .hero-badge { font-size: 9px; padding: 5px 12px; margin-bottom: 24px; }
          .hero-title { font-size: clamp(38px, 12vw, 58px); letter-spacing: -0.5px; }
          .hero-sub { font-size: 14px; margin: 20px auto 36px; }
          .hero-actions { gap: 10px; }
          .btn-primary, .btn-secondary { padding: 13px 22px; font-size: 13px; width: 100%; justify-content: center; }
          .stats-bar { grid-template-columns: repeat(2, 1fr); padding: 0 12px 40px; gap: 0; }
          .stat-num { font-size: 20px; }
          .stat-label { font-size: 8px; }
          .features { grid-template-columns: 1fr; }
          .feature { padding: 24px 20px; }
          .cta-section { padding: 0 16px 60px; }
          .cta-buttons { flex-direction: column; align-items: center; }
          .cta-buttons .btn-primary,
          .cta-buttons .btn-secondary { width: 100%; max-width: 320px; justify-content: center; }
          .footer { font-size: 11px; }
        }
      `}</style>

      <div className="home">
        <canvas ref={canvasRef} className="home-canvas" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        <nav className="nav">
          <div className="nav-logo">Swift<span>Mall</span></div>
          <div className="nav-links">
            <a href="#features" className="nav-link">Platform</a>
            <a href="#features" className="nav-link">Sellers</a>
            <a href="#features" className="nav-link">About</a>
          </div>
          <a href="/login" className="nav-cta">Sign In</a>
        </nav>

        <section className="hero">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Kenya's Modern Marketplace
          </div>
          <h1 className="hero-title">
            Commerce<br />
            <span className="hero-title-accent">Redefined.</span>
          </h1>
          <p className="hero-sub">
            SwiftMall connects <strong>Kenyan buyers and sellers</strong> on a platform built for speed, simplicity, and trust. Pay securely with <strong>M-Pesa</strong>.
          </p>
          <div className="hero-actions">
            <a href="/register" className="btn-primary">Start Shopping →</a>
            <a href="/login" className="btn-secondary">Sign In</a>
          </div>
        </section>

        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-num">M-Pesa</div>
            <div className="stat-label">Secure Payments</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">24/7</div>
            <div className="stat-label">Always Online</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">Fast</div>
            <div className="stat-label">Instant Orders</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">100%</div>
            <div className="stat-label">Kenyan Built</div>
          </div>
        </div>

        <div className="features" id="features">
          {features.map(f => (
            <div className="feature" key={f.title}>
              <span className="feature-icon">{f.icon}</span>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>

        <section className="cta-section">
          <h2 className="cta-title">Ready to get started?</h2>
          <p className="cta-sub">Join SwiftMall today — it is free to sign up.</p>
          <div className="cta-buttons">
            <a href="/register" className="btn-primary">Create Account →</a>
            <a href="/login" className="btn-secondary">Already have an account</a>
          </div>
        </section>

        <footer className="footer">
          <div>2026 SwiftMall. Proudly Kenyan.</div>
          <div>Built with love for the Kenyan market</div>
        </footer>
      </div>
    </>
  );
};

export default Home;
