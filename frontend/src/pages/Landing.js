import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Globe, Database, Shield, GitBranch, Terminal, ArrowRight, CheckCircle, Server, Cpu } from 'lucide-react';

export default function Landing() {
  return (
    <div style={{ background: '#060612', color: '#e2e8f0', fontFamily: 'Plus Jakarta Sans, sans-serif', minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', height: 64, borderBottom: '1px solid #252545', position: 'sticky', top: 0, background: 'rgba(6,6,18,0.85)', backdropFilter: 'blur(12px)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={18} color="#fff" />
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>Juan<span style={{ color: '#6366f1' }}>Host</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/login" style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600, padding: '8px 16px' }}>Sign In</Link>
          <Link to="/register" style={{ background: '#6366f1', color: '#fff', padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}>Get Started Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '100px 48px 80px', textAlign: 'center', maxWidth: 900, margin: '0 auto', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, padding: '6px 16px', fontSize: '0.8rem', color: '#818cf8', marginBottom: 24, fontFamily: 'JetBrains Mono, monospace' }}>
          <Zap size={13} /> Built for developers who move fast
        </div>
        <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 4rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: 20, letterSpacing: '-1px' }}>
          Deploy anything.<br />
          <span style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Scale everywhere.</span>
        </h1>
        <p style={{ fontSize: '1.15rem', color: '#94a3b8', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.7 }}>
          The fastest way to ship your apps. Deploy Node.js, Python, static sites, databases, and workers in seconds.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" style={{ background: '#6366f1', color: '#fff', padding: '13px 28px', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            Start deploying free <ArrowRight size={16} />
          </Link>
          <Link to="/login" style={{ background: 'transparent', color: '#e2e8f0', padding: '13px 28px', borderRadius: 10, fontWeight: 600, fontSize: '0.95rem', border: '1px solid #252545', textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
        <p style={{ marginTop: 16, fontSize: '0.8rem', color: '#475569' }}>Free plan available · No credit card required</p>
      </section>

      {/* Features Grid */}
      <section style={{ padding: '60px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 800, marginBottom: 12 }}>Everything you need to ship</h2>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: 48, fontSize: '0.95rem' }}>One platform. Every service type. Zero configuration hell.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {[
            { icon: GitBranch, color: '#6366f1', title: 'Auto Deploy', desc: 'Push to GitHub and your app deploys automatically. Zero downtime deploys with instant rollback.' },
            { icon: Globe, color: '#10b981', title: 'Custom Domains + SSL', desc: 'Free subdomains for every service. Connect your own domain with automatic SSL via Let\'s Encrypt.' },
            { icon: Database, color: '#f59e0b', title: 'Managed Databases', desc: 'PostgreSQL, MySQL, MongoDB, Redis. Provisioned in seconds with automated backups.' },
            { icon: Terminal, color: '#8b5cf6', title: 'Live Logs + Shell', desc: 'Real-time deployment logs, live app logs, and browser-based terminal shell access.' },
            { icon: Cpu, color: '#3b82f6', title: 'Metrics & Monitoring', desc: 'CPU, memory, network charts. Health checks with automatic alerting on failures.' },
            { icon: Shield, color: '#ec4899', title: 'Teams & Security', desc: 'Multi-member teams, role-based access, environment variable secrets, and audit logs.' }
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} style={{ background: '#0c0c1d', border: '1px solid #252545', borderRadius: 12, padding: 24, transition: 'all 0.2s' }}>
              <div style={{ width: 42, height: 42, background: `${color}1a`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Icon size={20} color={color} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 8 }}>{title}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.65 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '60px 48px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 800, marginBottom: 12 }}>Simple pricing</h2>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: 48, fontSize: '0.95rem' }}>Start free. Upgrade when you grow.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { name: 'Free', price: '$0', period: '/month', features: ['3 web services', '1 database', '100GB bandwidth', 'Free subdomains', '400 build minutes/mo'], cta: 'Get started', highlight: false },
            { name: 'Starter', price: '$7', period: '/month', features: ['10 services', '3 databases', '500GB bandwidth', 'Custom domains + SSL', '2000 build minutes/mo', 'Priority deploys'], cta: 'Start free trial', highlight: true },
            { name: 'Pro', price: '$25', period: '/month', features: ['Unlimited services', 'Unlimited databases', 'Unlimited bandwidth', 'Custom domains + SSL', 'Unlimited builds', 'Team collaboration', 'Advanced analytics'], cta: 'Start free trial', highlight: false }
          ].map(plan => (
            <div key={plan.name} style={{ background: plan.highlight ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' : '#0c0c1d', border: `1px solid ${plan.highlight ? '#6366f1' : '#252545'}`, borderRadius: 14, padding: 28, position: 'relative' }}>
              {plan.highlight && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#6366f1', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '3px 12px', borderRadius: 10, fontFamily: 'JetBrains Mono, monospace' }}>MOST POPULAR</div>}
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 900 }}>{plan.price}</span>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{plan.period}</span>
              </div>
              {plan.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: '0.83rem' }}>
                  <CheckCircle size={14} color="#10b981" />
                  <span style={{ color: '#cbd5e1' }}>{f}</span>
                </div>
              ))}
              <Link to="/register" style={{ display: 'block', textAlign: 'center', marginTop: 24, background: plan.highlight ? '#6366f1' : 'transparent', color: plan.highlight ? '#fff' : '#e2e8f0', border: plan.highlight ? 'none' : '1px solid #252545', padding: '11px', borderRadius: 8, fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #252545', padding: '32px 48px', textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={13} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, color: '#94a3b8' }}>JuanHost</span>
        </div>
        <p>© 2024 JuanHost. Deploy anything, scale everywhere.</p>
      </footer>
    </div>
  );
}
