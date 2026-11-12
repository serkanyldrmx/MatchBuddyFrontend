import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BellFilled,
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  FieldTimeOutlined,
  RedoOutlined,
  SafetyCertificateFilled,
  ThunderboltFilled,
  UndoOutlined,
  UserDeleteOutlined,
} from '@ant-design/icons';
import { PEOPLE } from './LandingMocks';
import { formatTRY, useCountUp, useInView } from './landingHooks';

/* =========================================================
   1) Diziliş oyun alanı — sürükle-bırak + diziliş + denge
   ========================================================= */

// Taraf başına 7 kişi: kaleci + hatlar
const FORMATIONS = {
  '2-3-1': [2, 3, 1],
  '3-2-1': [3, 2, 1],
  '3-3': [3, 3],
  '2-2-2': [2, 2, 2],
};

// Oyuncu güçleri (örnek puanlar)
const RATINGS = [84, 71, 77, 88, 69, 74, 80, 73, 86, 70, 79, 75, 82, 72];

function formationSpots(lines, away) {
  const spots = [{ x: 6, y: 50 }];
  const depthMax = 42;
  lines.forEach((size, li) => {
    const depth = 16 + ((depthMax - 16) * li) / Math.max(lines.length - 1, 1);
    for (let i = 0; i < size; i++) {
      const y = size === 1 ? 50 : 18 + (64 * i) / (size - 1);
      spots.push({ x: depth, y });
    }
  });
  return spots.map((s) => (away ? { x: 100 - s.x, y: 100 - s.y } : s));
}

function layout(teams, formation) {
  const lines = FORMATIONS[formation];
  const home = formationSpots(lines, false);
  const away = formationSpots(lines, true);
  const pos = {};
  teams.home.forEach((id, i) => (pos[id] = home[i]));
  teams.away.forEach((id, i) => (pos[id] = away[i]));
  return pos;
}

const START_TEAMS = { home: [0, 1, 2, 3, 4, 5, 6], away: [7, 8, 9, 10, 11, 12, 13] };

// En güçlü kaleciler ayrı takıma, kalanlar açgözlü (greedy) olarak dağıtılır
function balance() {
  const order = RATINGS.map((r, i) => ({ r: r + Math.random() * 4, i })).sort((a, b) => b.r - a.r);
  const home = [];
  const away = [];
  let sh = 0;
  let sa = 0;
  order.forEach(({ i }) => {
    if ((sh <= sa && home.length < 7) || away.length >= 7) {
      home.push(i);
      sh += RATINGS[i];
    } else {
      away.push(i);
      sa += RATINGS[i];
    }
  });
  return { home, away };
}

