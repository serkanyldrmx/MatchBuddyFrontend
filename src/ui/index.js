import React from 'react';
import { Avatar, Empty, Progress, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { initials, mediaUrl } from '../utils/format';
import './common.css';

export { default as BallLoader, PageLoader } from './BallLoader';

const { Title, Text } = Typography;

/**
 * Her sayfanın üstünde kullanılan standart başlık alanı.
 * eyebrow: küçük üst etiket, title: sayfa başlığı, subtitle: kısa açıklama, extra: sağdaki aksiyonlar
 */
export function PageHeader({ title, subtitle, extra, icon, eyebrow }) {
  return (
    <div className="mb-page-header">
      <div className="mb-page-header__text">
        {eyebrow && <span className="mb-page-header__eyebrow">{eyebrow}</span>}
        <Title level={2} className="mb-page-header__title">
          {icon && <span className="mb-page-header__icon">{icon}</span>}
          {title}
        </Title>
        {subtitle && <Text type="secondary">{subtitle}</Text>}
      </div>
      {extra && <div className="mb-page-header__extra">{extra}</div>}
    </div>
  );
}

/** Oyuncu avatarı: resim varsa resim, yoksa baş harfler (küçük avatarlarda sm, ≥ 96 px'te md boyu) */
export function PlayerAvatar({ player, size = 40, ...rest }) {
  const src = mediaUrl(player?.profilePictureUrl, typeof size === 'number' && size >= 96 ? 'md' : 'sm');
  return (
    <Avatar size={size} src={src} className="mb-avatar" {...rest}>
      {!src && initials(player)}
    </Avatar>
  );
}

// Maç durumları (Match.IsActive): 1 = onay bekliyor, 2 = onaylandı, 3 = reddedildi
const matchStatus = (key, className, color) => ({
  className,
  color,
  get label() {
    return i18n.t(key);
  },
});
export const MATCH_STATUS = {
  1: matchStatus('common:status.pending', 'is-pending', 'gold'),
  2: matchStatus('common:status.approved', 'is-approved', 'green'),
  3: matchStatus('common:status.rejected', 'is-rejected', 'red'),
};

export function MatchStatusTag({ status, past }) {
  const { t } = useTranslation();
  if (past && status !== 3) return <span className="mb-chip is-done">{t('common:status.completed')}</span>;
  const s = MATCH_STATUS[status] || { label: t('common:status.unknown'), className: 'is-done' };
  return <span className={`mb-chip ${s.className}`}>{s.label}</span>;
}

/** Kadro doluluk halkası: 7/10 */
export function CapacityRing({ going = 0, capacity = 0, size = 46, label }) {
  const { t } = useTranslation();
  const pct = capacity ? Math.min(Math.round((going / capacity) * 100), 100) : 0;
  const full = capacity && going >= capacity;
  return (
    <div className="mb-capacity">
      <Progress
        type="circle"
        size={size}
        percent={pct}
        showInfo={false}
        strokeWidth={10}
        strokeColor={full ? 'var(--mb-gold)' : 'var(--mb-primary)'}
        trailColor="rgba(148,163,184,0.16)"
      />
      <div className="mb-capacity__text">
        <strong>
          {going}/{capacity}
        </strong>
        <span>{full ? t('common:capacity.full') : label ?? t('common:capacity.players')}</span>
      </div>
    </div>
  );
}

/** Büyük rakamlı istatistik */
export function Stat({ value, label, accent }) {
  return (
    <div className="mb-stat">
      <span className="mb-stat__value" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      <span className="mb-stat__label">{label}</span>
    </div>
  );
}

export function EmptyState({ description, children }) {
  const { t } = useTranslation();
  return (
    <div className="mb-empty">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description ?? t('common:noRecords')}>
        {children}
      </Empty>
    </div>
  );
}

/** İkonlu küçük bilgi satırı (tarih, saat, kişi sayısı vb.) */
export function MetaItem({ icon, children }) {
  return (
    <span className="mb-meta-item">
      {icon}
      <span>{children}</span>
    </span>
  );
}
