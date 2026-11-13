import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRightOutlined, ArrowUpOutlined, CloseOutlined, MenuOutlined } from '@ant-design/icons';
import { getToken } from '../../api/config';
import { getCurrentUser } from '../../utils/format';
import { homePathFor } from '../../utils/roles';
import Logo from '../../images/logo.png';
import { prefersReducedMotion, useRevealAll } from './landingHooks';
import './Landing.css';
import './Site.css';

/*
 * Tanıtım sitesinin ortak kabuğu: üst menü, alt bilgi, sayfa geçişi ve imleç efektleri.
 * Ana sayfa ("/"), Mesajlaşma ("/mesajlasma") ve İşletmeler ("/isletmeler") bunu kullanır.
 */

// Menü: "/#id" ana sayfadaki bölüme, diğerleri ayrı sayfaya gider
export const NAV = [
  { key: 'story', to: '/#story' },
  { key: 'features', to: '/#features' },
  { key: 'messaging', to: '/mesajlasma' },
  { key: 'business', to: '/isletmeler' },
  { key: 'faq', to: '/#faq' },
];

export function LandingBrand() {
  return (
    <span className="lp-brand">
      <span className="lp-brand__mark">
        <img src={Logo} alt="" />
      </span>
      <span className="lp-brand__name">
        Matc<em>Buddy</em>
      </span>
    </span>
  );
}

export const scrollToId = (id) => {
  if (id === 'top') {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    return;
  }
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
};

/** Ana sayfadaki bölüm bağlantıları başka sayfadan tıklanınca da çalışsın */
function useNavGo(setOpen) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (to) => (e) => {
    setOpen?.(false);
    const [path, hash] = to.split('#');
    if (hash && pathname === (path || '/')) {
      e.preventDefault();
      scrollToId(hash);
      return;
    }
    e.preventDefault();
    navigate(to);
  };
}

/* ---------------- Metni kelime kelime açan başlık ---------------- */
/**
 * "Boş saat <em>kalmasın</em>" gibi basit işaretlemeyi (<em>, <br/>) kelimelere böler;
 * görünür alana girince her kelime maskenin altından sırayla yükselir.
 */
export function RevealText({ text, as: Tag = 'span', className = '', delay = 0 }) {
  const parts = String(text || '')
    .split(/(<em>.*?<\/em>|<br\s*\/?>)/g)
    .filter(Boolean);
  const plain = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  let i = 0;
  const words = (raw) =>
    raw.split(/(\s+)/).map((w, j) => {
      if (!w) return null;
      if (/^\s+$/.test(w)) return ' ';
      const node = (
        <span className="lp-split__w" key={j}>
          <span style={{ '--i': i }}>{w}</span>
        </span>
      );
      i += 1;
      return node;
    });
  return (
    <Tag className={`lp-split ${className}`} data-reveal style={{ '--rd': `${delay}ms` }} aria-label={plain}>
      <span aria-hidden="true">
        {parts.map((p, k) => {
          if (/^<br/.test(p)) return <br key={k} />;
          if (p.startsWith('<em>')) return <em key={k}>{words(p.slice(4, -5))}</em>;
          return <React.Fragment key={k}>{words(p)}</React.Fragment>;
        })}
      </span>
    </Tag>
  );
}

export function SectionHead({ eyebrow, title, text, left, className = '' }) {
  return (
    <div className={`lp-head ${left ? 'is-left' : ''} ${className}`}>
      <span className="lp-eyebrow" data-reveal>
        <span className="lp-eyebrow__line" /> {eyebrow}
      </span>
      <RevealText as="h2" className="lp-h2" text={title} />
      {text && (
        <p className="lp-lead" data-reveal style={{ '--rd': '160ms' }}>
          {text}
        </p>
      )}
    </div>
  );
}

