import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
  AndroidFilled,
  AppleFilled,
  ArrowRightOutlined,
  BellFilled,
  CalculatorOutlined,
  CheckCircleFilled,
  CheckOutlined,
  CloseOutlined,
  CloudOutlined,
  CrownFilled,
  DragOutlined,
  MessageOutlined,
  MinusOutlined,
  SafetyCertificateFilled,
  ShopOutlined,
  StarFilled,
  TeamOutlined,
  ThunderboltFilled,
  TrophyOutlined,
  UnorderedListOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import Logo from '../../images/logo.png';
import { Avatar, PEOPLE, Phone, ScreenHome, ScreenPost, STORY_SCREENS } from './LandingMocks';
import { LineupPlayground, OwnerDashboard, ReliabilityDemo, SplitCalculator } from './LandingInteractive';
import { prefersReducedMotion, useCountUp, useInView } from './landingHooks';
import SiteShell, { RevealText, SectionHead as BaseHead, SiteCta, scrollToId } from './Site';

// Menüde vurgulanan ana sayfa bölümleri
const SECTIONS = ['story', 'features', 'try', 'venues', 'faq'];
const em = { br: <br />, em: <em /> };
const scrollTo = scrollToId;

/** Eski çağrılar (titleKey) yeni başlık bileşenine çevrilir */
function SectionHead({ eyebrow, titleKey, text, left }) {
  const { t } = useTranslation('landing');
  return <BaseHead eyebrow={eyebrow} title={t(titleKey)} text={text} left={left} />;
}

/* ---------------- Hero ---------------- */
function RotatingWord() {
  const { t } = useTranslation('landing');
  const words = t('hero.rotate', { returnObjects: true });
  const list = Array.isArray(words) ? words : [];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion() || list.length < 2) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % list.length), 2600);
    return () => clearInterval(id);
  }, [list.length]);
  return (
    <span className="lp-rotate" aria-live="off">
      {/* En uzun kelime yer tutar, böylece satır zıplamaz */}
      <span className="lp-rotate__sizer" aria-hidden="true">
        {list.reduce((a, b) => (b.length > a.length ? b : a), '')}
      </span>
      <span key={i} className="lp-rotate__word">
        {list[i]}
      </span>
    </span>
  );
}

