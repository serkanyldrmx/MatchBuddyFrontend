import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Grid } from 'antd';
import {
  BankOutlined,
  CloudOutlined,
  EllipsisOutlined,
  FireOutlined,
  HomeOutlined,
  NotificationOutlined,
  ShoppingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { expenseCategoryLabel, formatPrice } from '../api/venues';
import i18n, { intlLocale } from '../i18n';

/* =========================================================
   Gelir & Gider grafikleri — kütüphanesiz, düz SVG / CSS.
   Renkler: gelir = --mb-primary, gider = --mb-danger, harici = --mb-info.
   ========================================================= */

export const INCOME_COLOR = 'var(--mb-primary)';
export const EXPENSE_COLOR = 'rgba(244, 63, 94, 0.88)';
export const MANUAL_COLOR = 'var(--mb-info)';

/** Gider kategorileri: sabit sıra ve renk (kategori her yerde aynı rengi taşır) */
export const CATEGORY_META = {
  Personel: { color: 'rgba(56, 189, 248, 1)', icon: <TeamOutlined /> },
  Kira: { color: 'rgba(251, 146, 60, 1)', icon: <HomeOutlined /> },
  Elektrik: { color: 'rgba(251, 191, 36, 1)', icon: <ThunderboltOutlined /> },
  Su: { color: 'rgba(45, 212, 191, 1)', icon: <CloudOutlined /> },
  Doğalgaz: { color: 'rgba(244, 114, 182, 1)', icon: <FireOutlined /> },
  'Bakım-onarım': { color: 'rgba(167, 139, 250, 1)', icon: <ToolOutlined /> },
  Malzeme: { color: 'rgba(74, 222, 128, 1)', icon: <ShoppingOutlined /> },
  Vergi: { color: 'rgba(244, 63, 94, 1)', icon: <BankOutlined /> },
  Reklam: { color: 'rgba(129, 140, 248, 1)', icon: <NotificationOutlined /> },
  Diğer: { color: 'rgba(148, 163, 184, 1)', icon: <EllipsisOutlined /> },
};
export const categoryMeta = (c) => CATEGORY_META[c] || CATEGORY_META['Diğer'];

/** Kategori çipi: renkli ikon + ad */
export function CategoryChip({ category, compact }) {
  useTranslation();
  const m = categoryMeta(category);
  return (
    <span className={`mb-fin-cat${compact ? ' is-compact' : ''}`}>
      <span className="mb-fin-cat__icon" style={{ color: m.color, background: m.color.replace(', 1)', ', 0.14)') }}>
        {m.icon}
      </span>
      {expenseCategoryLabel(category || 'Diğer')}
    </span>
  );
}

const compactFmt = { format: (v) => new Intl.NumberFormat(intlLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(v) };
export const compactPrice = (v) => i18n.t('common:currency', { value: compactFmt.format(Number(v) || 0) });
export const pctFmt = (v, digits = 1) =>
  i18n.t('finance:percent', {
    value: Number(v || 0).toLocaleString(intlLocale(), { maximumFractionDigits: digits, minimumFractionDigits: 0 }),
  });

/* ---------- yardımcılar ---------- */

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => setW(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function scale(min, max, count = 4) {
  if (max - min <= 0) max = min + 1000;
  const step = niceStep((max - min) / count);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}

/** Yalnızca veri ucunda yuvarlatılmış çubuk (y0 = değer ucu, y1 = taban) */
function barPath(x, y0, y1, w, r = 4) {
  const h = Math.abs(y1 - y0);
  if (h < 0.5 || w <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  if (y0 < y1) {
    return `M${x},${y1}V${y0 + rr}Q${x},${y0} ${x + rr},${y0}H${x + w - rr}Q${x + w},${y0} ${x + w},${y0 + rr}V${y1}Z`;
  }
  return `M${x},${y1}V${y0 - rr}Q${x},${y0} ${x + rr},${y0}H${x + w - rr}Q${x + w},${y0} ${x + w},${y0 - rr}V${y1}Z`;
}

/** Telefon (< md): eksen boşluğu ve etiketler sıkıştırılır, ipucu kutusu grafiğin içinde tutulur */
const usePhone = () => Grid.useBreakpoint().md === false;
const TIP_W = 170; // .mb-fin-tip min-width

function Tip({ x, y, width, narrow, children }) {
  if (narrow) {
    // ipucunu grafiğin sınırları içinde tut (sayfayı yatay taşırmasın)
    const left = Math.max(0, Math.min(x - TIP_W / 2, width - TIP_W));
    return (
      <div className="mb-fin-tip is-free" style={{ left, top: y }}>
        {children}
      </div>
    );
  }
  const left = Math.max(8, Math.min(x, width - 8));
  const flip = x > width - 120 ? 'is-left' : x < 120 ? 'is-right' : '';
  return (
    <div className={`mb-fin-tip ${flip}`} style={{ left, top: y }}>
      {children}
    </div>
  );
}

function TipRow({ color, label, value, line }) {
  return (
    <div className="mb-fin-tip__row">
      <span className={`mb-fin-swatch${line ? ' is-line' : ''}`} style={{ background: color }} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="mb-fin-legend">
      {items.map((i) => (
        <span key={i.label}>
          <span className={`mb-fin-swatch${i.line ? ' is-line' : ''}`} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/* ---------- 12 aylık grafik ---------- */

export function MonthlyChart({ data = [], selected, onSelect, height = 270 }) {
  const { t } = useTranslation();
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const narrow = usePhone();
  const pad = { l: narrow ? 40 : 54, r: narrow ? 6 : 12, t: 14, b: 34 };
  const n = data.length || 12;
  const innerW = Math.max(width - pad.l - pad.r, 10);
  const innerH = height - pad.t - pad.b;

  const { lo, hi, ticks } = useMemo(() => {
    const vals = data.flatMap((d) => [Number(d.income) || 0, Number(d.expenses) || 0, Number(d.net) || 0]);
    return scale(Math.min(0, ...vals), Math.max(0, ...vals));
  }, [data]);
  const y = (v) => pad.t + innerH - ((v - lo) / (hi - lo)) * innerH;
  const band = innerW / n;
  const barW = Math.max(4, Math.min(16, band * 0.28));
  const cx = (i) => pad.l + band * i + band / 2;
  const base = y(0);
  const linePts = data.map((d, i) => `${cx(i)},${y(Number(d.net) || 0)}`).join(' ');
  const isSel = (d) => selected && d.year === selected.year && d.month === selected.month;
  // ay etiketleri sığmıyorsa birer atlayarak yaz (seçili ay her zaman yazılır)
  const labelEvery = narrow && band < 26 ? 2 : 1;
  const showLabel = (i) =>
    labelEvery === 1 || isSel(data[i]) || ((n - 1 - i) % 2 === 0 && !isSel(data[i - 1] || {}) && !isSel(data[i + 1] || {}));

  const h = hover != null ? data[hover] : null;

  return (
    <div className="mb-fin-chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={t('finance:charts.monthlyAria')}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'mb-fin-axis' : 'mb-fin-grid'} />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="mb-fin-tick">
                {compactFmt.format(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const sel = isSel(d);
            const label = dayjs(`${d.year}-${String(d.month).padStart(2, '0')}-01`);
            return (
              <g key={`${d.year}-${d.month}`}>
                {(sel || hover === i) && (
                  <rect
                    x={pad.l + band * i + 2}
                    y={pad.t}
                    width={band - 4}
                    height={innerH}
                    rx={8}
                    className={sel ? 'mb-fin-band is-selected' : 'mb-fin-band'}
                  />
                )}
                <path d={barPath(cx(i) - barW - 1, y(Number(d.income) || 0), base, barW)} fill={INCOME_COLOR} />
                <path d={barPath(cx(i) + 1, y(Number(d.expenses) || 0), base, barW)} fill={EXPENSE_COLOR} />
                {showLabel(i) && (
                  <text x={cx(i)} y={height - pad.b + 16} textAnchor="middle" className={`mb-fin-xlabel${sel ? ' is-selected' : ''}`}>
                    {label.format('MMM')}
                  </text>
                )}
                {(d.month === 1 || i === 0) && (
                  <text x={cx(i)} y={height - pad.b + 29} textAnchor="middle" className="mb-fin-tick">
                    {d.year}
                  </text>
                )}
              </g>
            );
          })}
          {data.length > 1 && <polyline points={linePts} className="mb-fin-netline" />}
          {data.map((d, i) => (
            <circle key={`n-${i}`} cx={cx(i)} cy={y(Number(d.net) || 0)} r={hover === i ? 5 : 3.5} className="mb-fin-netdot" />
          ))}
          {data.map((d, i) => (
            <rect
              key={`hit-${i}`}
              x={pad.l + band * i}
              y={pad.t}
              width={band}
              height={innerH + pad.b}
              fill="transparent"
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(d.year, d.month)}
            >
              <title>{t('finance:charts.clickToSelect', { month: d.month, year: d.year })}</title>
            </rect>
          ))}
        </svg>
      )}
      {h && (
        <Tip x={cx(hover)} y={pad.t} width={width} narrow={narrow}>
          <div className="mb-fin-tip__title">{dayjs(`${h.year}-${String(h.month).padStart(2, '0')}-01`).format('MMMM YYYY')}</div>
          <TipRow color={INCOME_COLOR} label={t('finance:income')} value={formatPrice(h.income || 0)} />
          <TipRow color={EXPENSE_COLOR} label={t('finance:expense')} value={formatPrice(h.expenses || 0)} />
          <TipRow color="var(--mb-text)" line label={t('finance:netProfit')} value={formatPrice(h.net || 0)} />
        </Tip>
      )}
    </div>
  );
}

/* ---------- günlük akış (gelir yukarı, gider aşağı) ---------- */

export function DailyChart({ data = [], height = 270 }) {
  const { t } = useTranslation();
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const narrow = usePhone();
  const pad = { l: narrow ? 40 : 54, r: narrow ? 6 : 10, t: 14, b: 26 };
  const n = data.length || 30;
  const innerW = Math.max(width - pad.l - pad.r, 10);
  const innerH = height - pad.t - pad.b;
  const maxI = Math.max(0, ...data.map((d) => Number(d.income) || 0));
  const maxE = Math.max(0, ...data.map((d) => Number(d.expense) || 0));
  const { lo, hi, ticks } = useMemo(() => scale(-maxE, maxI, 4), [maxI, maxE]);
  const y = (v) => pad.t + innerH - ((v - lo) / (hi - lo)) * innerH;
  const band = innerW / n;
  const barW = Math.max(2, Math.min(14, band * 0.62));
  const x = (i) => pad.l + band * i + (band - barW) / 2;
  const base = y(0);
  const today = dayjs();
  const h = hover != null ? data[hover] : null;

  return (
    <div className="mb-fin-chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={t('finance:charts.dailyAria')}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'mb-fin-axis' : 'mb-fin-grid'} />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="mb-fin-tick">
                {compactFmt.format(Math.abs(t))}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const dd = dayjs(d.date);
            const day = dd.date();
            const isToday = dd.isSame(today, 'day');
            return (
              <g key={d.date} opacity={hover == null || hover === i ? 1 : 0.55}>
                <path d={barPath(x(i), y(Number(d.income) || 0), base - 1, barW, 3)} fill={INCOME_COLOR} />
                <path d={barPath(x(i), y(-(Number(d.expense) || 0)), base + 1, barW, 3)} fill={EXPENSE_COLOR} />
                {(day === 1 || day % 5 === 0 || isToday) && (
                  <text x={x(i) + barW / 2} y={height - 8} textAnchor="middle" className={`mb-fin-xlabel${isToday ? ' is-selected' : ''}`}>
                    {day}
                  </text>
                )}
              </g>
            );
          })}
          {data.map((d, i) => (
            <rect
              key={`hit-${d.date}`}
              x={pad.l + band * i}
              y={pad.t}
              width={band}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(i)}
            />
          ))}
        </svg>
      )}
      {h && (
        <Tip x={x(hover) + barW / 2} y={pad.t} width={width} narrow={narrow}>
          <div className="mb-fin-tip__title">{dayjs(h.date).format('DD MMMM dddd')}</div>
          <TipRow color={INCOME_COLOR} label={t('finance:income')} value={formatPrice(h.income || 0)} />
          <TipRow color={EXPENSE_COLOR} label={t('finance:expense')} value={formatPrice(h.expense || 0)} />
          <TipRow color="var(--mb-text)" line label={t('finance:charts.difference')} value={formatPrice((h.income || 0) - (h.expense || 0))} />
        </Tip>
      )}
    </div>
  );
}