// Dar ekranda saha dikey: koordinatlar yer değiştirir (x ↔ y)
function useVerticalField() {
  const q = '(max-width: 640px)';
  const [v, setV] = useState(() => !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return undefined;
    const on = (e) => setV(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return v;
}

const teamPower = (ids) => Math.round(ids.reduce((s, i) => s + RATINGS[i], 0) / ids.length);

export function LineupPlayground() {
  const { t } = useTranslation('landing');
  const [formation, setFormation] = useState('2-3-1');
  const [teams, setTeams] = useState(START_TEAMS);
  const [pos, setPos] = useState(() => layout(START_TEAMS, '2-3-1'));
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null); // olaylar aynı karede gelse de sürüklenen oyuncu bilinsin
  const fieldRef = useRef(null);
  const vertical = useVerticalField();

  const apply = (nextTeams, nextFormation) => {
    setTeams(nextTeams);
    setFormation(nextFormation);
    setPos(layout(nextTeams, nextFormation));
  };

  const toPercent = (e) => {
    const r = fieldRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 100;
    const py = ((e.clientY - r.top) / r.height) * 100;
    const clampX = (v) => Math.min(97, Math.max(3, v));
    const clampY = (v) => Math.min(94, Math.max(6, v));
    return vertical ? { x: clampX(py), y: clampY(px) } : { x: clampX(px), y: clampY(py) };
  };

  const onDown = (e, id) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* yoksay */
    }
    dragRef.current = id;
    setDrag(id);
  };
  const onMove = (e, id) => {
    if (dragRef.current !== id) return;
    const p = toPercent(e);
    setPos((cur) => ({ ...cur, [id]: p }));
  };
  const onUp = () => {
    dragRef.current = null;
    setDrag(null);
  };

  const homeSet = new Set(teams.home);
  const hp = teamPower(teams.home);
  const ap = teamPower(teams.away);

  return (
    <div className="lp-play">
      <div className="lp-play__bar">
        <div className="lp-seg" role="group" aria-label={t('lineup.formation')}>
          {Object.keys(FORMATIONS).map((f) => (
            <button key={f} type="button" className={f === formation ? 'is-on' : ''} onClick={() => apply(teams, f)}>
              {f}
            </button>
          ))}
        </div>
        <div className="lp-play__actions">
          <button type="button" className="lp-chip-btn is-lime" onClick={() => apply(balance(), formation)}>
            <ThunderboltFilled /> {t('lineup.shuffle')}
          </button>
          <button type="button" className="lp-chip-btn" onClick={() => apply(START_TEAMS, '2-3-1')}>
            <RedoOutlined /> {t('lineup.reset')}
          </button>
        </div>
      </div>

      <div className="lp-field" ref={fieldRef}>
        <svg viewBox="0 0 105 68" preserveAspectRatio="none" aria-hidden="true">
          <rect x="1.5" y="1.5" width="102" height="65" />
          <line x1="52.5" y1="1.5" x2="52.5" y2="66.5" />
          <circle cx="52.5" cy="34" r="9" />
          <rect x="1.5" y="14" width="16" height="40" />
          <rect x="87.5" y="14" width="16" height="40" />
          <rect x="1.5" y="25" width="5.5" height="18" />
          <rect x="98" y="25" width="5.5" height="18" />
        </svg>
        {PEOPLE.map((p, id) => {
          const at = pos[id];
          const home = homeSet.has(id);
          return (
            <button
              key={p.ini}
              type="button"
              className={`lp-tok ${home ? 'is-home' : 'is-away'} ${drag === id ? 'is-drag' : ''}`}
              style={vertical ? { left: `${at.y}%`, top: `${at.x}%` } : { left: `${at.x}%`, top: `${at.y}%` }}
              onPointerDown={(e) => onDown(e, id)}
              onPointerMove={(e) => onMove(e, id)}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              aria-label={`${p.name} · ${RATINGS[id]}`}
            >
              <span className="lp-tok__av">{p.ini}</span>
              <span className="lp-tok__name">
                {p.name} <b>{RATINGS[id]}</b>
              </span>
            </button>
          );
        })}
      </div>

      <div className="lp-power">
        <span className="is-home">
          {t('lineup.home')} <b>{hp}</b>
        </span>
        <span className="lp-power__bar">
          <i style={{ width: `${(hp / (hp + ap)) * 100}%` }} />
        </span>
        <span className="is-away">
          <b>{ap}</b> {t('lineup.away')}
        </span>
      </div>
      <p className="lp-play__hint">{t('lineup.hint')}</p>
    </div>
  );
}

/* =========================================================
   2) Kişi başı ücret — uygulamadaki formülle
   perPlayer = ceil((saha + kamera) / oyuncu); krampon yalnızca kiralayana
   ========================================================= */
const CAMERA_PRICE = 300;

