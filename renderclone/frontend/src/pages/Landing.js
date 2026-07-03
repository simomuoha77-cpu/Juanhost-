import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Globe, Database, Shield, GitBranch, Terminal, ArrowRight, CheckCircle, Server, Cpu } from 'lucide-react';

export default function Landing() {
  return (
    <div style={{ background: '#060612', color: '#e2e8f0', fontFamily: 'Plus Jakarta Sans, sans-serif', minHeight: '100vh' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 64, borderBottom: '1px solid #252545', position: 'sticky', top: 0, background: 'rgba(6,6,18,0.9)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={18} color="#fff" />
          </div>
          <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>Juan<span style={{ color: '#6366f1' }}>Host</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/login" style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>Sign In</Link>
          <Link to="/register" style={{ background: '#6366f1', color: '#fff', padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}>Get Started Free</Link>
        </div>
      </nav>
      <section style={{ padding: '80px 24px 60px', textAlign: 'center', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, padding: '6px 16px', fontSize: '0.8rem', color: '#818cf8', marginBottom: 24 }}>
          <Zap size={13} /> Built for developers who move fast
        </div>
        <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 4rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
          Deploy anything.<br />
          <span style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Scale everywhere.</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#94a3b8', maxWidth: 540, margin: '0 auto 32px', lineHeight: 1.7 }}>
          The fastest way to ship your apps. Deploy Node.js, Python, static sites, databases, and workers in seconds.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" style={{ background: '#6366f1', color: '#fff', padding: '13px 28px', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            Start deploying free <ArrowRight size={16} />
          </Link>
          <Link to="/login" style={{ color: '#e2e8f0', padding: '13px 28px', borderRadius: 10, fontWeight: 600, fontSize: '0.95rem', border: '1px solid #252545', textDecoration: 'none' }}>Sign in</Link>
        </div>
        <p style={{ marginTop: 16, fontSize: '0.8rem', color: '#475569' }}>Free plan available - No credit card required</p>
      </section>
      <section style={{ padding: '40px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 800, marginBottom: 12 }}>Everything you need to ship</h2>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: 40, fontSize: '0.95rem' }}>One platform. Every service type. Zero configuration hell.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {[
            { icon: GitBranch, color: '#6366f1', title: 'Auto Deploy', desc: 'Push to GitHub and your app deploys automatically.' },
            { icon: Globe, color: '#10b981', title: 'Custom Domains + SSL', desc: 'Free subdomains for every service plus your own domain.' },
            { icon: Database, color: '#f59e0b', title: 'Managed Databases', desc: 'PostgreSQL, MySQL, MongoDB, Redis - provisioned in seconds.' },
            { icon: Terminal, color: '#8b5cf6', title: 'Live Logs + Shell', desc: 'Real-time deployment logs and browser-based shell.' },
            { icon: Cpu, color: '#3b82f6', title: 'Metrics & Monitoring', desc: 'CPU, memory, network charts with health checks.' },
            { icon: Shield, color: '#ec4899', title: 'Teams & Security', desc: 'Multi-member teams with role-based access.' }
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} style={{ background: '#0c0c1d', border: '1px solid #252545', borderRadius: 12, padding: 22 }}>
              <div style={{ width: 40, height: 40, background: `${color}1a`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon size={19} color={color} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '0.93rem', marginBottom: 7 }}>{title}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.83rem', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>
      <footer style={{ borderTop: '1px solid #252545', padding: '28px 24px', textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>
        <p>(c) 2024 JuanHost - Deploy anything, scale everywhere.</p>
      </footer>
    </div>
  );
}
