import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AppstoreOutlined,
  BarChartOutlined,
  BellFilled,
  CalendarOutlined,
  CheckCircleFilled,
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  EnvironmentOutlined,
  ExclamationCircleFilled,
  FieldTimeOutlined,
  LoginOutlined,
  MailOutlined,
  MessageOutlined,
  PictureOutlined,
  SafetyCertificateFilled,
  SettingOutlined,
  StarFilled,
  TagOutlined,
  ThunderboltFilled,
  UnorderedListOutlined,
} from '@ant-design/icons';
import SiteShell, { RevealText, SectionHead, SiteCta, clamp01, useScrollFrame } from './Site';
import { Avatar, PEOPLE, Phone } from './LandingMocks';
import { formatTRY, prefersReducedMotion, useCountUp, useInView, useVisible } from './landingHooks';
import './Business.css';

const CONTACT = 'mailto:bmserkanyildirim@matcbuddy.com?subject=MatcBuddy%20i%C5%9Fletme%20demo';
const MONTHS = ['Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas'];

/* =========================================================
   Hero: kaydırınca düzleşen yönetim paneli
   ========================================================= */
function Kpi({ label, value, run, format = (v) => Math.round(v), sub, tone }) {
  const v = useCountUp(value, run, 1300);
  return (
    <div className={`lp-bc-kpi ${tone || ''}`}>
      <small>{label}</small>
      <b>{format(v)}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}

function BizConsole() {
  const [ref, inView] = useInView({ threshold: 0.2 });
  const side = [
    [AppstoreOutlined, 'Genel Bakış'],
    [CalendarOutlined, 'Takvim'],
    [UnorderedListOutlined, 'Talepler', 3],
    [ClockCircleOutlined, 'Saatler ve fiyatlar'],
    [TagOutlined, 'Kampanyalar'],
    [StarFilled, 'Yorumlar'],
    [BarChartOutlined, 'Gelir & Gider'],
    [SettingOutlined, 'Ayarlar'],
  ];
  const income = [41, 46, 52, 58, 55, 64];
  const expense = [22, 23, 25, 24, 26, 27];
  return (
    <div className={`lp-bc ${inView ? 'is-in' : ''}`} ref={ref}>
      <div className="lp-browser__bar">
        <i />
        <i />
        <i />
        <span>matcbuddy.com/venue</span>
      </div>
      <div className="lp-bc__app">
        <aside className="lp-bc__side">
          <span className="lp-bc__venue">
            <b>YV</b>
            <span>
              <strong>Yeşil Vadi Spor</strong>
              <small>3 saha</small>
            </span>
          </span>
          {side.map(([Icon, label, badge], i) => (
            <span key={label} className={`lp-bc__nav ${i === 0 ? 'is-on' : ''}`}>
              <Icon /> {label}
              {badge && <em>{badge}</em>}
            </span>
          ))}
        </aside>
        <div className="lp-bc__main">
          <div className="lp-bc__hello">
            <strong>İyi akşamlar.</strong>
            <small>Tesisinizin bugünkü durumu aşağıda.</small>
          </div>
          <div className="lp-bc__kpis">
            <Kpi label="Bugünkü maç" value={9} run={inView} sub="3 sahada" />
            <Kpi label="Bekleyen talep" value={3} run={inView} sub="Talepleri gör" tone="is-warn" />
            <Kpi label="Doluluk" value={86} run={inView} format={(v) => `%${Math.round(v)}`} sub="bu hafta" />
            <Kpi label="Haftalık ciro" value={61400} run={inView} format={formatTRY} sub="+%12" tone="is-up" />
            <Kpi label="Puan" value={4.8} run={inView} format={(v) => v.toFixed(1).replace('.', ',')} sub="126 yorum" />
          </div>
          <div className="lp-bc__row">
            <div className="lp-bc__panel">
              <div className="lp-bc__ph">
                <strong>Bekleyen talepler</strong>
                <small>3</small>
              </div>
              {[
                [PEOPLE[0], 'Per 21:00 · Saha 1', 96, 'good'],
                [PEOPLE[4], 'Cum 20:00 · Saha 2', 91, 'good'],
                [PEOPLE[9], 'Cmt 11:00 · Saha 1', 64, 'watch'],
              ].map(([p, when, rel, tone], i) => (
                <div key={when} className="lp-bc__req" style={{ '--d': `${0.5 + i * 0.15}s` }}>
                  <Avatar p={p} size={28} />
                  <span>
                    <b>{p.name}</b>
                    <small>{when}</small>
                  </span>
                  <span className={`lp-bc__rel is-${tone}`}>
                    <SafetyCertificateFilled /> {rel}
                  </span>
                  <span className="lp-bc__ok">
                    <CheckOutlined />
                  </span>
                </div>
              ))}
            </div>
            <div className="lp-bc__panel">
              <div className="lp-bc__ph">
                <strong>Gelir & Gider</strong>
                <small>son 6 ay</small>
              </div>
              <div className="lp-bc__bars">
                {income.map((v, i) => (
                  <span key={MONTHS[i]} style={{ '--i': i }}>
                    <i className="is-in" style={{ height: `${v}%` }} />
                    <i className="is-out" style={{ height: `${expense[i]}%` }} />
                    <small>{MONTHS[i]}</small>
                  </span>
                ))}
              </div>
              <div className="lp-bc__net">
                <span>
                  <i className="is-in" /> Gelir
                </span>
                <span>
                  <i className="is-out" /> Gider
                </span>
                <b>Net 37.200 ₺</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BizHero() {
  const { t } = useTranslation('landing');
  const chips = t('biz.hero.chips', { returnObjects: true });
  const stageRef = useRef(null);
  const consoleRef = useRef(null);

  useScrollFrame(stageRef, (rect, vh) => {
    const el = consoleRef.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.style.transform = '';
      return;
    }
    const p = clamp01((vh * 0.98 - rect.top) / (vh * 0.7));
    const rx = 26 * (1 - p);
    const s = 0.88 + 0.12 * p;
    el.style.transform = `perspective(1800px) rotateX(${rx.toFixed(2)}deg) scale(${s.toFixed(3)})`;
    el.style.setProperty('--glow', (0.25 + p * 0.75).toFixed(2));
  });

  return (
    <section className="lp-subhero lp-biz-hero">
      <div className="lp-subhero__bg" aria-hidden="true" />
      <div className="lp-biz-hero__beams" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="lp-wrap lp-subhero__in lp-biz-hero__copy">
        <span className="lp-eyebrow is-pill">
          <span className="lp-pulse" /> {t('biz.hero.eyebrow')}
        </span>
        <RevealText as="h1" className="lp-display" text={t('biz.hero.title')} />
        <p className="lp-lead">{t('biz.hero.text')}</p>
        <div className="lp-actions is-center">
          <a href={CONTACT} className="lp-btn is-primary is-lg">
            <MailOutlined /> {t('biz.hero.primary')}
          </a>
          <Link to="/login" className="lp-btn is-ghost is-lg">
            <LoginOutlined /> {t('biz.hero.secondary')}
          </Link>
        </div>
        <div className="lp-chips is-center">
          {Array.isArray(chips) &&
            chips.map((c) => (
              <span key={c} className="lp-chip">
                <CheckOutlined /> {c}
              </span>
            ))}
        </div>
      </div>
      <div className="lp-wrap lp-biz-hero__stage" ref={stageRef} aria-hidden="true">
        <div className="lp-biz-hero__console" ref={consoleRef}>
          <BizConsole />
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   Panelde bir gün: kaydırınca dolan zaman çizgisi
   ========================================================= */
function Day() {
  const { t } = useTranslation('landing');
  const items = t('biz.day.items', { returnObjects: true });
  const list = Array.isArray(items) ? items : [];
  const lineRef = useRef(null);
  const wrapRef = useRef(null);
  const [reached, setReached] = useState(-1);
  const icons = [UnorderedListOutlined, CalendarOutlined, ThunderboltFilled, AppstoreOutlined, BarChartOutlined];

  useScrollFrame(wrapRef, (rect, vh, el) => {
    const p = clamp01((vh * 0.6 - rect.top) / rect.height);
    if (lineRef.current) lineRef.current.style.transform = `scaleY(${p})`;
    const dots = el.querySelectorAll('.lp-day__item');
    let n = -1;
    dots.forEach((d, i) => {
      if (d.getBoundingClientRect().top < vh * 0.6) n = i;
    });
    setReached((r) => (r === n ? r : n));
  });

  return (
    <section className="lp-section lp-day">
      <div className="lp-wrap lp-day__grid">
        <div className="lp-day__head">
          <SectionHead eyebrow={t('biz.day.eyebrow')} title={t('biz.day.title')} left />
          <div className="lp-day__clock" aria-hidden="true">
            <b>{list[Math.max(0, reached)]?.time || '09:00'}</b>
          </div>
        </div>
        <div className="lp-day__list" ref={wrapRef}>
          <span className="lp-day__rail" aria-hidden="true">
            <i ref={lineRef} />
          </span>
          {list.map((it, i) => {
            const Icon = icons[i] || CheckOutlined;
            return (
              <article key={it.time} className={`lp-day__item ${i <= reached ? 'is-on' : ''}`} data-spot>
                <span className="lp-day__dot">
                  <Icon />
                </span>
                <span className="lp-day__time">{it.time}</span>
                <h3>{it.title}</h3>
                <p>{it.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   Modüller
   ========================================================= */
const HOURS = ['10', '12', '14', '16', '18', '20', '22', '00'];
const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function ModCalendar() {
  // [gün, başlangıç (0-7), süre, tür]
  const blocks = [
    [0, 4, 1, 'app'], [0, 5, 1, 'weekly'], [1, 3, 1, 'phone'], [1, 5, 2, 'app'], [2, 4, 1, 'deal'],
    [2, 5, 1, 'app'], [3, 5, 1, 'weekly'], [3, 6, 1, 'app'], [4, 4, 2, 'app'], [4, 6, 1, 'phone'],
    [5, 1, 1, 'app'], [5, 2, 1, 'phone'], [5, 5, 2, 'app'], [6, 0, 1, 'weekly'], [6, 3, 1, 'app'], [6, 5, 1, 'deal'],
  ];
  const legend = [
    ['app', 'Uygulama'],
    ['phone', 'Telefon'],
    ['weekly', 'Sabit maç'],
    ['deal', 'Fırsat'],
  ];
  return (
    <div className="lp-bm-cal">
      <div className="lp-bm-cal__grid">
        <span />
        {DAYS.map((d) => (
          <b key={d}>{d}</b>
        ))}
        {HOURS.map((h, r) => (
          <React.Fragment key={h}>
            <small style={{ gridRow: r + 2 }}>{h}:00</small>
          </React.Fragment>
        ))}
        {blocks.map(([d, s, len, kind], i) => (
          <i
            key={i}
            className={`is-${kind}`}
            style={{ gridColumn: d + 2, gridRow: `${s + 2} / span ${len}`, '--d': `${i * 45}ms` }}
          />
        ))}
        <em className="lp-bm-cal__free" style={{ gridColumn: 3, gridRow: 4 }}>
          + Ekle
        </em>
      </div>
      <div className="lp-bm-legend">
        {legend.map(([k, l]) => (
          <span key={k}>
            <i className={`is-${k}`} /> {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function ModRequests() {
  const [state, setState] = useState({});
  const reqs = [
    { id: 1, p: PEOPLE[0], when: 'Per 21:00 · Saha 1', ok: true, note: 'Kurucu olarak son 6 ay: 18 gerçekleşen rezervasyon, 0 son dakika iptal' },
    { id: 2, p: PEOPLE[9], when: 'Cmt 11:00 · Saha 1', ok: false, note: 'Oyuncu olarak son 10 maç: 2 son dakika çekilme, 1 gelmeme' },
  ];
  return (
    <div className="lp-bm-req">
      {reqs.map((r) => {
        const s = state[r.id];
        return (
          <div key={r.id} className={`lp-bm-req__card ${s ? `is-${s}` : ''}`}>
            <div className="lp-bm-req__top">
              <Avatar p={r.p} size={38} />
              <span>
                <strong>{r.p.name} · Maç talebi</strong>
                <small>{r.when} · 14 oyuncu</small>
              </span>
            </div>
            <div className={`lp-bm-req__rel ${r.ok ? 'is-ok' : 'is-watch'}`}>
              {r.ok ? <CheckCircleFilled /> : <ExclamationCircleFilled />}
              <span>
                <b>{r.ok ? 'Güvenilir görünüyor' : 'Dikkat: son dakika iptal geçmişi var'}</b>
                <small>{r.note}</small>
              </span>
            </div>
            {s ? (
              <div className="lp-bm-req__done">
                {s === 'ok' ? <CheckCircleFilled /> : <CloseOutlined />} {s === 'ok' ? 'Onaylandı · oyuncuya bildirildi' : 'Reddedildi'}
                <button type="button" onClick={() => setState((x) => ({ ...x, [r.id]: undefined }))}>
                  Geri al
                </button>
              </div>
            ) : (
              <div className="lp-bm-req__btns">
                <button type="button" onClick={() => setState((x) => ({ ...x, [r.id]: 'no' }))}>
                  Reddet
                </button>
                <button type="button" className="is-ok" onClick={() => setState((x) => ({ ...x, [r.id]: 'ok' }))}>
                  <CheckOutlined /> Onayla
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const PRICE_RULES = [
  { label: 'Hafta içi 10:00–17:00', price: 2400 },
  { label: 'Hafta içi 17:00–24:00', price: 3200 },
  { label: 'Hafta sonu 10:00–24:00', price: 3400 },
  { label: 'Her gün 00:00–02:00', price: 2800 },
];
const priceAt = (d, h) => {
  if (h >= 24) return PRICE_RULES[3];
  if (d >= 5) return PRICE_RULES[2];
  return h < 17 ? PRICE_RULES[0] : PRICE_RULES[1];
};

function ModPricing() {
  const hours = Array.from({ length: 16 }, (_, i) => 10 + i);
  const [hover, setHover] = useState(null);
  const shown = hover ? priceAt(hover[0], hover[1]) : null;
  return (
    <div className="lp-bm-price">
      <div className="lp-bm-price__heat" onMouseLeave={() => setHover(null)}>
        <span />
        {hours.map((h) => (
          <small key={h}>{h % 2 === 0 ? String(h % 24).padStart(2, '0') : ''}</small>
        ))}
        {DAYS.map((d, di) => (
          <React.Fragment key={d}>
            <b>{d}</b>
            {hours.map((h, hi) => {
              const r = priceAt(di, h);
              const lvl = (r.price - 2200) / 1300;
              return (
                <i
                  key={h}
                  style={{ '--l': lvl.toFixed(2), '--d': `${(di + hi) * 18}ms` }}
                  className={hover && hover[0] === di && hover[1] === h ? 'is-hover' : ''}
                  onMouseEnter={() => setHover([di, h])}
                  title={`${d} ${String(h % 24).padStart(2, '0')}:00 · ${formatTRY(r.price)}`}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="lp-bm-price__rules">
        {PRICE_RULES.map((r) => (
          <span key={r.label} className={shown === r ? 'is-on' : ''}>
            <i style={{ '--l': ((r.price - 2200) / 1300).toFixed(2) }} />
            {r.label}
            <b>{formatTRY(r.price)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function ModFinance() {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const net = useCountUp(37200, inView, 1400);
  const cats = [
    ['Personel', 38, '#f0c674'],
    ['Kira', 24, '#c9a35a'],
    ['Elektrik', 14, '#38bdf8'],
    ['Doğalgaz', 9, '#a78bfa'],
    ['Bakım-onarım', 8, '#34d399'],
    ['Diğer', 7, '#64748b'],
  ];
  let acc = 0;
  return (
    <div className="lp-bm-fin" ref={ref}>
      <div className="lp-bm-fin__top">
        <div>
          <small>Net kâr · Kasım</small>
          <b>{formatTRY(net)}</b>
          <span className="is-up">↑ %9 geçen aya göre</span>
        </div>
        <div className="lp-bm-fin__mini">
          <span>
            <small>Gelir</small>
            <b>64.000 ₺</b>
          </span>
          <span>
            <small>Gider</small>
            <b>26.800 ₺</b>
          </span>
          <span className="is-warn">
            <small>Tahsil edilmemiş</small>
            <b>4.800 ₺</b>
          </span>
        </div>
      </div>
      <div className="lp-bm-fin__body">
        <svg viewBox="0 0 42 42" className={`lp-bm-fin__donut ${inView ? 'is-in' : ''}`}>
          {cats.map(([name, v, c], i) => {
            const el = (
              <circle
                key={name}
                cx="21"
                cy="21"
                r="15.9"
                pathLength="100"
                stroke={c}
                strokeDasharray={`${v - 0.8} ${100 - v + 0.8}`}
                strokeDashoffset={-acc}
                style={{ '--i': i }}
              />
            );
            acc += v;
            return el;
          })}
          <text x="21" y="20" textAnchor="middle">Gider</text>
          <text x="21" y="25.5" textAnchor="middle" className="is-big">26,8K</text>
        </svg>
        <div className="lp-bm-fin__cats">
          {cats.map(([name, v, c]) => (
            <span key={name}>
              <i style={{ background: c }} /> {name}
              <b>%{v}</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModReviews() {
  const reply = 'Teşekkürler! Otopark genişletme işi bu ay bitiyor, görüşmek üzere ⚽';
  const ref = useRef(null);
  const visible = useVisible(ref);
  const [n, setN] = useState(prefersReducedMotion() ? reply.length : 0);
  useEffect(() => {
    if (!visible || prefersReducedMotion() || n >= reply.length) return undefined;
    const id = setTimeout(() => setN((x) => x + 1), n === 0 ? 700 : 28);
    return () => clearTimeout(id);
  }, [visible, n, reply.length]);
  return (
    <div className="lp-bm-rev" ref={ref}>
      <div className="lp-bm-rev__score">
        <b>4,8</b>
        <span>
          <span className="lp-bm-rev__row">
            {[1, 2, 3, 4, 5].map((s) => (
              <StarFilled key={s} />
            ))}
          </span>
          <small>126 yorum</small>
        </span>
      </div>
      <div className="lp-bm-rev__card">
        <div className="lp-bm-rev__who">
          <Avatar p={PEOPLE[7]} size={32} />
          <span>
            <b>Hakan</b>
            <small>2 gün önce · Saha 1</small>
          </span>
          <span className="lp-bm-rev__stars">
            {[1, 2, 3, 4, 5].map((s) => (
              <StarFilled key={s} className={s <= 4 ? 'is-on' : ''} />
            ))}
          </span>
        </div>
        <p>Zemin yeni, duşlar sıcak. Akşam otopark biraz dar kalıyor.</p>
        <div className="lp-bm-rev__reply">
          <small>
            <MessageOutlined /> İşletmenin yanıtı · herkese açık
          </small>
          <p>
            {reply.slice(0, n)}
            {n < reply.length && <i className="lp-caret" />}
          </p>
        </div>
      </div>
    </div>
  );
}

function ModSettings() {
  const [vals, setVals] = useState({ notice: 2, advance: 30, cancel: 24 });
  const rows = [
    { k: 'notice', label: 'En az rezervasyon süresi', min: 0, max: 48, unit: 'saat', def: 2, help: (v) => (v === 0 ? 'Son dakikaya kadar' : `Maçtan en az ${v} saat önce`) },
    { k: 'advance', label: 'En fazla ileri tarih', min: 1, max: 90, unit: 'gün', def: 30, help: (v) => `${v} gün sonrasına kadar` },
    { k: 'cancel', label: 'Ücretsiz iptal süresi', min: 0, max: 72, unit: 'saat', def: 24, help: (v) => `Maçtan ${v} saat öncesine kadar ücretsiz` },
  ];
  return (
    <div className="lp-bm-set">
      {rows.map((r) => {
        const v = vals[r.k];
        const isDef = v === r.def;
        return (
          <label key={r.k} className="lp-bm-set__row">
            <span className="lp-bm-set__top">
              <strong>{r.label}</strong>
              <em className={isDef ? '' : 'is-custom'}>{isDef ? 'Sistem varsayılanı' : 'Özel değer'}</em>
            </span>
            <span className="lp-bm-set__ctrl">
              <input
                type="range"
                min={r.min}
                max={r.max}
                value={v}
                onChange={(e) => setVals((x) => ({ ...x, [r.k]: Number(e.target.value) }))}
                style={{ '--p': `${((v - r.min) / (r.max - r.min)) * 100}%` }}
              />
              <b>
                {v} {r.unit}
              </b>
            </span>
            <small>{r.help(v)}</small>
          </label>
        );
      })}
    </div>
  );
}

const MOD_VIEWS = {
  calendar: [CalendarOutlined, ModCalendar],
  requests: [UnorderedListOutlined, ModRequests],
  pricing: [ClockCircleOutlined, ModPricing],
  finance: [BarChartOutlined, ModFinance],
  reviews: [StarFilled, ModReviews],
  settings: [SettingOutlined, ModSettings],
};
const AUTO_MS = 7000;

function Modules() {
  const { t } = useTranslation('landing');
  const tabs = t('biz.modules.tabs', { returnObjects: true });
  const list = Array.isArray(tabs) ? tabs : [];
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(!prefersReducedMotion());
  const ref = useRef(null);
  const visible = useVisible(ref);

  useEffect(() => {
    if (!auto || !visible || !list.length) return undefined;
    const id = setTimeout(() => setIdx((i) => (i + 1) % list.length), AUTO_MS);
    return () => clearTimeout(id);
  }, [auto, visible, idx, list.length]);

  const cur = list[idx];
  const View = cur ? MOD_VIEWS[cur.key]?.[1] : null;

  return (
    <section className="lp-section is-alt" ref={ref}>
      <div className="lp-wrap">
        <SectionHead eyebrow={t('biz.modules.eyebrow')} title={t('biz.modules.title')} />
        <div className="lp-mods">
          <div className="lp-mods__tabs" role="tablist">
            {list.map((m, i) => {
              const Icon = MOD_VIEWS[m.key]?.[0] || AppstoreOutlined;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={i === idx}
                  className={`lp-mods__tab ${i === idx ? 'is-on' : ''}`}
                  onClick={() => {
                    setIdx(i);
                    setAuto(false);
                  }}
                >
                  <span className="lp-mods__icon">
                    <Icon />
                  </span>
                  <span className="lp-mods__txt">
                    <strong>{m.title}</strong>
                    <small>{m.text}</small>
                  </span>
                  {i === idx && auto && visible && (
                    <span className="lp-mods__timer" style={{ animationDuration: `${AUTO_MS}ms` }} key={`t${idx}`} />
                  )}
                </button>
              );
            })}
          </div>
          <div className="lp-mods__panel lp-glass" role="tabpanel" data-tilt>
            <div className="lp-mods__bar">
              <i />
              <i />
              <i />
              <span>{cur?.title}</span>
            </div>
            <div className="lp-mods__view" key={cur?.key}>
              {View && <View />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   Boş saat ilanı: dene
   ========================================================= */
function Deal() {
  const { t } = useTranslation('landing');
  const base = 3200;
  const [disc, setDisc] = useState(20);
  const [phase, setPhase] = useState('idle'); // idle → sending → live
  const price = Math.round((base * (100 - disc)) / 100);
  const per = Math.ceil(price / 14);
  const audience = useCountUp(phase === 'live' ? 248 : 0, phase === 'live', 1200);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const publish = () => {
    if (phase !== 'idle') {
      setPhase('idle');
      return;
    }
    setPhase('sending');
    timer.current = setTimeout(() => setPhase('live'), 900);
  };

  return (
    <section className="lp-section lp-deal">
      <div className="lp-wrap lp-deal__grid">
        <div>
          <SectionHead eyebrow={t('biz.deal.eyebrow')} title={t('biz.deal.title')} text={t('biz.deal.text')} left />
          <div className="lp-deal__panel lp-glass" data-reveal data-spot>
            <div className="lp-deal__slot">
              <FieldTimeOutlined /> {t('biz.deal.slot')}
              <span className={`lp-deal__state is-${phase}`}>
                {phase === 'live' ? t('biz.deal.published') : phase === 'sending' ? '…' : 'Boş'}
              </span>
            </div>
            <label className="lp-deal__range">
              <span>
                {t('biz.deal.discount')} <b>%{disc}</b>
              </span>
              <input
                type="range"
                min={10}
                max={50}
                step={5}
                value={disc}
                disabled={phase !== 'idle'}
                onChange={(e) => setDisc(Number(e.target.value))}
                style={{ '--p': `${((disc - 10) / 40) * 100}%` }}
              />
            </label>
            <div className="lp-deal__nums">
              <span>
                <small>{t('biz.deal.base')}</small>
                <s>{formatTRY(base)}</s>
              </span>
              <span>
                <small>{t('biz.deal.price')}</small>
                <b>{formatTRY(price)}</b>
              </span>
              <span>
                <small>{t('biz.deal.perPlayer')}</small>
                <b>{formatTRY(per)}</b>
              </span>
            </div>
            <button type="button" className={`lp-btn is-lg ${phase === 'idle' ? 'is-primary' : 'is-ghost'} lp-deal__go`} onClick={publish}>
              {phase === 'idle' && (
                <>
                  <ThunderboltFilled /> {t('biz.deal.publish')}
                </>
              )}
              {phase === 'sending' && <span className="lp-spinner" />}
              {phase === 'live' && (
                <>
                  <CheckCircleFilled /> {t('biz.deal.audience', { count: Math.round(audience) })}
                </>
              )}
            </button>
            <small className="lp-deal__note">{t('biz.deal.note')}</small>
          </div>
        </div>

        <div className={`lp-deal__stage is-${phase}`} aria-hidden="true">
          <span className="lp-deal__wave" />
          <span className="lp-deal__wave is-2" />
          <Phone className="lp-deal__phone">
            <div className="lp-lock">
              <span className="lp-lock__date">Perşembe, 13 Kasım</span>
              <span className="lp-lock__time">14:12</span>
              <div className="lp-lock__push">
                <span className="lp-lock__app">
                  <BellFilled />
                </span>
                <span className="lp-lock__txt">
                  <small>
                    MatcBuddy <em>şimdi</em>
                  </small>
                  <strong>Yeşil Vadi Spor · bugün 15:00 %{disc} indirim</strong>
                  <span>
                    Saat {formatTRY(price)} · kişi başı {formatTRY(per)}. Maçı kur, sahayı kap!
                  </span>
                </span>
              </div>
              <div className="lp-lock__push is-old">
                <span className="lp-lock__app">
                  <MessageOutlined />
                </span>
                <span className="lp-lock__txt">
                  <small>Perşembe Maçı</small>
                  <strong>Mert: Kadro tamam mı?</strong>
                </span>
              </div>
            </div>
          </Phone>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   Yayına çıkış: beş adım
   ========================================================= */
function Onboard() {
  const { t } = useTranslation('landing');
  const steps = t('biz.onboard.steps', { returnObjects: true });
  const list = Array.isArray(steps) ? steps : [];
  const [ref, inView] = useInView({ threshold: 0.35 });
  const [done, setDone] = useState(prefersReducedMotion() ? list.length : 0);
  const icons = [PictureOutlined, AppstoreOutlined, EnvironmentOutlined, EnvironmentOutlined, ClockCircleOutlined];

  useEffect(() => {
    if (!inView || done >= list.length) return undefined;
    const id = setTimeout(() => setDone((d) => d + 1), done === 0 ? 500 : 650);
    return () => clearTimeout(id);
  }, [inView, done, list.length]);

  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  const complete = list.length > 0 && done >= list.length;

  return (
    <section className="lp-section">
      <div className="lp-wrap lp-onb" ref={ref}>
        <div className="lp-onb__ring" data-reveal>
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" />
            <circle cx="60" cy="60" r="52" pathLength="100" className="is-fill" style={{ strokeDashoffset: 100 - pct }} />
          </svg>
          <span className="lp-onb__pct">
            <small>{t('biz.onboard.progress')}</small>
            <b>%{pct}</b>
          </span>
          <span className={`lp-onb__done ${complete ? 'is-on' : ''}`}>
            <CheckCircleFilled /> {t('biz.onboard.done')}
          </span>
        </div>
        <div>
          <SectionHead eyebrow={t('biz.onboard.eyebrow')} title={t('biz.onboard.title')} text={t('biz.onboard.text')} left />
          <div className="lp-onb__list">
            {list.map((s, i) => {
              const Icon = icons[i] || CheckOutlined;
              return (
                <div key={s.title} className={`lp-onb__step ${i < done ? 'is-done' : ''}`}>
                  <span className="lp-onb__icon">{i < done ? <CheckOutlined /> : <Icon />}</span>
                  <span>
                    <strong>{s.title}</strong>
                    <small>{s.text}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function BizFaq() {
  const { t } = useTranslation('landing');
  const items = t('biz.faq.items', { returnObjects: true });
  return (
    <section className="lp-section is-alt">
      <div className="lp-wrap">
        <SectionHead eyebrow={t('biz.faq.eyebrow')} title={t('biz.faq.title')} />
        <div className="lp-faq is-wide">
          {Array.isArray(items) &&
            items.map((f, i) => (
              <details key={f.q} className="lp-qa" open={i === 0} data-reveal style={{ '--rd': `${i * 60}ms` }}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
        </div>
      </div>
    </section>
  );
}

export default function BusinessPage() {
  const { t } = useTranslation('landing');
  return (
    <SiteShell title={t('biz.docTitle')} theme="is-biz">
      <BizHero />
      <Day />
      <Modules />
      <Deal />
      <Onboard />
      <BizFaq />
      <SiteCta
        title={t('biz.cta.title')}
        text={t('biz.cta.text')}
        actions={[
          { href: CONTACT, label: t('biz.hero.primary'), icon: <MailOutlined />, primary: true },
          { to: '/login', label: t('biz.hero.secondary'), icon: <LoginOutlined /> },
        ]}
      />
    </SiteShell>
  );
}
