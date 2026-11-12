import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  LockOutlined,
  MessageOutlined,
  PictureOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SendOutlined,
  SmileOutlined,
  TeamOutlined,
  ThunderboltFilled,
  UserAddOutlined,
} from '@ant-design/icons';
import SiteShell, { RevealText, SectionHead, SiteCta, clamp01, scrollToId, useScrollFrame } from './Site';
import { Avatar, PEOPLE, Phone } from './LandingMocks';
import { prefersReducedMotion, useVisible } from './landingHooks';
import './Messaging.css';

const TR = (s) => s.toLocaleLowerCase('tr');

/* =========================================================
   Hero: kendi kendine akan grup sohbeti
   ========================================================= */
const ME = 0;
const SCRIPT = [
  { who: 1, text: 'Perşembe 21:00 Yeşil Vadi’de saha tamam 🙌' },
  { who: 2, text: 'Kadro kaç oldu?' },
  { who: ME, text: '12/14, iki kişi lazım' },
  { react: 0, emoji: '🔥', n: 3 },
  { who: 3, photo: true, text: 'Geçen haftadan 📸' },
  { who: 4, replyTo: 2, text: 'Ben + Kaan geliyoruz' },
  { card: true },
  { who: ME, text: 'Kadro tamam! Krampon kiralayan bana yazsın 👟' },
  { seen: true },
];

function useChatScript(running) {
  const [step, setStep] = useState(prefersReducedMotion() ? SCRIPT.length : 0);
  const [typing, setTyping] = useState(null);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!running || prefersReducedMotion()) return undefined;
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    if (step >= SCRIPT.length) {
      later(() => setFading(true), 3600);
      later(() => {
        setStep(0);
        setFading(false);
      }, 4200);
    } else {
      const ev = SCRIPT[step];
      const typer = ev.who !== undefined && ev.who !== ME ? ev.who : null;
      if (typer !== null) {
        later(() => setTyping(typer), 450);
        later(() => {
          setTyping(null);
          setStep((s) => s + 1);
        }, 1650);
      } else {
        later(() => setStep((s) => s + 1), ev.react || ev.seen ? 700 : 1300);
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [step, running]);

  return { step, typing, fading };
}

function ChatBubble({ m, msgs }) {
  const p = PEOPLE[m.who] || PEOPLE[0];
  const mine = m.who === ME;
  if (m.card) {
    return (
      <div className="lp-cb-card">
        <span className="lp-cb-card__tag">
          <ThunderboltFilled /> Maç
        </span>
        <strong>Kartallar – Moda Spor</strong>
        <small>
          <EnvironmentOutlined /> Yeşil Vadi · Per 21:00
        </small>
        <span className="lp-cb-card__bar">
          <i />
        </span>
        <span className="lp-cb-card__foot">
          <b>14/14</b> Kadro tamam
        </span>
      </div>
    );
  }
  const quoted = m.replyTo !== undefined ? msgs[m.replyTo] : null;
  return (
    <div className={`lp-cb ${mine ? 'is-me' : ''}`}>
      {!mine && <Avatar p={p} size={22} />}
      <div className="lp-cb__body">
        {!mine && <b className="lp-cb__name" style={{ '--h': p.hue }}>{p.name}</b>}
        {quoted && (
          <span className="lp-cb__quote">
            <i>{(PEOPLE[quoted.who] || PEOPLE[0]).name}</i>
            {quoted.text}
          </span>
        )}
        {m.photo && <span className="lp-cb__photo" />}
        <span>{m.text}</span>
        {m.reaction && (
          <span className="lp-cb__react">
            {m.reaction.emoji} {m.reaction.n}
          </span>
        )}
      </div>
    </div>
  );
}