/* ---------------- Son çağrı (tüm sayfalarda) ---------------- */
/** actions: [{ to | href, label, icon, primary }] */
export function SiteCta({ title, text, actions = [], avatars }) {
  return (
    <section className="lp-final">
      <div className="lp-wrap">
        <div className="lp-final__box" data-reveal data-spot>
          <svg className="lp-final__lines" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true">
            <rect x="10" y="10" width="780" height="280" rx="6" />
            <line x1="400" y1="10" x2="400" y2="290" />
            <circle cx="400" cy="150" r="60" />
            <rect x="10" y="80" width="90" height="140" />
            <rect x="700" y="80" width="90" height="140" />
          </svg>
          <span className="lp-final__orb" aria-hidden="true" />
          {avatars}
          <RevealText as="h2" className="lp-h2" text={title} />
          <p>{text}</p>
          <div className="lp-actions is-center">
            {actions.map((a) => {
              const cls = `lp-btn is-lg ${a.primary ? 'is-primary' : 'is-ghost'}`;
              return a.href ? (
                <a key={a.label} href={a.href} className={cls}>
                  {a.icon} {a.label}
                </a>
              ) : (
                <Link key={a.label} to={a.to} className={cls}>
                  {a.icon} {a.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Kaydırmaya bağlı çizim ---------------- */
/**
 * Öğe ekranda ilerledikçe fn(rect, vh) çağrılır (rAF ile, scroll başına en fazla bir kez).
 * Durum güncellemek yerine doğrudan stil yazmak için tasarlandı; React yeniden çizilmez.
 */
export function useScrollFrame(ref, fn) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let raf = 0;
    const run = () => {
      raf = 0;
      const el = ref.current;
      if (el) fnRef.current(el.getBoundingClientRect(), window.innerHeight, el);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    run();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [ref]);
}

export const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* ---------------- İmleç efektleri (tek dinleyici) ---------------- */
// [data-spot]: kart üzerinde imleci izleyen ışık · [data-magnetic] ve büyük düğmeler: imlece hafifçe çekilme
// [data-tilt]: maket üzerinde 3B eğim · kökte --cx/--cy: sayfa genelinde yumuşak ışık halesi
function usePointerFx(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion() || !window.matchMedia?.('(pointer: fine)').matches) return undefined;
    let raf = 0;
    let last = null;
    let mag = null;
    let tilt = null;

    const release = (el, kind) => {
      if (!el) return;
      if (kind === 'mag') el.style.translate = '';
      else {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      }
    };

    const apply = () => {
      raf = 0;
      const e = last;
      if (!e) return;
      root.style.setProperty('--cx', `${e.clientX}px`);
      root.style.setProperty('--cy', `${e.clientY}px`);
      const t = e.target instanceof Element ? e.target : null;

      const spot = t?.closest('[data-spot]');
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty('--sx', `${e.clientX - r.left}px`);
        spot.style.setProperty('--sy', `${e.clientY - r.top}px`);
      }

      const m = t?.closest('[data-magnetic], .lp-btn.is-lg');
      if (mag && mag !== m) release(mag, 'mag');
      mag = m;
      if (m) {
        const r = m.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.18;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.28;
        m.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
      }

      const tl = t?.closest('[data-tilt]');
      if (tilt && tilt !== tl) release(tilt, 'tilt');
      tilt = tl;
      if (tl) {
        const r = tl.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        tl.style.setProperty('--ry', `${(px * 8).toFixed(2)}deg`);
        tl.style.setProperty('--rx', `${(-py * 6).toFixed(2)}deg`);
      }
    };

    const onMove = (e) => {
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      release(mag, 'mag');
      release(tilt, 'tilt');
      mag = null;
      tilt = null;
    };
    root.classList.add('has-pointer');
    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove('has-pointer');
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
    };
  }, [rootRef]);
}

/* ---------------- Üst menü ---------------- */
function Nav({ sections }) {
  const { t } = useTranslation('landing');
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState(null);
  const [open, setOpen] = useState(false);
  const barRef = useRef(null);
  const go = useNavGo(setOpen);
  const loggedIn = !!(getCurrentUser() && getToken());

  useEffect(() => {
    let raf = 0;
    const run = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(window.scrollY > 12);
      if (barRef.current) barRef.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      let current = null;
      (sections || []).forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) current = id;
      });
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    run();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [sections]);

  // Telefonda açık menü: dışarı dokununca, Esc ile ya da sayfa kaydırılınca kapanır
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const isActive = (to) => {
    const [path, hash] = to.split('#');
    if (hash) return pathname === '/' && active === hash;
    return pathname === path;
  };

  return (
    <>
    {/* Menünün arkası (header'ın dışında: backdrop-filter sabit konumlu çocukları header'a hapseder) */}
    {open && <button type="button" className="lp-nav__scrim" aria-label={t('nav.closeMenu')} onClick={() => setOpen(false)} />}
    <header className={`lp-nav ${scrolled ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`}>
      <div className="lp-wrap lp-nav__row">
        <Link to="/" onClick={go('/#top')} className="lp-nav__brand" aria-label="MatcBuddy">
          <LandingBrand />
        </Link>
        <nav className="lp-nav__links" aria-label={t('nav.menu')}>
          {NAV.map((n) => (
            <a key={n.key} href={n.to} onClick={go(n.to)} className={isActive(n.to) ? 'is-active' : ''}>
              {t(`nav.${n.key}`)}
              {!n.to.includes('#') && <span className="lp-nav__new" aria-hidden="true" />}
            </a>
          ))}
        </nav>
        <div className="lp-nav__cta">
          {loggedIn ? (
            <Link to={homePathFor(getCurrentUser())} className="lp-btn is-primary is-sm">
              {t('nav.openApp')} <ArrowRightOutlined />
            </Link>
          ) : (
            <>
              <Link to="/login" className="lp-btn is-ghost is-sm">
                {t('nav.login')}
              </Link>
              {/* İşletmeler sayfasında oyuncu kaydı değil işletme başvurusu */}
              {pathname.startsWith('/isletme') ? (
                <Link to="/isletme-basvuru" className="lp-btn is-primary is-sm">
                  {t('nav.apply')}
                </Link>
              ) : (
                <Link to="/register" className="lp-btn is-primary is-sm">
                  {t('nav.register')}
                </Link>
              )}
            </>
          )}
          <button
            type="button"
            className="lp-nav__burger"
            aria-label={t('nav.menu')}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <CloseOutlined /> : <MenuOutlined />}
          </button>
        </div>
      </div>
      <nav className="lp-nav__drawer" aria-label={t('nav.menu')}>
        {NAV.map((n, i) => (
          <a key={n.key} href={n.to} onClick={go(n.to)} style={{ '--i': i }}>
            {t(`nav.${n.key}`)} <ArrowRightOutlined />
          </a>
        ))}
      </nav>
      <span className="lp-nav__progress" ref={barRef} aria-hidden="true" />
    </header>
    </>
  );
}