export function SplitCalculator() {
  const { t } = useTranslation('landing');
  const [hourly, setHourly] = useState(3200);
  const [minutes, setMinutes] = useState(60);
  const [players, setPlayers] = useState(14);
  const [camera, setCamera] = useState(false);
  const [cleats, setCleats] = useState(2);
  const [cleatPrice, setCleatPrice] = useState(100);

  const calc = useMemo(() => {
    const pitch = (hourly * minutes) / 60;
    const cam = camera ? CAMERA_PRICE : 0;
    const cleatTotal = cleats * cleatPrice;
    const total = pitch + cam + cleatTotal;
    const per = Math.ceil((total - cleatTotal) / players);
    return { pitch, cam, cleatTotal, total, per, renter: per + cleatPrice };
  }, [hourly, minutes, players, camera, cleats, cleatPrice]);

  const [ref, inView] = useInView();
  const per = useCountUp(calc.per, inView, 500);
  const renter = useCountUp(calc.renter, inView, 500);

  const seg = (v) => `${(v / calc.total) * 100}%`;

  return (
    <div className="lp-calc" ref={ref}>
      <div className="lp-calc__form">
        <label className="lp-field-row">
          <span>
            {t('split.hourly')} <b>{formatTRY(hourly)}</b>
          </span>
          <input type="range" min="1500" max="6000" step="100" value={hourly} onChange={(e) => setHourly(+e.target.value)} />
        </label>
        <div className="lp-field-row">
          <span>{t('split.duration')}</span>
          <div className="lp-seg">
            {[60, 90, 120].map((m) => (
              <button key={m} type="button" className={m === minutes ? 'is-on' : ''} onClick={() => setMinutes(m)}>
                {t('split.minutes', { count: m })}
              </button>
            ))}
          </div>
        </div>
        <label className="lp-field-row">
          <span>
            {t('split.players')} <b>{players}</b>
          </span>
          <input type="range" min="8" max="18" step="1" value={players} onChange={(e) => setPlayers(+e.target.value)} />
        </label>
        <label className="lp-field-row">
          <span>
            {t('split.cleats')} <b>{cleats}</b>
          </span>
          <input type="range" min="0" max="8" step="1" value={cleats} onChange={(e) => setCleats(+e.target.value)} />
        </label>
        <label className="lp-field-row">
          <span>
            {t('split.cleatPrice')} <b>{formatTRY(cleatPrice)}</b>
          </span>
          <input type="range" min="50" max="250" step="10" value={cleatPrice} onChange={(e) => setCleatPrice(+e.target.value)} />
        </label>
        <label className="lp-switch">
          <input type="checkbox" checked={camera} onChange={(e) => setCamera(e.target.checked)} />
          <span className="lp-switch__ui" />
          {t('split.camera')} <b>+{formatTRY(CAMERA_PRICE)}</b>
        </label>
      </div>

      <div className="lp-calc__out" aria-live="polite">
        <div className="lp-calc__big">
          <small>{t('split.perPlayer')}</small>
          <b>{formatTRY(per)}</b>
        </div>
        <div className="lp-calc__renter">
          <small>{t('split.renter')}</small>
          <b>{formatTRY(renter)}</b>
        </div>
        <div className="lp-calc__stack" aria-hidden="true">
          <i className="is-pitch" style={{ width: seg(calc.pitch) }} />
          <i className="is-cam" style={{ width: seg(calc.cam) }} />
          <i className="is-cleat" style={{ width: seg(calc.cleatTotal) }} />
        </div>
        <ul className="lp-calc__legend">
          <li>
            <i className="is-pitch" /> {t('split.pitchTotal')} <b>{formatTRY(calc.pitch)}</b>
          </li>
          <li>
            <i className="is-cam" /> {t('split.extras')} <b>{formatTRY(calc.cam + calc.cleatTotal)}</b>
          </li>
          <li className="is-total">
            {t('split.total')} <b>{formatTRY(calc.total)}</b>
          </li>
        </ul>
        <p className="lp-calc__note">{t('split.note')}</p>
      </div>
    </div>
  );
}

/* =========================================================
   3) Güvenilirlik puanı — docs/reliability-api.md kuralları
   ========================================================= */
