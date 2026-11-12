import React from 'react';
import {
  BellFilled,
  CalendarOutlined,
  CheckCircleFilled,
  CloudOutlined,
  CrownFilled,
  EnvironmentOutlined,
  HomeFilled,
  MessageOutlined,
  PlusOutlined,
  SafetyCertificateFilled,
  StarFilled,
  TeamOutlined,
  ThunderboltFilled,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';

/*
 * Tanıtım sitesindeki "ekran görüntüleri": uygulama ekranlarının sade, kodla çizilmiş maketleri.
 * Gerçek veri içermez; metinler örnektir (ekran görüntüsü yerine geçer, bu yüzden çeviri dosyasında değil).
 */

export const PEOPLE = [
  { ini: 'SY', name: 'Serkan', hue: 84 },
  { ini: 'AK', name: 'Ahmet', hue: 200 },
  { ini: 'MT', name: 'Mert', hue: 30 },
  { ini: 'BD', name: 'Burak', hue: 280 },
  { ini: 'EK', name: 'Emre', hue: 150 },
  { ini: 'OC', name: 'Onur', hue: 340 },
  { ini: 'CA', name: 'Can', hue: 50 },
  { ini: 'HY', name: 'Hakan', hue: 180 },
  { ini: 'KB', name: 'Kaan', hue: 10 },
  { ini: 'UT', name: 'Umut', hue: 240 },
  { ini: 'FS', name: 'Furkan', hue: 110 },
  { ini: 'İG', name: 'İlker', hue: 300 },
  { ini: 'GÇ', name: 'Gökhan', hue: 20 },
  { ini: 'DA', name: 'Deniz', hue: 190 },
];

export function Avatar({ p, size = 28, ring }) {
  return (
    <span
      className={`lp-av ${ring ? `is-${ring}` : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.38, '--h': p.hue }}
      title={p.name}
    >
      {p.ini}
    </span>
  );
}

export function Phone({ children, className = '', label }) {
  return (
    <div className={`lp-phone ${className}`} role="img" aria-label={label}>
      <div className="lp-phone__notch" />
      <div className="lp-phone__screen">{children}</div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="lp-sb" aria-hidden="true">
      <span>21:04</span>
      <span className="lp-sb__icons">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

function TabBar({ active = 'home' }) {
  const tabs = [
    ['home', <HomeFilled />],
    ['cal', <CalendarOutlined />],
    ['add', <PlusOutlined />],
    ['msg', <MessageOutlined />],
    ['me', <UserOutlined />],
  ];
  return (
    <div className="lp-tabbar">
      {tabs.map(([k, icon]) => (
        <span key={k} className={`${k === active ? 'is-active' : ''} ${k === 'add' ? 'is-add' : ''}`}>
          {icon}
        </span>
      ))}
    </div>
  );
}

/* ---------- Ana sayfa: sıradaki maç + eksik kadrolar ---------- */
export function ScreenHome() {
  return (
    <div className="lp-scr">
      <StatusBar />
      <div className="lp-scr__hello">
        <small>Hoş geldin, Serkan</small>
        <strong>Bugün sahada mısın?</strong>
      </div>
      <div className="lp-next">
        <div className="lp-next__top">
          <span className="lp-pill is-lime">Sıradaki maçın</span>
          <span className="lp-pill">
            <CloudOutlined /> 18°
          </span>
        </div>
        <strong className="lp-next__title">Kartallar – Moda Spor</strong>
        <small>
          <EnvironmentOutlined /> Yeşil Vadi · Saha 1 · Per 21:00
        </small>
        <div className="lp-count">
          {[
            ['02', 'gün'],
            ['14', 'saat'],
            ['37', 'dk'],
          ].map(([n, l]) => (
            <span key={l}>
              <b>{n}</b>
              <i>{l}</i>
            </span>
          ))}
        </div>
        <div className="lp-next__foot">
          <span className="lp-stack">
            {PEOPLE.slice(0, 5).map((p) => (
              <Avatar key={p.ini} p={p} size={22} />
            ))}
          </span>
          <span className="lp-next__fill">13/14</span>
        </div>
      </div>
      <div className="lp-scr__sec">Kadrosu eksik maçlar</div>
      {[
        ['Cuma 20:00', 'Kadıköy Arena', '2 kişi', 'is-lime'],
        ['Cmt 11:00', 'Moda Halı Saha', '1 kişi', 'is-gold'],
      ].map(([when, where, need, tone]) => (
        <div key={when} className="lp-row">
          <span className={`lp-row__icon ${tone}`}>
            <TeamOutlined />
          </span>
          <span className="lp-row__txt">
            <strong>{when}</strong>
            <small>{where}</small>
          </span>
          <span className="lp-row__btn">{need} · Katıl</span>
        </div>
      ))}
      <TabBar />
    </div>
  );
}

/* ---------- 01: saat seçimi + fiyat ---------- */
export function ScreenBooking() {
  const hours = ['17', '18', '19', '20', '21', '22', '23', '00'];
  const state = ['busy', 'free', 'busy', 'free', 'pick', 'deal', 'free', 'busy'];
  return (
    <div className="lp-scr">
      <StatusBar />
      <div className="lp-venue">
        <div className="lp-venue__img">
          <span className="lp-pill is-gold">
            <ThunderboltFilled /> %20 fırsat
          </span>
        </div>
        <strong>Yeşil Vadi Spor</strong>
        <small>
          <StarFilled className="lp-gold" /> 4,8 · Kapalı · Sentetik çim · Duş · Otopark
        </small>
      </div>
      <div className="lp-scr__sec">Perşembe, 13 Kasım</div>
      <div className="lp-slots">
        {hours.map((h, i) => (
          <span key={h} className={`is-${state[i]}`}>
            {h}:00
          </span>
        ))}
      </div>
      <div className="lp-quote">
        <div>
          <small>Saha · 60 dk</small>
          <b>3.200 ₺</b>
        </div>
        <div>
          <small>Kişi başı (14)</small>
          <b className="lp-lime">229 ₺</b>
        </div>
      </div>
      <div className="lp-cta">Maçı kur ve talep gönder</div>
    </div>
  );
}

/* ---------- 02: işletme onayı ---------- */
export function ScreenApproved() {
  return (
    <div className="lp-scr">
      <StatusBar />
      <div className="lp-push">
        <span className="lp-push__app">
          <BellFilled />
        </span>
        <span>
          <strong>Talebin onaylandı</strong>
          <small>Yeşil Vadi · Per 21:00 · Saha 1</small>
        </span>
      </div>
      <div className="lp-approve">
        <span className="lp-approve__ring">
          <CheckCircleFilled />
        </span>
        <strong>Rezervasyon onaylandı</strong>
        <small>İşletme talebi 4 dakikada onayladı</small>
      </div>
      <div className="lp-card">
        <div className="lp-card__row">
          <Avatar p={PEOPLE[0]} size={34} ring="lime" />
          <span className="lp-row__txt">
            <strong>Serkan Y. · Kurucu</strong>
            <small>32 maç · son 10 maçta 0 iptal</small>
          </span>
          <span className="lp-rel is-good">
            <SafetyCertificateFilled /> 96
          </span>
        </div>
      </div>
      <div className="lp-card is-soft">
        <small>Haftalık sabit maç</small>
        <strong>Her perşembe 21:00 · 8 hafta</strong>
      </div>
      <TabBar active="cal" />
    </div>
  );
}

/* ---------- 03: kadro dolar + yedek ---------- */
export function ScreenSquad() {
  return (
    <div className="lp-scr">
      <StatusBar />
      <div className="lp-squad">
        <svg viewBox="0 0 36 36" className="lp-ring">
          <circle cx="18" cy="18" r="15.5" />
          <circle cx="18" cy="18" r="15.5" className="is-fill" pathLength="100" />
        </svg>
        <span className="lp-squad__n">
          <b>14/14</b>
          <small>Kadro tamam</small>
        </span>
      </div>
      <div className="lp-grid-av">
        {PEOPLE.map((p, i) => (
          <span key={p.ini} style={{ '--d': `${i * 70}ms` }}>
            <Avatar p={p} size={25} ring={i < 7 ? 'lime' : 'sky'} />
          </span>
        ))}
      </div>
      <div className="lp-scr__sec">Yedek listesi</div>
      {[
        ['Tolga', '1. sırada', 45],
        ['Yasin', '2. sırada', 260],
      ].map(([n, s, hue]) => (
        <div key={n} className="lp-row">
          <Avatar p={{ ini: n.slice(0, 2).toUpperCase(), name: n, hue }} size={28} />
          <span className="lp-row__txt">
            <strong>{n}</strong>
            <small>{s}</small>
          </span>
          <span className="lp-pill">Yedek</span>
        </div>
      ))}
      <div className="lp-toast">
        <BellFilled /> Onur çekildi · Tolga kadroya geçti
      </div>
    </div>
  );
}

/* ---------- 04: maç günü ---------- */
export function ScreenMatchDay() {
  return (
    <div className="lp-scr">
      <StatusBar />
      <div className="lp-weather">
        <CloudOutlined />
        <span>
          <b>18°</b>
          <small>Parçalı bulutlu · Yağış %10</small>
        </span>
      </div>
      <div className="lp-mini-pitch">
        {[
          [50, 10, 0],
          [25, 26, 1],
          [75, 26, 2],
          [50, 40, 3],
          [50, 60, 9],
          [25, 74, 7],
          [75, 74, 8],
          [50, 90, 6],
        ].map(([x, y, i]) => (
          <span key={i} style={{ left: `${x}%`, top: `${y}%` }} className={y < 50 ? 'is-home' : 'is-away'}>
            {PEOPLE[i].ini}
          </span>
        ))}
      </div>
      <div className="lp-balance">
        <span>
          <small>Kartallar</small>
          <b>78</b>
        </span>
        <span className="lp-balance__bar">
          <i style={{ width: '50.6%' }} />
        </span>
        <span>
          <small>Moda Spor</small>
          <b>76</b>
        </span>
      </div>
      <div className="lp-cta">
        <CheckCircleFilled /> Geliyorum, onayla
      </div>
    </div>
  );
}

/* ---------- 05: maç sonu ---------- */
export function ScreenPost() {
  return (
    <div className="lp-scr">
      <StatusBar />
      <div className="lp-score">
        <span>
          <small>Kartallar</small>
          <b>7</b>
        </span>
        <i>–</i>
        <span>
          <b>5</b>
          <small>Moda Spor</small>
        </span>
      </div>
      <div className="lp-scr__sec">Maçın oyuncusu</div>
      {[
        [PEOPLE[3], 6, true],
        [PEOPLE[1], 4, false],
        [PEOPLE[7], 2, false],
      ].map(([p, v, win]) => (
        <div key={p.ini} className={`lp-vote ${win ? 'is-win' : ''}`}>
          <Avatar p={p} size={28} />
          <span className="lp-vote__name">
            {p.name} {win && <CrownFilled className="lp-gold" />}
          </span>
          <span className="lp-vote__bar">
            <i style={{ width: `${v * 15}%` }} />
          </span>
          <b>{v}</b>
        </div>
      ))}
      <div className="lp-scr__sec">Takım arkadaşlarını puanla</div>
      <div className="lp-rate">
        <Avatar p={PEOPLE[4]} size={26} />
        <span>Emre</span>
        <span className="lp-stars">
          {[1, 2, 3, 4, 5].map((s) => (
            <StarFilled key={s} className={s <= 4 ? 'lp-gold' : ''} />
          ))}
        </span>
      </div>
      <div className="lp-toast is-gold">
        <TrophyOutlined /> Sıralamada 3 basamak yükseldin
      </div>
    </div>
  );
}

export const STORY_SCREENS = [ScreenBooking, ScreenApproved, ScreenSquad, ScreenMatchDay, ScreenPost];