/* ---------------- Alt bilgi ---------------- */
function Footer() {
  const { t } = useTranslation('landing');
  const go = useNavGo();
  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer__mega" aria-hidden="true">
        Matc<em>Buddy</em>
      </div>
      <div className="lp-wrap lp-footer__grid">
        <div className="lp-footer__brand">
          <LandingBrand />
          <p>{t('footer.tagline')}</p>
        </div>
        <div>
          <strong>{t('footer.product')}</strong>
          {['/#story', '/#features', '/#try', '/#faq'].map((to) => (
            <a key={to} href={to} onClick={go(to)}>
              {t(`nav.${to.slice(2)}`)}
            </a>
          ))}
        </div>
        <div>
          <strong>{t('footer.pages')}</strong>
          <Link to="/mesajlasma">{t('nav.messaging')}</Link>
          <Link to="/isletmeler">{t('nav.business')}</Link>
          <Link to="/terms">{t('footer.terms')}</Link>
        </div>
        <div>
          <strong>{t('footer.account')}</strong>
          <Link to="/login">{t('nav.login')}</Link>
          <Link to="/register">{t('nav.register')}</Link>
          <Link to="/forgot-password">{t('footer.forgot')}</Link>
        </div>
      </div>
      <div className="lp-wrap lp-footer__bottom">
        <span>
          © {new Date().getFullYear()} MatcBuddy · {t('footer.rights')}
        </span>
        <button type="button" onClick={() => scrollToId('top')}>
          {t('footer.top')} <ArrowUpOutlined />
        </button>
      </div>
    </footer>
  );
}

/**
 * Tanıtım sayfası kabuğu. Yerel uygulamada (Capacitor) tanıtım atlanır, giriş ekranı açılır.
 * redirectIfLoggedIn: oturum açıksa doğrudan uygulamaya git (yalnızca ana sayfa için).
 */
export default function SiteShell({ title, sections, theme = '', redirectIfLoggedIn = false, children }) {
  const rootRef = useRef(null);
  const { pathname, hash } = useLocation();
  useRevealAll(rootRef, pathname);
  usePointerFx(rootRef);

  useEffect(() => {
    const prev = document.title;
    if (title) document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);

  // Sayfa değişince en üste; "/#bolum" ile gelindiyse o bölüme kaydır
  useEffect(() => {
    if (hash && hash.length > 1) {
      const id = hash.slice(1);
      const timer = setTimeout(() => scrollToId(id), 80);
      return () => clearTimeout(timer);
    }
    window.scrollTo(0, 0);
    return undefined;
  }, [pathname, hash]);

  const user = getCurrentUser();
  if (redirectIfLoggedIn && user && getToken()) return <Navigate to={homePathFor(user)} replace />;
  if (window.Capacitor?.isNativePlatform?.()) return <Navigate to="/login" replace />;

  return (
    <div className={`lp ${theme}`} ref={rootRef}>
      <div className="lp-aura" aria-hidden="true" />
      <div className="lp-grain" aria-hidden="true" />
      <Nav sections={sections} />
      <main id="top" className="lp-page" key={pathname}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