const REL_EVENTS = [
  { key: 'attend', delta: 2, icon: <CheckOutlined />, tone: 'good' },
  { key: 'late', delta: -5, icon: <ClockCircleOutlined />, tone: 'warn' },
  { key: 'veryLate', delta: -10, icon: <FieldTimeOutlined />, tone: 'warn' },
  { key: 'noShow', delta: -20, icon: <UserDeleteOutlined />, tone: 'bad' },
];

const clamp = (v) => Math.max(0, Math.min(100, v));
const levelOf = (s) => (s >= 90 ? 'good' : s >= 70 ? 'medium' : 'risky');

export function ReliabilityDemo() {
  const { t } = useTranslation('landing');
  const [log, setLog] = useState([]);

  const score = clamp(100 + log.filter((e) => !e.reversed).reduce((s, e) => s + e.applied, 0));
  const shown = useCountUp(score, true, 450);
  const level = levelOf(score);

  const add = (ev) =>
    setLog((cur) => {
      const now = clamp(100 + cur.filter((e) => !e.reversed).reduce((s, e) => s + e.applied, 0));
      // Katılım bonusu 100'ü geçmez
      const applied = ev.delta > 0 ? Math.min(ev.delta, 100 - now) : ev.delta;
      return [{ id: Date.now() + Math.random(), key: ev.key, applied, tone: ev.tone }, ...cur].slice(0, 8);
    });

  const lastPenalty = log.find((e) => e.applied < 0 && !e.reversed);
  const excuse = () => setLog((cur) => cur.map((e) => (e === lastPenalty ? { ...e, reversed: true } : e)));

  // Yarım daire gösterge
  const arc = 251.3; // π * 80
  const dash = (shown / 100) * arc;

  return (
    <div className="lp-rel">
      <div className={`lp-gauge is-${level}`}>
        <svg viewBox="0 0 200 116" aria-hidden="true">
          <path d="M20 100 A80 80 0 0 1 180 100" className="lp-gauge__track" />
          <path d="M20 100 A80 80 0 0 1 180 100" className="lp-gauge__val" style={{ strokeDasharray: `${dash} ${arc}` }} />
        </svg>
        <div className="lp-gauge__num">
          <b>{Math.round(shown)}</b>
          <span>
            <SafetyCertificateFilled /> {t(`rel.levels.${level}`)}
          </span>
        </div>
        <div className="lp-gauge__scale" aria-hidden="true">
          <span>0</span>
          <span>70</span>
          <span>90</span>
          <span>100</span>
        </div>
      </div>

      <div className="lp-rel__side">
        <div className="lp-rel__btns">
          {REL_EVENTS.map((ev) => (
            <button key={ev.key} type="button" className={`lp-ev is-${ev.tone}`} onClick={() => add(ev)}>
              {ev.icon}
              <span>{t(`rel.events.${ev.key}`)}</span>
              <b>{ev.delta > 0 ? `+${ev.delta}` : ev.delta}</b>
            </button>
          ))}
          <button type="button" className="lp-ev is-excuse" onClick={excuse} disabled={!lastPenalty}>
            <UndoOutlined />
            <span>{t('rel.events.excuse')}</span>
            <b>{lastPenalty ? `+${-lastPenalty.applied}` : '—'}</b>
          </button>
          <button type="button" className="lp-ev is-reset" onClick={() => setLog([])} disabled={!log.length}>
            <CloseOutlined />
            <span>{t('rel.events.reset')}</span>
          </button>
        </div>
        <ul className="lp-rel__log">
          {log.length === 0 && <li className="is-empty">{t('rel.logEmpty')}</li>}
          {log.map((e) => (
            <li key={e.id} className={`is-${e.tone} ${e.reversed ? 'is-reversed' : ''}`}>
              <span>{t(`rel.events.${e.key}`)}</span>
              <b>{e.applied > 0 ? `+${e.applied}` : e.applied}</b>
            </li>
          ))}
        </ul>
        <p className="lp-rel__rule">{t('rel.rule')}</p>
      </div>
    </div>
  );
}

