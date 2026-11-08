import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthShell from '../UserLogin/AuthShell';
import { usePublicParam } from '../../api/parameters';

/**
 * Kullanım koşulları ve KVKK aydınlatma metni (herkese açık sayfa).
 * Metin src/locales/<dil>/legal.json içindedir; içerik değişince sunucudaki legal.termsVersion parametresi
 * güncellenmeli ki kullanıcılardan yeniden onay istensin.
 */
export default function Terms() {
  const { t } = useTranslation('legal');
  const version = usePublicParam('legal.termsVersion');
  const sections = t('sections', { returnObjects: true });

  return (
    <AuthShell wide title={t('title')} subtitle={t('version', { version: version || '-' })}>
      <div className="mb-legal">
        {Array.isArray(sections) && sections.map((s) => (
          <section key={s.heading}>
            <h3>{s.heading}</h3>
            {(s.paragraphs || []).map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
          </section>
        ))}
      </div>
      <p className="mb-auth__switch">
        <Link to="/" className="mb-auth__link">{t('back')}</Link>
      </p>
    </AuthShell>
  );
}