function LiveGroupChat() {
  const ref = useRef(null);
  const visible = useVisible(ref);
  const { step, typing, fading } = useChatScript(visible);

  const { msgs, seen } = useMemo(() => {
    const list = [];
    let isSeen = false;
    SCRIPT.slice(0, step).forEach((ev) => {
      if (ev.react !== undefined) {
        const target = list[ev.react];
        if (target) list[ev.react] = { ...target, reaction: { emoji: ev.emoji, n: ev.n } };
      } else if (ev.seen) isSeen = true;
      else list.push(ev);
    });
    return { msgs: list, seen: isSeen };
  }, [step]);

  const typer = typing !== null ? PEOPLE[typing] : null;

  return (
    <div ref={ref} className="lp-msg-stage" data-tilt>
      <div className="lp-msg-stage__glow" />
      <Phone className="lp-msg-phone" label="Grup sohbeti örneği">
        <div className={`lp-chat ${fading ? 'is-fading' : ''}`}>
          <div className="lp-chat__head">
            <ArrowLeftOutlined />
            <span className="lp-chat__group">
              <TeamOutlined />
            </span>
            <span className="lp-chat__title">
              <strong>Perşembe Maçı</strong>
              <small className={typer ? 'is-typing' : ''}>
                {typer ? `${typer.name} yazıyor…` : '14 üye · 6 çevrimiçi'}
              </small>
            </span>
          </div>
          <div className="lp-chat__body">
            <span className="lp-chat__day">Bugün</span>
            {msgs.map((m, i) => (
              <ChatBubble key={i} m={m} msgs={msgs} />
            ))}
            {seen && (
              <span className="lp-chat__seen">
                <CheckOutlined />
                <CheckOutlined /> Görüldü · 21:04
              </span>
            )}
            {typer && (
              <div className="lp-cb is-typing">
                <Avatar p={typer} size={22} />
                <div className="lp-cb__body">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
          </div>
          <div className="lp-chat__compose">
            <SmileOutlined />
            <span>Mesaj yaz…</span>
            <PictureOutlined />
            <span className="lp-chat__send">
              <SendOutlined />
            </span>
          </div>
        </div>
      </Phone>
      <div className="lp-msg-float is-a">
        <span>🔥</span> <b>3 tepki</b>
      </div>
      <div className="lp-msg-float is-b">
        <CheckOutlined />
        <CheckOutlined /> <b>Görüldü</b>
      </div>
    </div>
  );
}

function MsgHero() {
  const { t } = useTranslation('landing');
  const chips = t('msg.hero.chips', { returnObjects: true });
  return (
    <section className="lp-subhero lp-msg-hero">
      <div className="lp-subhero__bg" aria-hidden="true" />
      <div className="lp-wrap lp-msg-hero__grid">
        <div className="lp-subhero__in">
          <span className="lp-eyebrow is-pill">
            <MessageOutlined /> {t('msg.hero.eyebrow')}
          </span>
          <RevealText as="h1" className="lp-display" text={t('msg.hero.title')} />
          <p className="lp-lead">{t('msg.hero.text')}</p>
          <div className="lp-actions">
            <Link to="/register" className="lp-btn is-primary is-lg">
              <UserAddOutlined /> {t('msg.hero.primary')}
            </Link>
            <a
              href="#try"
              className="lp-btn is-ghost is-lg"
              onClick={(e) => {
                e.preventDefault();
                scrollToId('try');
              }}
            >
              {t('msg.hero.secondary')} <ArrowRightOutlined />
            </a>
          </div>
          <div className="lp-chips">
            {Array.isArray(chips) &&
              chips.map((c) => (
                <span key={c} className="lp-chip">
                  <CheckOutlined /> {c}
                </span>
              ))}
          </div>
        </div>
        <LiveGroupChat />
      </div>
    </section>
  );
}

/* =========================================================
   Yana akan özellik şeridi (masaüstünde kaydırmaya bağlı)
   ========================================================= */
const ReelVisual = {
  groups: () => (
    <div className="lp-rv-groups">
      {[
        ['Perşembe Maçı', '14 üye', 3, [0, 1, 2]],
        ['Kartallar FC', '9 üye', 0, [3, 4, 5]],
        ['Pazar Sabahçıları', '12 üye', 12, [6, 7, 8]],
      ].map(([n, c, u, ps]) => (
        <span key={n}>
          <span className="lp-stack">
            {ps.map((i) => (
              <Avatar key={i} p={PEOPLE[i]} size={24} />
            ))}
          </span>
          <span className="lp-rv-groups__t">
            <b>{n}</b>
            <small>{c}</small>
          </span>
          {u > 0 && <em>{u}</em>}
        </span>
      ))}
    </div>
  ),
  react: () => (
    <div className="lp-rv-react">
      <div className="lp-rv-react__bar">
        {['👍', '🔥', '⚽', '😂', '❤️'].map((e, i) => (
          <span key={e} style={{ '--i': i }}>
            {e}
          </span>
        ))}
      </div>
      <div className="lp-rv-react__msg">Kaleye kim geçiyor? 🧤</div>
      <div className="lp-rv-react__menu">
        <span>
          <RollbackOutlined /> Yanıtla
        </span>
        <span>
          <CopyOutlined /> Kopyala
        </span>
        <span className="is-danger">
          <DeleteOutlined /> Sil
        </span>
      </div>
    </div>
  ),
  photo: () => (
    <div className="lp-rv-photo">
      <span className="lp-rv-photo__drop">
        <PictureOutlined /> Fotoğrafı buraya bırak
      </span>
      <span className="lp-rv-photo__img" />
    </div>
  ),
  seen: () => (
    <div className="lp-rv-seen">
      <span className="is-me">Saha 1 mi 2 mi?</span>
      <small>
        <CheckOutlined />
        <CheckOutlined /> Görüldü · 21:04
      </small>
      <span className="is-typing">
        <b>Mert yazıyor</b>
        <i />
        <i />
        <i />
      </span>
    </div>
  ),
  quick: () => (
    <div className="lp-rv-quick">
      <div>
        {['Selam! 👋', 'Bu hafta maç var mı?', 'Perşembe akşamı boş musun?'].map((q, i) => (
          <span key={q} style={{ '--i': i }}>
            {q}
          </span>
        ))}
      </div>
      <div className="lp-rv-quick__emoji">
        {['⚽', '🥅', '🧤', '👟', '🏆', '🔥', '🙌', '🎯'].map((e, i) => (
          <i key={e} style={{ '--i': i }}>
            {e}
          </i>
        ))}
      </div>
    </div>
  ),
  comments: () => (
    <div className="lp-rv-comments">
      <div className="lp-rv-comments__score">
        <span>Kartallar</span>
        <b>7 – 5</b>
        <span>Moda Spor</span>
        <i className="lp-live-dot">Canlı</i>
      </div>
      {[
        [PEOPLE[3], 'Rövanş ne zaman? 😤'],
        [PEOPLE[1], 'Burak’ın ikinci golü 🔥'],
      ].map(([p, txt], i) => (
        <span key={i} className="lp-rv-comments__row" style={{ '--i': i }}>
          <Avatar p={p} size={22} />
          <span>
            <b>{p.name}</b> {txt}
          </span>
        </span>
      ))}
    </div>
  ),
};

function Reel() {
  const { t } = useTranslation('landing');
  const items = t('msg.reel.items', { returnObjects: true });
  const list = Array.isArray(items) ? items : [];
  const outerRef = useRef(null);
  const trackRef = useRef(null);
  const barRef = useRef(null);

  useScrollFrame(outerRef, (rect, vh, el) => {
    const track = trackRef.current;
    if (!track) return;
    if (window.innerWidth <= 960 || prefersReducedMotion()) {
      track.style.transform = '';
      return;
    }
    const p = clamp01(-rect.top / Math.max(1, rect.height - vh));
    const dist = track.scrollWidth - el.querySelector('.lp-reel__view').clientWidth;
    track.style.transform = `translate3d(${(-p * Math.max(0, dist)).toFixed(1)}px,0,0)`;
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
  });

  return (
    <section className="lp-reel" ref={outerRef} id="features">
      <div className="lp-reel__sticky">
        <div className="lp-wrap lp-reel__head">
          <SectionHead eyebrow={t('msg.reel.eyebrow')} title={t('msg.reel.title')} left />
          <div className="lp-reel__meter" aria-hidden="true">
            <span ref={barRef} />
          </div>
        </div>
        <div className="lp-reel__view">
          <div className="lp-reel__track" ref={trackRef}>
            {list.map((it, i) => {
              const V = ReelVisual[it.key];
              return (
                <article key={it.key} className="lp-reel__card" data-spot>
                  <span className="lp-reel__num">0{i + 1}</span>
                  <div className="lp-reel__visual" aria-hidden="true">
                    {V && <V />}
                  </div>
                  <h3>{it.title}</h3>
                  <p>{it.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   Kendin dene: demo sohbet
   ========================================================= */
const EMOJIS = ['👍', '🔥', '⚽', '😂', '❤️'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function botAnswer(text) {
  const s = TR(text);
  if (/maç|mac|oyn/.test(s)) return 'Perşembe 21:00 Yeşil Vadi’de var, bir kişi eksik. Seni de yazayım mı? ⚽';
  if (/boş|bos|müsait|musait/.test(s)) return 'Boşum! Saha ayarlarsan ben varım, Kaan’ı da getiririm.';
  if (/selam|merhaba|naber|hey|slm/.test(s)) return 'Selam! 👋 Bu hafta oynuyor musun?';
  if (/evet|olur|tamam|yaz|var/.test(s)) return 'Süper, davet linkini gruba atıyorum. Kadro 14/14 oldu 🔥';
  if (/krampon|ayakkabı|ayakkabi/.test(s)) return 'Sahada kiralık krampon var, ücreti sadece kiralayana yazılıyor 👟';
  if (/kaç|kac|ücret|ucret|para|fiyat/.test(s)) return 'Kişi başı 229 ₺ çıkıyor, uygulama kendisi hesapladı.';
  return pick(['Haha tamamdır 😄', 'Anlaştık, perşembe görüşürüz!', 'Gruba da ekleyeyim, orada konuşalım.']);
}

const INITIAL = [{ id: 1, from: 'bot', text: 'Selam! Perşembe 21:00 Yeşil Vadi’de bir kişi eksik ⚽', reactions: {} }];

function TryChat() {
  const { t } = useTranslation('landing');
  const quick = t('msg.try.quick', { returnObjects: true });
  const [msgs, setMsgs] = useState(INITIAL);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [menu, setMenu] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const bodyRef = useRef(null);
  const idRef = useRef(2);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [msgs, typing]);

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const send = (text) => {
    const clean = text.trim().slice(0, 240);
    if (!clean) return;
    const id = idRef.current++;
    const mine = { id, from: 'me', text: clean, reactions: {}, status: 'sent', replyTo };
    setMsgs((m) => [...m.slice(-30), mine]);
    setInput('');
    setReplyTo(null);
    setMenu(null);
    later(() => {
      setMsgs((m) => m.map((x) => (x.from === 'me' ? { ...x, status: 'seen' } : x)));
      setTyping(true);
    }, 700);
    later(() => {
      setTyping(false);
      setMsgs((m) => {
        const next = m.map((x) =>
          x.id === id && id % 2 === 0 ? { ...x, reactions: { ...x.reactions, '👍': ['Ahmet'] } } : x
        );
        return [...next, { id: idRef.current++, from: 'bot', text: botAnswer(clean), reactions: {} }];
      });
    }, 2100);
  };

  const react = (id, emoji) => {
    setMsgs((m) =>
      m.map((x) => {
        if (x.id !== id) return x;
        const who = x.reactions[emoji] || [];
        const has = who.includes('Sen');
        const next = has ? who.filter((w) => w !== 'Sen') : [...who, 'Sen'];
        const reactions = { ...x.reactions, [emoji]: next };
        if (!next.length) delete reactions[emoji];
        return { ...x, reactions };
      })
    );
    setMenu(null);
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    setMsgs(INITIAL);
    setTyping(false);
    setReplyTo(null);
    setMenu(null);
  };

  const replyMsg = replyTo ? msgs.find((m) => m.id === replyTo) : null;
  const lastMine = [...msgs].reverse().find((m) => m.from === 'me');

  return (
    <section id="try" className="lp-section is-alt">
      <div className="lp-wrap">
        <SectionHead eyebrow={t('msg.try.eyebrow')} title={t('msg.try.title')} text={t('msg.try.text')} />
        <div className="lp-trychat lp-glass" data-reveal>
          <div className="lp-trychat__head">
            <Avatar p={PEOPLE[1]} size={40} ring="lime" />
            <span className="lp-trychat__who">
              <strong>Ahmet K.</strong>
              <small className={typing ? 'is-typing' : ''}>
                {typing ? t('msg.try.typing') : (
                  <>
                    <i className="lp-online" /> {t('msg.try.online')}
                  </>
                )}
              </small>
            </span>
            <button type="button" className="lp-trychat__reset" onClick={reset}>
              <ReloadOutlined /> {t('msg.try.reset')}
            </button>
          </div>

          <div className="lp-trychat__body" ref={bodyRef} onClick={(e) => e.target === e.currentTarget && setMenu(null)}>
            <span className="lp-chat__day">Bugün</span>
            {msgs.map((m) => {
              const q = m.replyTo ? msgs.find((x) => x.id === m.replyTo) : null;
              const entries = Object.entries(m.reactions);
              return (
                <div key={m.id} className={`lp-tc ${m.from === 'me' ? 'is-me' : ''} ${menu === m.id ? 'is-menu' : ''}`}>
                  <button type="button" className="lp-tc__bubble" onClick={() => setMenu(menu === m.id ? null : m.id)}>
                    {q && (
                      <span className="lp-cb__quote">
                        <i>{q.from === 'me' ? 'Sen' : 'Ahmet'}</i>
                        {q.text}
                      </span>
                    )}
                    {m.text}
                  </button>
                  {entries.length > 0 && (
                    <span className="lp-tc__reacts">
                      {entries.map(([e, who]) => (
                        <span key={e} title={who.join(', ')}>
                          {e} {who.length > 1 ? who.length : ''}
                        </span>
                      ))}
                    </span>
                  )}
                  {menu === m.id && (
                    <div className="lp-tc__menu" role="menu">
                      <div className="lp-tc__emojis">
                        {EMOJIS.map((e) => (
                          <button key={e} type="button" onClick={() => react(m.id, e)} aria-label={e}>
                            {e}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="lp-tc__reply"
                        onClick={() => {
                          setReplyTo(m.id);
                          setMenu(null);
                        }}
                      >
                        <RollbackOutlined /> {t('msg.try.reply')}
                      </button>
                    </div>
                  )}
                  {m === lastMine && (
                    <small className={`lp-tc__status ${m.status === 'seen' ? 'is-seen' : ''}`}>
                      <CheckOutlined />
                      {m.status === 'seen' && <CheckOutlined />} {m.status === 'seen' ? t('msg.try.seen') : t('msg.try.sent')}
                    </small>
                  )}
                </div>
              );
            })}
            {typing && (
              <div className="lp-tc is-typing">
                <span className="lp-tc__bubble">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}
          </div>

          <div className="lp-trychat__quick">
            {Array.isArray(quick) &&
              quick.map((q) => (
                <button key={q} type="button" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
          </div>

          {replyMsg && (
            <div className="lp-trychat__replying">
              <span>
                <b>{t('msg.try.replyingTo')}</b> {replyMsg.text}
              </span>
              <button type="button" onClick={() => setReplyTo(null)} aria-label={t('msg.try.cancel')}>
                <CloseOutlined />
              </button>
            </div>
          )}

          <form
            className="lp-trychat__compose"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('msg.try.placeholder')}
              maxLength={240}
              aria-label={t('msg.try.placeholder')}
            />
            <button type="submit" className="lp-trychat__send" disabled={!input.trim()} aria-label={t('msg.try.send')}>
              <SendOutlined />
            </button>
          </form>
          <small className="lp-trychat__note">{t('msg.try.note')}</small>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   Gizlilik: kim yazabilir
   ========================================================= */
// 12 kişi: 4 arkadaş, 4 birlikte maç yapılan, 4 diğer
const RING = Array.from({ length: 12 }, (_, i) => {
  const kind = ['friend', 'mate', 'other'][i % 3];
  const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
  const r = i % 2 ? 41 : 34;
  return { i, kind, x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r, p: PEOPLE[(i + 1) % PEOPLE.length] };
});
const ALLOWED = {
  everyone: ['friend', 'mate', 'other'],
  mates: ['friend', 'mate'],
  mutuals: ['friend'],
};

function Privacy() {
  const { t } = useTranslation('landing');
  const options = t('msg.privacy.options', { returnObjects: true });
  const [opt, setOpt] = useState('mates');
  const allowed = ALLOWED[opt] || [];
  const count = RING.filter((n) => allowed.includes(n.kind)).length;

  return (
    <section className="lp-section">
      <div className="lp-wrap lp-priv">
        <div>
          <SectionHead eyebrow={t('msg.privacy.eyebrow')} title={t('msg.privacy.title')} text={t('msg.privacy.text')} left />
          <div className="lp-priv__opts" role="radiogroup" aria-label={t('msg.privacy.eyebrow')}>
            {Array.isArray(options) &&
              options.map((o, i) => (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={opt === o.key}
                  className={`lp-priv__opt ${opt === o.key ? 'is-on' : ''}`}
                  onClick={() => setOpt(o.key)}
                  data-reveal
                  style={{ '--rd': `${i * 80}ms` }}
                >
                  <span className="lp-priv__radio" />
                  <span>
                    <strong>{o.title}</strong>
                    <small>{o.desc}</small>
                  </span>
                </button>
              ))}
          </div>
        </div>

        <div className="lp-priv__viz lp-glass" data-reveal>
          <svg viewBox="0 0 100 100" className="lp-priv__lines" aria-hidden="true">
            <circle cx="50" cy="50" r="34" className="lp-priv__orbit" />
            <circle cx="50" cy="50" r="41" className="lp-priv__orbit" />
            {RING.map((n) => (
              <line
                key={n.i}
                x1="50"
                y1="50"
                x2={n.x}
                y2={n.y}
                pathLength="100"
                className={`is-${n.kind} ${allowed.includes(n.kind) ? 'is-on' : ''}`}
              />
            ))}
          </svg>
          <span className="lp-priv__me">
            <Avatar p={PEOPLE[0]} size={58} ring="lime" />
            <b>{t('msg.privacy.you')}</b>
          </span>
          {RING.map((n) => {
            const on = allowed.includes(n.kind);
            return (
              <span
                key={n.i}
                className={`lp-priv__node is-${n.kind} ${on ? 'is-on' : ''}`}
                style={{ left: `${n.x}%`, top: `${n.y}%`, '--d': `${n.i * 30}ms` }}
              >
                <Avatar p={n.p} size={34} />
                {!on && (
                  <span className="lp-priv__lock">
                    <LockOutlined />
                  </span>
                )}
              </span>
            );
          })}
          <div className="lp-priv__legend">
            {['friend', 'mate', 'other'].map((k) => (
              <span key={k} className={`is-${k}`}>
                <i /> {t(`msg.privacy.legend.${k}`)}
              </span>
            ))}
          </div>
          <div className="lp-priv__count">
            <b key={count}>{count}</b>
            <span>{t('msg.privacy.count', { count, total: RING.length }).replace(/^\d+\s*/, '')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   Anlık iletim şeması
   ========================================================= */
function Live() {
  const { t } = useTranslation('landing');
  const points = t('msg.live.points', { returnObjects: true });
  const paths = ['M90 160 C 200 160, 220 160, 300 160', 'M300 160 C 380 160, 400 70, 510 70', 'M300 160 L 510 160', 'M300 160 C 380 160, 400 250, 510 250'];
  return (
    <section className="lp-section is-alt">
      <div className="lp-wrap lp-live">
        <div className="lp-live__diagram lp-glass" data-reveal aria-hidden="true">
          <svg viewBox="0 0 600 320">
            <defs>
              <linearGradient id="lpLiveG" x1="0" x2="1">
                <stop offset="0" stopColor="rgba(198,244,50,0.1)" />
                <stop offset="1" stopColor="rgba(198,244,50,0.7)" />
              </linearGradient>
            </defs>
            {paths.map((d, i) => (
              <g key={i}>
                <path id={`lpLiveP${i}`} d={d} className="lp-live__path" />
                {!prefersReducedMotion() && (
                  <circle r="4" className="lp-live__dot">
                    <animateMotion dur="2.4s" begin={`${i === 0 ? 0 : 0.9}s`} repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1">
                      <mpath href={`#lpLiveP${i}`} />
                    </animateMotion>
                  </circle>
                )}
              </g>
            ))}
            <circle cx="300" cy="160" r="38" className="lp-live__hub" />
            <circle cx="300" cy="160" r="38" className="lp-live__ring" />
          </svg>
          <span className="lp-live__node is-src" style={{ left: '15%', top: '50%' }}>
            <Avatar p={PEOPLE[0]} size={44} ring="lime" />
            <small>Sen</small>
          </span>
          <span className="lp-live__node is-hub" style={{ left: '50%', top: '50%' }}>
            <ThunderboltFilled />
          </span>
          {[
            [PEOPLE[1], 21.9],
            [PEOPLE[2], 50],
            [PEOPLE[3], 78.1],
          ].map(([p, y]) => (
            <span key={p.ini} className="lp-live__node is-dst" style={{ left: '85%', top: `${y}%` }}>
              <Avatar p={p} size={38} />
              <small>{p.name}</small>
              <i className="lp-live__ping" />
            </span>
          ))}
        </div>
        <div>
          <SectionHead eyebrow={t('msg.live.eyebrow')} title={t('msg.live.title')} text={t('msg.live.text')} left />
          <div className="lp-live__points">
            {Array.isArray(points) &&
              points.map((p, i) => (
                <div key={p.title} className="lp-live__pt" data-reveal style={{ '--rd': `${i * 90}ms` }}>
                  <span className="lp-live__n">0{i + 1}</span>
                  <span>
                    <strong>{p.title}</strong>
                    <small>{p.text}</small>
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function MessagingPage() {
  const { t } = useTranslation('landing');
  return (
    <SiteShell title={t('msg.docTitle')}>
      <MsgHero />
      <Reel />
      <TryChat />
      <Privacy />
      <Live />
      <SiteCta
        title={t('msg.cta.title')}
        text={t('msg.cta.text')}
        actions={[
          { to: '/register', label: t('cta.primary'), icon: <UserAddOutlined />, primary: true },
          { to: '/login', label: t('cta.secondary') },
        ]}
      />
    </SiteShell>
  );
}