/* =========================================================
   4) İşletme paneli maketi (tarayıcı çerçevesi)
   ========================================================= */
// [gün, başlangıç saati indeksi (17:00 = 0), süre (saat), tür]
const BOOKINGS = [
  [0, 3, 1, 'app'], [0, 4, 2, 'weekly'],
  [1, 0, 1, 'deal'], [1, 3, 2, 'phone'], [1, 5, 1, 'app'],
  [2, 2, 1, 'app'], [2, 3, 1, 'phone'], [2, 4, 2, 'weekly'],
  [3, 1, 1, 'phone'], [3, 3, 3, 'app'],
  [4, 1, 2, 'app'], [4, 3, 1, 'weekly'], [4, 4, 2, 'app'],
  [5, 0, 2, 'phone'], [5, 2, 4, 'app'],
  [6, 0, 3, 'app'], [6, 3, 2, 'phone'],
];
const HOURS = ['17', '18', '19', '20', '21', '22', '23'];

export function OwnerDashboard() {
  const { t } = useTranslation('landing');
  const [ref, inView] = useInView({ threshold: 0.3 });
  const occ = useCountUp(78, inView, 1200);
  const rev = useCountUp(84600, inView, 1400);
  const pend = useCountUp(3, inView, 800);
  const days = t('venues.dash.days', { returnObjects: true });

  return (
    <div className={`lp-browser ${inView ? 'is-in' : ''}`} ref={ref} role="img" aria-label={t('venues.dash.title')}>
      <div className="lp-browser__bar">
        <i />
        <i />
        <i />
        <span>matcbuddy · {t('venues.dash.title')}</span>
      </div>
      <div className="lp-dash">
        <div className="lp-dash__kpis">
          <div>
            <small>{t('venues.dash.kpi.occupancy')}</small>
            <b>%{Math.round(occ)}</b>
            <span className="lp-dash__spark">
              {[40, 55, 48, 62, 70, 74, 78].map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
            </span>
          </div>
          <div>
            <small>{t('venues.dash.kpi.revenue')}</small>
            <b>{formatTRY(rev)}</b>
          </div>
          <div>
            <small>{t('venues.dash.kpi.pending')}</small>
            <b>{Math.round(pend)}</b>
          </div>
        </div>
        <div className="lp-cal">
          {Array.isArray(days) &&
            days.map((d, c) => (
              <span key={d} className="lp-cal__day" style={{ gridRow: 1, gridColumn: c + 2 }}>
                {d}
              </span>
            ))}
          {HOURS.map((h, r) => (
            <React.Fragment key={h}>
              <span className="lp-cal__hour" style={{ gridRow: r + 2, gridColumn: 1 }}>
                {h}:00
              </span>
              {Array.from({ length: 7 }, (_, c) => (
                <span key={c} className="lp-cal__cell" style={{ gridRow: r + 2, gridColumn: c + 2 }} />
              ))}
            </React.Fragment>
          ))}
          {BOOKINGS.map(([d, s, len, type], i) => (
            <span
              key={i}
              className={`lp-cal__bk is-${type}`}
              style={{ gridColumn: d + 2, gridRow: `${s + 2} / span ${len}`, '--d': `${i * 45}ms` }}
            />
          ))}
        </div>
        <div className="lp-dash__legend">
          {['app', 'phone', 'weekly', 'deal'].map((k) => (
            <span key={k}>
              <i className={`is-${k}`} /> {t(`venues.dash.legend.${k}`)}
            </span>
          ))}
          <em>{t('venues.dash.sample')}</em>
        </div>
      </div>
      <div className="lp-dash__toast">
        <BellFilled /> {t('venues.dash.toast')}
      </div>
    </div>
  );
}