/* ---------- gelir kaynağı (yığılmış yatay çubuk) ---------- */

const SOURCE_LABEL_KEYS = { matches: 'finance:charts.sourceLabel.matches', manual: 'finance:charts.sourceLabel.manual' };
const SOURCE_COLOR = { matches: INCOME_COLOR, manual: MANUAL_COLOR };

export function SourceSplit({ items = [] }) {
  const { t } = useTranslation();
  const sourceLabel = (s) => (SOURCE_LABEL_KEYS[s] ? t(SOURCE_LABEL_KEYS[s]) : s);
  const rows = items.map((i) => ({ ...i, amount: Number(i.amount) || 0 }));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="mb-fin-split">
      <div className="mb-fin-split__bar" role="img" aria-label={t('finance:charts.sourceAria')}>
        {total > 0 ? (
          rows
            .filter((r) => r.amount > 0)
            .map((r) => (
              <span
                key={r.source}
                style={{ flexGrow: r.amount, background: SOURCE_COLOR[r.source] || 'var(--mb-text-3)' }}
                title={`${sourceLabel(r.source)}: ${formatPrice(r.amount)}`}
              />
            ))
        ) : (
          <span className="is-empty" />
        )}
      </div>
      <div className="mb-fin-split__legend">
        {rows.map((r) => (
          <div key={r.source}>
            <span className="mb-fin-swatch" style={{ background: SOURCE_COLOR[r.source] || 'var(--mb-text-3)' }} />
            <span className="mb-fin-split__label">{sourceLabel(r.source)}</span>
            <strong>{formatPrice(r.amount)}</strong>
            <em>{total > 0 ? pctFmt((r.amount / total) * 100, 0) : '—'}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- yatay çubuk listesi (saha / kategori) ---------- */

export function HBarList({ rows, emptyText }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (!rows.length) return <div className="mb-fin-muted">{emptyText}</div>;
  return (
    <div className="mb-fin-hbars">
      {rows.map((r) => (
        <div key={r.key} className="mb-fin-hbar">
          <div className="mb-fin-hbar__head">
            <span className="mb-fin-hbar__label">{r.label}</span>
            <span className="mb-fin-hbar__value">
              <strong>{formatPrice(r.value)}</strong>
              {r.meta && <em>{r.meta}</em>}
            </span>
          </div>
          <div className="mb-fin-hbar__track">
            <span style={{ width: `${max > 0 ? Math.max((r.value / max) * 100, r.value > 0 ? 1.5 : 0) : 0}%`, background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
