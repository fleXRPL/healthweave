'use client';

import Link from 'next/link';
import { Dna, Plus, Clock, Info } from 'lucide-react';

interface HeaderProps {
  pastReportsAsToggle?: boolean;
  onPastReportsClick?: () => void;
}

export default function Header({ pastReportsAsToggle, onPastReportsClick }: HeaderProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(212,225,239,0.7)',
        boxShadow: '0 1px 20px rgba(41,98,139,0.07)',
      }}
    >
      <div
        style={{
          maxWidth: '72rem',
          margin: '0 auto',
          padding: '0 1.5rem',
          height: '4rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        {/* ── Brand ──────────────────────────────────────────────────── */}
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}
          aria-label="HealthWeave – Home"
        >
          {/* Gradient DNA icon — from Magic Patterns design */}
          <div
            style={{
              background: 'linear-gradient(135deg, var(--hw-navy-dark) 0%, var(--hw-teal) 100%)',
              padding: '0.4rem',
              borderRadius: '0.6rem',
              boxShadow: '0 2px 8px rgba(41,98,139,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'box-shadow 0.2s',
            }}
          >
            <Dna size={20} color="white" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontFamily: 'Geist, sans-serif',
                fontWeight: 800,
                fontSize: '1.15rem',
                lineHeight: 1,
                color: 'var(--hw-navy-dark)',
                letterSpacing: '-0.02em',
              }}
            >
              HealthWeave
            </span>
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--hw-teal)',
                marginTop: '0.15rem',
              }}
            >
              Synthesizing Your Health Story
            </span>
          </div>
        </Link>

        {/* ── Nav ────────────────────────────────────────────────────── */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} aria-label="Main">
          {pastReportsAsToggle && typeof onPastReportsClick === 'function' ? (
            <NavBtn as="button" onClick={onPastReportsClick}>
              <Clock size={14} /> Past Reports
            </NavBtn>
          ) : (
            <NavBtn as="link" href="/">
              <Clock size={14} /> Past Reports
            </NavBtn>
          )}

          <NavBtn as="link" href="/about">
            <Info size={14} /> About
          </NavBtn>

          <div style={{ width: '1px', height: '1.25rem', background: 'var(--border)', margin: '0 0.25rem' }} />

          <NavBtn as="link" href="/" primary>
            <Plus size={14} /> New Analysis
          </NavBtn>
        </nav>
      </div>
    </header>
  );
}

/* ── Tiny NavBtn helper ─────────────────────────────────────────────────────── */
type NavBtnProps =
  | { as: 'button'; onClick: () => void; primary?: boolean; children: React.ReactNode }
  | { as: 'link';   href: string;         primary?: boolean; children: React.ReactNode };

function NavBtn(props: NavBtnProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.4rem 0.85rem',
    borderRadius: '0.55rem',
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'all 0.15s',
    border: props.primary
      ? '1px solid rgba(70,147,195,0.35)'
      : '1px solid var(--border)',
    background: props.primary ? 'rgba(70,147,195,0.08)' : 'var(--surface-0)',
    color: props.primary ? 'var(--hw-navy)' : '#4b5563',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  };

  if (props.as === 'button') {
    return (
      <button type="button" onClick={props.onClick} style={base}>
        {props.children}
      </button>
    );
  }
  return (
    <Link href={props.href} style={base}>
      {props.children}
    </Link>
  );
}