function Hero() {
  const { t } = useTranslation('landing');
  const ref = useRef(null);
  const trust = t('hero.trust', { returnObjects: true });

  const onMove = (e) => {
    if (prefersReducedMotion() || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    ref.current.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };

  return (
    <section className="lp-hero" ref={ref} onMouseMove={onMove}>
      <div className="lp-hero__bg" aria-hidden="true">
        <span className="lp-hero__beam is-l" />
        <span className="lp-hero__beam is-r" />
        <svg className="lp-hero__lines" viewBox="0 0 1200 500" preserveAspectRatio="xMidYMax slice">
          <path d="M-50 480 L1250 480" />
          <path d="M380 480 A220 220 0 0 1 820 480" />
          <path d="M520 480 A80 80 0 0 1 680 480" />
        </svg>
      </div>

      <div className="lp-wrap lp-hero__grid">
        <div className="lp-hero__copy">
          <span className="lp-eyebrow is-pill">
            <span className="lp-pulse" /> {t('hero.eyebrow')}
          </span>
          <h1 className="lp-h1">
            <RevealText className="lp-h1__top" text={t('hero.titleTop')} />
            <RotatingWord />
          </h1>
          <p className="lp-lead">{t('hero.text')}</p>
          <div className="lp-actions">
            <Link to="/register" className="lp-btn is-primary is-lg">
              <UserAddOutlined /> {t('hero.primary')}
            </Link>
            <a
              href="#story"
              className="lp-btn is-ghost is-lg"
              onClick={(e) => {
                e.preventDefault();
                scrollTo('story');
              }}
            >
              {t('hero.secondary')} <ArrowRightOutlined />
            </a>
          </div>
          <ul className="lp-trust">
            {Array.isArray(trust) &&
              trust.map((x) => (
                <li key={x}>
                  <CheckCircleFilled /> {x}
                </li>
              ))}
          </ul>
        </div>

        <div className="lp-hero__stage" aria-hidden="true">
          <div className="lp-hero__glow" />
          <Phone className="lp-hero__phone-back">
            <ScreenPost />
          </Phone>
          <Phone className="lp-hero__phone">
            <ScreenHome />
          </Phone>
          <div className="lp-floater is-a">
            <span className="lp-floater__icon is-lime">
              <BellFilled />
            </span>
            <span>
              <small>Yedek sistemi</small>
              <strong>Tolga kadroya geçti</strong>
            </span>
          </div>
          <div className="lp-floater is-b">
            <span className="lp-floater__icon is-good">
              <SafetyCertificateFilled />
            </span>
            <span>
              <small>Güvenilirlik</small>
              <strong>96 · Güvenilir</strong>
            </span>
          </div>
          <div className="lp-floater is-c">
            <span className="lp-floater__icon is-gold">
              <CrownFilled />
            </span>
            <span>
              <small>Maçın oyuncusu</small>
              <strong>Burak · 6 oy</strong>
            </span>
          </div>
        </div>
      </div>

      <button type="button" className="lp-hero__scroll" onClick={() => scrollTo('audience')} aria-label={t('hero.secondary')}>
        <span />
      </button>
    </section>
  );
}

/* ---------------- Kimin için + rakamlar ---------------- */
function Audience() {
  const { t } = useTranslation('landing');
  const items = [
    { key: 'player', icon: <TeamOutlined />, target: 'story' },
    { key: 'organizer', icon: <DragOutlined />, target: 'try' },
    { key: 'venue', icon: <ShopOutlined />, target: 'venues' },
  ];
  return (
    <section id="audience" className="lp-audience">
      <div className="lp-wrap lp-audience__grid">
        {items.map((it, i) => (
          <a
            key={it.key}
            href={`#${it.target}`}
            className="lp-aud"
            data-reveal
            data-spot
            style={{ '--rd': `${i * 90}ms` }}
            onClick={(e) => {
              e.preventDefault();
              scrollTo(it.target);
            }}
          >
            <span className="lp-aud__icon">{it.icon}</span>
            <strong>{t(`audience.${it.key}.title`)}</strong>
            <p>{t(`audience.${it.key}.text`)}</p>
            <span className="lp-aud__link">
              {t(`audience.${it.key}.link`)} <ArrowRightOutlined />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function Stat({ s, run }) {
  const v = useCountUp(s.value, run, 1100);
  return (
    <div className="lp-stat">
      <b>
        {s.prefix}
        {Math.round(v)}
        {s.suffix}
      </b>
      <span>{s.label}</span>
    </div>
  );
}

function Stats() {
  const { t } = useTranslation('landing');
  const stats = t('stats', { returnObjects: true });
  const marquee = t('marquee', { returnObjects: true });
  const [ref, inView] = useInView({ threshold: 0.4 });
  return (
    <section className="lp-stats">
      <div className="lp-wrap lp-stats__grid" ref={ref}>
        {Array.isArray(stats) && stats.map((s) => <Stat key={s.label} s={s} run={inView} />)}
      </div>
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee__track">
          {[0, 1].map((k) =>
            (Array.isArray(marquee) ? marquee : []).map((m) => (
              <span key={`${k}-${m}`}>
                <StarFilled /> {m}
              </span>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Hikâye: yapışkan telefon ---------------- */
function Story() {
  const { t } = useTranslation('landing');
  const steps = t('story.steps', { returnObjects: true });
  const list = Array.isArray(steps) ? steps : [];
  const [active, setActive] = useState(0);
  const refs = useRef([]);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number(e.target.dataset.step));
        }),
      { rootMargin: '-45% 0px -45% 0px' }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [list.length]);

  return (
    <section id="story" className="lp-section lp-story">
      <div className="lp-wrap">
        <SectionHead eyebrow={t('story.eyebrow')} titleKey="story.title" />
        <div className="lp-story__grid">
          <div className="lp-story__steps">
            {list.map((s, i) => {
              const Screen = STORY_SCREENS[i];
              return (
                <article
                  key={s.tag}
                  ref={(el) => (refs.current[i] = el)}
                  data-step={i}
                  className={`lp-step ${active === i ? 'is-active' : ''}`}
                >
                  <span className="lp-step__tag">{s.tag}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  <ul>
                    {(s.points || []).map((p) => (
                      <li key={p}>
                        <CheckOutlined /> {p}
                      </li>
                    ))}
                  </ul>
                  {/* Mobilde ekran adımın içinde görünür */}
                  <div className="lp-step__screen" aria-hidden="true">
                    {Screen && (
                      <Phone className="is-small">
                        <Screen />
                      </Phone>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="lp-story__sticky" aria-hidden="true">
            <div className="lp-story__dots">
              {list.map((s, i) => (
                <span key={s.tag} className={i === active ? 'is-on' : ''} />
              ))}
            </div>
            <Phone className="lp-story__phone">
              {STORY_SCREENS.map((Screen, i) => (
                <div key={i} className={`lp-story__layer ${i === active ? 'is-on' : ''}`}>
                  <Screen />
                </div>
              ))}
            </Phone>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Bento özellikler ---------------- */
function Bento() {
  const { t } = useTranslation('landing');
  const tile = (key, icon, visual, cls = '') => (
    <article className={`lp-tile ${cls}`} data-reveal data-spot>
      <div className="lp-tile__visual" aria-hidden="true">
        {visual}
      </div>
      <div className="lp-tile__copy">
        <span className="lp-tile__icon">{icon}</span>
        <h3>{t(`bento.items.${key}.title`)}</h3>
        <p>{t(`bento.items.${key}.text`)}</p>
      </div>
    </article>
  );

  return (
    <section id="features" className="lp-section is-alt">
      <div className="lp-wrap">
        <SectionHead eyebrow={t('bento.eyebrow')} titleKey="bento.title" />
        <div className="lp-bento">
          {tile(
            'pitch',
            <DragOutlined />,
            <div className="lp-bv-pitch">
              {[
                [8, 50, 0, 'h'], [24, 25, 1, 'h'], [24, 75, 2, 'h'], [40, 50, 3, 'h'],
                [92, 50, 7, 'a'], [76, 25, 8, 'a'], [76, 75, 9, 'a'], [60, 50, 10, 'a'],
              ].map(([x, y, i, s]) => (
                <span key={i} className={`is-${s} ${i === 3 ? 'is-move' : ''}`} style={{ left: `${x}%`, top: `${y}%` }}>
                  {PEOPLE[i].ini}
                </span>
              ))}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M40 50 Q 44 30 46 22" />
              </svg>
            </div>,
            'is-wide is-tall'
          )}
          {tile(
            'reliability',
            <SafetyCertificateFilled />,
            <div className="lp-bv-rel">
              <svg viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" />
                <circle cx="18" cy="18" r="15" pathLength="100" className="is-val" />
              </svg>
              <b>96</b>
            </div>
          )}
          {tile(
            'waitlist',
            <UnorderedListOutlined />,
            <div className="lp-bv-wait">
              <span className="is-out">
                <Avatar p={PEOPLE[5]} size={24} /> Onur <MinusOutlined />
              </span>
              <span className="is-in">
                <Avatar p={{ ini: 'TO', name: 'Tolga', hue: 45 }} size={24} /> Tolga <CheckOutlined />
              </span>
            </div>
          )}
          {tile(
            'chat',
            <MessageOutlined />,
            <div className="lp-bv-chat">
              <span className="is-them">Kim krampon getiriyor? 👟</span>
              <span className="is-me">Ben 2 tane alırım</span>
              <span className="is-them is-typing">
                <i />
                <i />
                <i />
              </span>
            </div>,
            'is-wide'
          )}
          {tile(
            'ai',
            <ThunderboltFilled />,
            <div className="lp-bv-ai">
              <span>
                <i style={{ '--w': '78%' }} />
                <b>78</b>
              </span>
              <span className="is-away">
                <i style={{ '--w': '76%' }} />
                <b>76</b>
              </span>
            </div>
          )}
          {tile(
            'tournament',
            <TrophyOutlined />,
            <svg className="lp-bv-bracket" viewBox="0 0 120 70">
              <path d="M4 8h22v14h14M4 36h22V22M4 44h22v14h14M4 66h22V58M40 15h22v25h18M40 58h22V40" />
              <circle cx="96" cy="40" r="9" />
            </svg>
          )}
          {tile(
            'weather',
            <CloudOutlined />,
            <div className="lp-bv-weather">
              <CloudOutlined />
              <b>18°</b>
              <small>21:00</small>
            </div>
          )}
          {tile(
            'mvp',
            <CrownFilled />,
            <div className="lp-bv-lb">
              {[
                [1, PEOPLE[3], 1240],
                [2, PEOPLE[0], 1185],
                [3, PEOPLE[8], 1102],
              ].map(([n, p, pts]) => (
                <span key={n} className={n === 1 ? 'is-top' : ''}>
                  <b>{n}</b>
                  <Avatar p={p} size={22} />
                  {p.name}
                  <em>{pts}</em>
                </span>
              ))}
            </div>,
            'is-wide'
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Dene ---------------- */
function TryIt() {
  const { t } = useTranslation('landing');
  const [tab, setTab] = useState('lineup');
  const tabs = [
    { key: 'lineup', icon: <DragOutlined /> },
    { key: 'split', icon: <CalculatorOutlined /> },
    { key: 'reliability', icon: <SafetyCertificateFilled /> },
  ];
  const head = {
    lineup: ['lineup.title', 'lineup.text'],
    split: ['split.title', 'split.text'],
    reliability: ['rel.title', 'rel.text'],
  }[tab];

  return (
    <section id="try" className="lp-section lp-try">
      <div className="lp-wrap">
        <SectionHead eyebrow={t('try.eyebrow')} titleKey="try.title" text={t('try.text')} />
        <div className="lp-tabs" role="tablist">
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={tab === x.key}
              className={tab === x.key ? 'is-on' : ''}
              onClick={() => setTab(x.key)}
            >
              {x.icon} {t(`try.tabs.${x.key}`)}
            </button>
          ))}
        </div>
        <div className="lp-try__panel" role="tabpanel" key={tab}>
          <div className="lp-try__head">
            <h3>{t(head[0])}</h3>
            <p>{t(head[1])}</p>
          </div>
          {tab === 'lineup' && <LineupPlayground />}
          {tab === 'split' && <SplitCalculator />}
          {tab === 'reliability' && <ReliabilityDemo />}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Karşılaştırma ---------------- */
function Compare() {
  const { t } = useTranslation('landing');
  const rows = t('compare.rows', { returnObjects: true });
  return (
    <section className="lp-section is-alt">
      <div className="lp-wrap lp-compare-wrap">
        <SectionHead eyebrow={t('compare.eyebrow')} titleKey="compare.title" />
        <div className="lp-compare" role="table" data-reveal>
          <div className="lp-compare__row is-head" role="row">
            <span role="columnheader" />
            <span role="columnheader">
              <MessageOutlined /> {t('compare.colGroup')}
            </span>
            <span role="columnheader" className="is-app">
              <img src={Logo} alt="" /> {t('compare.colApp')}
            </span>
          </div>
          {Array.isArray(rows) &&
            rows.map((r) => (
              <div key={r.label} className="lp-compare__row" role="row">
                <span role="rowheader">{r.label}</span>
                <span role="cell" className="is-group">
                  <CloseOutlined /> {r.group}
                </span>
                <span role="cell" className="is-app">
                  <CheckCircleFilled /> {r.app}
                </span>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- İşletmeler ---------------- */
function Venues() {
  const { t } = useTranslation('landing');
  const points = t('venues.points', { returnObjects: true });
  return (
    <section id="venues" className="lp-section lp-venues">
      <div className="lp-wrap lp-venues__grid">
        <div className="lp-venues__copy">
          <SectionHead eyebrow={t('venues.eyebrow')} titleKey="venues.title" text={t('venues.text')} left />
          <div className="lp-venues__points">
            {Array.isArray(points) &&
              points.map((p, i) => (
                <div key={p.title} className="lp-vp" data-reveal style={{ '--rd': `${i * 80}ms` }}>
                  <CheckCircleFilled />
                  <span>
                    <strong>{p.title}</strong>
                    <small>{p.text}</small>
                  </span>
                </div>
              ))}
          </div>
          <div className="lp-actions">
            <Link to="/isletmeler" className="lp-btn is-primary is-lg">
              <ShopOutlined /> {t('pages.biz.go')}
            </Link>
            <Link to="/login" className="lp-btn is-ghost is-lg">
              {t('venues.cta')}
            </Link>
          </div>
        </div>
        <OwnerDashboard />
      </div>
    </section>
  );
}

/* ---------------- Kurulum + SSS ---------------- */
function InstallFaq() {
  const { t } = useTranslation('landing');
  const faqs = t('faq.items', { returnObjects: true });
  const platforms = [
    { key: 'android', icon: <AndroidFilled /> },
    { key: 'ios', icon: <AppleFilled /> },
  ];
  return (
    <section id="faq" className="lp-section is-alt">
      <div className="lp-wrap lp-faq-grid">
        <div>
          <SectionHead eyebrow={t('install.eyebrow')} titleKey="install.title" text={t('install.text')} left />
          <div className="lp-install">
            {platforms.map((p) => (
              <div key={p.key} className="lp-install__card" data-reveal data-spot>
                <strong>
                  {p.icon} {t(`install.${p.key}.title`)}
                </strong>
                <ol>
                  {(t(`install.${p.key}.steps`, { returnObjects: true }) || []).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
        <div>
          <SectionHead eyebrow={t('faq.eyebrow')} titleKey="faq.title" left />
          <div className="lp-faq">
            {Array.isArray(faqs) &&
              faqs.map((f, i) => (
                <details key={f.q} className="lp-qa" open={i === 0}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Alt sayfa vitrini ---------------- */
function Pages() {
  const { t } = useTranslation('landing');
  return (
    <section className="lp-section">
      <div className="lp-wrap">
        <BaseHead eyebrow={t('pages.eyebrow')} title={t('pages.title')} />
        <div className="lp-pages">
          <Link to="/mesajlasma" className="lp-pagecard" data-reveal data-spot>
            <div className="lp-pagecard__copy">
              <span className="lp-eyebrow">
                <MessageOutlined /> {t('pages.msg.eyebrow')}
              </span>
              <h3>
                <Trans t={t} i18nKey="pages.msg.title" components={em} />
              </h3>
              <p>{t('pages.msg.text')}</p>
              <span className="lp-pagecard__go">
                {t('pages.msg.go')}
                <i>
                  <ArrowRightOutlined />
                </i>
              </span>
            </div>
            <div className="lp-pagecard__visual" aria-hidden="true">
              <div className="lp-pv-chat">
                <span style={{ '--i': 0 }}>
                  <b>Ahmet</b>Perşembe 21:00, kadro 12/14 👀
                </span>
                <span className="is-me lp-pv-react" style={{ '--i': 1 }}>
                  Ben + Kaan geliyoruz
                </span>
                <span style={{ '--i': 2 }}>
                  <b>Mert</b>Krampon kiralık var mı?
                </span>
              </div>
            </div>
          </Link>
          <Link to="/isletmeler" className="lp-pagecard is-gold" data-reveal data-spot style={{ '--rd': '120ms' }}>
            <div className="lp-pagecard__copy">
              <span className="lp-eyebrow">
                <ShopOutlined /> {t('pages.biz.eyebrow')}
              </span>
              <h3>
                <Trans t={t} i18nKey="pages.biz.title" components={em} />
              </h3>
              <p>{t('pages.biz.text')}</p>
              <span className="lp-pagecard__go">
                {t('pages.biz.go')}
                <i>
                  <ArrowRightOutlined />
                </i>
              </span>
            </div>
            <div className="lp-pagecard__visual" aria-hidden="true">
              <div className="lp-pv-biz">
                {[38, 52, 46, 64, 58, 74, 86].map((h, i) => (
                  <i key={i} style={{ '--h': `${h}%`, '--i': i }} />
                ))}
              </div>
              <span className="lp-pv-biz__tag">
                Doluluk
                <b>%86</b>
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const { t } = useTranslation('landing');
  return (
    <SiteCta
      title={t('cta.title')}
      text={t('cta.text')}
      avatars={
        <span className="lp-final__stack" aria-hidden="true">
          {PEOPLE.slice(0, 7).map((p) => (
            <Avatar key={p.ini} p={p} size={38} />
          ))}
          <span className="lp-final__more">+7</span>
        </span>
      }
      actions={[
        { to: '/register', label: t('cta.primary'), icon: <UserAddOutlined />, primary: true },
        { to: '/login', label: t('cta.secondary') },
      ]}
    />
  );
}

/**
 * Herkese açık tanıtım sitesi ("/"). Üstte giriş / üye ol; oturum açıksa doğrudan uygulamaya gider.
 * Yerel uygulama kabuğunda (Capacitor) tanıtım atlanır, giriş ekranı açılır.
 */
export default function Landing() {
  return (
    <SiteShell title="MatcBuddy · Halı saha maçını kur, kadronu tamamla" sections={SECTIONS} redirectIfLoggedIn>
      <Hero />
      <Audience />
      <Stats />
      <Story />
      <Bento />
      <TryIt />
      <Compare />
      <Pages />
      <Venues />
      <InstallFaq />
      <FinalCta />
    </SiteShell>
  );
}
