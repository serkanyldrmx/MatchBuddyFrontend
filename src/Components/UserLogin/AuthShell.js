import React from 'react';
import { CalendarOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import Logo from '../../images/mutch_buddy_Logo.png';
import './Login.css';

const FEATURES = [
  { icon: <TeamOutlined />, title: 'Kadronu tamamla', text: 'Eksik oyuncuyu dakikalar içinde bul.' },
  { icon: <CalendarOutlined />, title: 'Halı saha rezervasyonu', text: 'Sahanı seç, saatini ayırt, maçı kur.' },
  { icon: <TrophyOutlined />, title: 'MVP ve puanlar', text: 'Her maçtan sonra oyla, sıralamada yüksel.' },
];

export function AuthBrand() {
  return (
    <div className="mb-auth__brand">
      <span className="mb-auth__brand-mark">
        <img src={Logo} alt="" />
      </span>
      <span className="mb-auth__brand-name">
        Match<em>Buddy</em>
      </span>
    </div>
  );
}

/**
 * Giriş / kayıt ekranlarının ortak iskeleti: gece sahası arka planı,
 * masaüstünde solda tanıtım metni, sağda buzlu cam kart.
 */
export default function AuthShell({ wide = false, title, subtitle, children }) {
  return (
    <div className={`mb-auth${wide ? ' mb-auth--wide' : ''}`}>
      <div className="mb-auth__bg" aria-hidden="true">
        <svg className="mb-auth__lines" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice">
          <line x1="0" y1="398" x2="1200" y2="398" />
          <path d="M440 400 A160 160 0 0 1 760 400" />
          <circle cx="600" cy="400" r="5" />
        </svg>
      </div>

      <div className="mb-auth__shell">
        <section className="mb-auth__intro">
          <span className="mb-auth__eyebrow">
            <span className="mb-auth__dot" /> Bu akşam sahada maç var
          </span>
          <h2 className="mb-auth__intro-title">
            Maçını kur.
            <br />
            <em>Kadronu tamamla.</em>
          </h2>
          <p className="mb-auth__intro-text">
            Takım arkadaşlarını bul, halı sahanı ayırt, maçın yıldızı ol. Hepsi tek yerde.
          </p>
          <ul className="mb-auth__features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="mb-auth__feature-icon">{f.icon}</span>
                <span>
                  <strong>{f.title}</strong>
                  <small>{f.text}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <main className="mb-auth__card">
          <AuthBrand />
          <h1 className="mb-auth__title">{title}</h1>
          {subtitle && <p className="mb-auth__subtitle">{subtitle}</p>}
          {children}
        </main>
      </div>

      <footer className="mb-auth__credit">
        © {new Date().getFullYear()} MatchBuddy · Serkan Yıldırım
      </footer>
    </div>
  );
}
