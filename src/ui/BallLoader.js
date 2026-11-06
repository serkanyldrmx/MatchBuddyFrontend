import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import './BallLoader.css';

// Klasik beşgen desenli top (viewBox 0 0 100 100; dış parçalar daireyle kırpılır)
const CENTER = 'M50 35L64.3 45.4L58.8 62.1L41.2 62.1L35.7 45.4Z';
const OUTER =
  'M50 18L35.7 7.6L41.2 -9.1L58.8 -9.1L64.3 7.6Z' +
  'M80.4 40.1L85.9 23.3L103.5 23.3L109 40.1L94.7 50.5Z' +
  'M68.8 75.9L86.4 75.9L91.9 92.7L77.6 103L63.4 92.7Z' +
  'M31.2 75.9L36.6 92.7L22.4 103L8.1 92.7L13.6 75.9Z' +
  'M19.6 40.1L5.3 50.5L-9 40.1L-3.5 23.3L14.1 23.3Z';
const SEAMS =
  'M50 35L50 18M64.3 45.4L80.4 40.1M58.8 62.1L68.8 75.9M41.2 62.1L31.2 75.9M35.7 45.4L19.6 40.1' +
  'M64.3 7.6L85.9 23.3M94.7 50.5L86.4 75.9M63.4 92.7L36.6 92.7M13.6 75.9L5.3 50.5M14.1 23.3L35.7 7.6';

function BallSvg() {
  const uid = useId().replace(/:/g, '');
  const clip = `mbball-c-${uid}`;
  const shade = `mbball-s-${uid}`;
  return (
    <svg className="mb-ball__svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clip}>
          <circle cx="50" cy="50" r="47" />
        </clipPath>
        <radialGradient id={shade} cx="36%" cy="30%" r="75%">
          <stop offset="55%" stopColor="#0b1220" stopOpacity="0" />
          <stop offset="100%" stopColor="#0b1220" stopOpacity="0.38" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="#f4f7fb" />
      <g clipPath={`url(#${clip})`}>
        <path d={SEAMS} fill="none" stroke="#1b2433" strokeWidth="2.4" strokeLinecap="round" />
        <path d={CENTER + OUTER} fill="#0b1220" />
        <circle cx="50" cy="50" r="47" fill={`url(#${shade})`} />
      </g>
      <circle className="mb-ball__ring" cx="50" cy="50" r="47" fill="none" stroke="#c6f432" strokeWidth="3.5" />
    </svg>
  );
}

const SIZE_CLASS = { small: 'mb-ball--sm', default: 'mb-ball--md', large: 'mb-ball--lg' };

/**
 * Futbol topu yükleme animasyonu (zıplayan, ezilip uzayan top + zemin gölgesi).
 * size: 'small' (satır içi) | 'default' | 'large'; caption: altta kısa metin (ör. "Yükleniyor…")
 * antd Spin'in varsayılan göstergesi olarak da kullanılır (className / percent Spin'den gelir).
 */
export default function BallLoader({ size = 'default', caption, className, style, percent, ...rest }) {
  const { t } = useTranslation();
  const ball = (
    <span
      className={['mb-ball', SIZE_CLASS[size] || SIZE_CLASS.default, caption ? '' : className].filter(Boolean).join(' ')}
      style={caption ? undefined : style}
      role={caption ? undefined : 'status'}
      aria-label={caption ? undefined : t('common:status.loadingShort')}
      {...(caption ? {} : rest)}
    >
      <span className="mb-ball__shadow" />
      <span className="mb-ball__hop">
        <span className="mb-ball__squash">
          <BallSvg />
        </span>
      </span>
    </span>
  );
  if (!caption) return ball;
  return (
    <div className={['mb-ball-loader', className].filter(Boolean).join(' ')} style={style} role="status" {...rest}>
      {ball}
      <span className="mb-ball-loader__caption">{caption}</span>
    </div>
  );
}

/** Tüm sayfa / büyük bölüm yüklenirken: ortalanmış büyük top + açıklama; yükseklik sabit, yerleşim zıplamaz */
export function PageLoader({ caption, minHeight = '50vh', style, className }) {
  const { t } = useTranslation();
  return (
    <div className={['mb-page-loader', className].filter(Boolean).join(' ')} style={{ minHeight, ...style }}>
      <BallLoader size="large" caption={caption ?? t('common:status.loading')} />
    </div>
  );
}
