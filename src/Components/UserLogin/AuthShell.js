import React from 'react';
import { CalendarOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Logo from '../../images/logo.png';
import './Login.css';

// Metinler render anında çevrilir (auth:shell.features.<key>)
const FEATURES = [
  { key: 'squad', icon: <TeamOutlined /> },
  { key: 'booking', icon: <CalendarOutlined /> },
  { key: 'mvp', icon: <TrophyOutlined /> },
];

export function AuthBrand() {
  return (
    <div className="mb-auth__brand">
      <span className="mb-auth__brand-mark">
        <img src={Logo} alt="" />
      </span>
      <span className="mb-auth__brand-name">
        Matc<em>Buddy</em>
      </span>
    </div>
  );
}

/**
 * Giriş / kayıt ekranlarının ortak iskeleti: gece sahası arka planı,
 * masaüstünde solda tanıtım metni, sağda buzlu cam kart.
 */
export default function AuthShell({ wide = false, title, subtitle, children }) {
  const { t } = useTranslation();
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
            <span className="mb-auth__dot" /> {t('auth:shell.eyebrow')}
          </span>
          <h2 className="mb-auth__intro-title">
            <Trans i18nKey="auth:shell.introTitle" components={{ br: <br />, em: <em /> }} />
          </h2>
          <p className="mb-auth__intro-text">
            {t('auth:shell.introText')}
          </p>
          <ul className="mb-auth__features">
            {FEATURES.map((f) => (
              <li key={f.key}>
                <span className="mb-auth__feature-icon">{f.icon}</span>
                <span>
                  <strong>{t(`auth:shell.features.${f.key}.title`)}</strong>
                  <small>{t(`auth:shell.features.${f.key}.text`)}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <main className="mb-auth__card">
          {/* Marka tanıtım sitesine döner */}
          <Link to="/" className="mb-auth__home" aria-label="MatcBuddy">
            <AuthBrand />
          </Link>
          <h1 className="mb-auth__title">{title}</h1>
          {subtitle && <p className="mb-auth__subtitle">{subtitle}</p>}
          {children}
        </main>
      </div>

      <footer className="mb-auth__credit">
        © {new Date().getFullYear()} MatcBuddy · Serkan Yıldırım
      </footer>
    </div>
  );
}
