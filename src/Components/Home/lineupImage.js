import dayjs from 'dayjs';
import { SIDE } from '../../api/matches';
import { roleShort } from './formations';

/**
 * Sahadaki dizilişin paylaşılabilir resmi (1080×1500, telefon / Instagram hikâyesine uygun dikey).
 * Avatarlar çizilmez (başka alan adındaki resimler tuvali "kirletir" ve dışa aktarmayı engeller); baş harfler kullanılır.
 * Renkler uygulamanın koyu temasıyla aynıdır — resim her temada aynı görünür.
 */

const W = 1080;
const H = 1500;
const FIELD = { x: 70, y: 300, w: 940, h: 1020 };
const COLORS = {
  bg: '#0b1410',
  bg2: '#0f1f17',
  turfA: '#1c6b35',
  turfB: '#186030',
  line: 'rgba(255,255,255,0.82)',
  text: '#f4f7f2',
  muted: 'rgba(244,247,242,0.66)',
  home: '#c6f432',
  away: '#38bdf8',
  gold: '#fbbf24',
  ink: '#0b1410',
};
const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

const font = (size, weight = 600) => `${weight} ${size}px ${FONT}`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Metni verilen genişliğe sığdırır (sonuna … ekler) */
function fit(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

const initials = (name) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toLocaleUpperCase('tr-TR') || '?';

/** Saha üzerindeki kısa ad: "Ali Y." */
function shortName(entry) {
  if (!entry) return '';
  if (entry.kind === 'guest') return entry.g.name || '';
  const p = entry.p.player || {};
  const first = (p.playerName || p.userName || '').trim().split(/\s+/)[0];
  const last = (p.playerSurname || '').trim();
  return last ? `${first} ${last.charAt(0)}.` : first;
}

function fullNameOf(entry) {
  if (!entry) return '';
  if (entry.kind === 'guest') return entry.g.name || '';
  const p = entry.p.player || {};
  return [p.playerName, p.playerSurname].filter(Boolean).join(' ') || p.userName || '';
}

function drawField(ctx) {
  const { x, y, w, h } = FIELD;
  // Çim şeritleri
  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? COLORS.turfA : COLORS.turfB;
    ctx.fillRect(x, y + (h / stripes) * i, w, h / stripes + 1);
  }
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 5;
  ctx.strokeRect(x, y, w, h);
  // Orta çizgi + orta yuvarlak
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 110, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = COLORS.line;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 8, 0, Math.PI * 2);
  ctx.fill();
  // Ceza sahaları + kale alanları (üst = deplasman, alt = ev sahibi)
  const boxW = w * 0.56;
  const boxH = h * 0.15;
  const smallW = w * 0.28;
  const smallH = h * 0.06;
  [
    [y, 1],
    [y + h, -1],
  ].forEach(([edge, dir]) => {
    ctx.strokeRect(x + (w - boxW) / 2, dir > 0 ? edge : edge - boxH, boxW, boxH);
    ctx.strokeRect(x + (w - smallW) / 2, dir > 0 ? edge : edge - smallH, smallW, smallH);
    ctx.beginPath();
    ctx.arc(x + w / 2, edge + dir * boxH, 70, dir > 0 ? 0.15 * Math.PI : 1.15 * Math.PI, dir > 0 ? 0.85 * Math.PI : 1.85 * Math.PI);
    ctx.stroke();
  });
}

function drawToken(ctx, cx, cy, slot, color, isMvp) {
  const r = 40;
  const { entry } = slot;
  if (!entry) {
    // Boş yer: kesik çizgili halka
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = font(40, 500);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', cx, cy + 2);
    return;
  }
  // Gölge + daire
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = entry.kind === 'guest' ? 'rgba(255,255,255,0.92)' : color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (entry.kind === 'guest') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(30, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials(fullNameOf(entry)), cx, cy + 2);

  // Kaleci rozeti
  if (slot.role === 'KL') {
    ctx.fillStyle = COLORS.ink;
    roundRect(ctx, cx + r - 30, cy - r - 4, 44, 28, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.font = font(18, 800);
    ctx.fillText(roleShort('KL'), cx + r - 8, cy - r + 10);
  }
  if (isMvp) {
    // Taç yuvarlağın sol üstünde (üst hattın isim etiketine binmesin)
    ctx.font = font(30, 400);
    ctx.fillText('👑', cx - r + 4, cy - r + 8);
  }

  // Ad etiketi
  ctx.font = font(24, 700);
  const label = fit(ctx, shortName(entry), 180);
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(11,20,16,0.78)';
  roundRect(ctx, cx - tw / 2 - 10, cy + r + 6, tw + 20, 34, 11);
  ctx.fill();
  ctx.fillStyle = COLORS.text;
  ctx.fillText(label, cx, cy + r + 24);
}

function teamPill(ctx, text, count, color, x, y, align) {
  ctx.font = font(28, 800);
  const label = fit(ctx, text, 520);
  const countText = ` ${count}`;
  ctx.font = font(28, 800);
  const w1 = ctx.measureText(label).width;
  ctx.font = font(26, 600);
  const w2 = ctx.measureText(countText).width;
  const w = w1 + w2 + 56;
  const left = align === 'right' ? x - w : x;
  ctx.fillStyle = 'rgba(11,20,16,0.82)';
  roundRect(ctx, left, y, w, 50, 25);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(left + 24, y + 25, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.text;
  ctx.font = font(28, 800);
  ctx.fillText(label, left + 42, y + 26);
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(26, 600);
  ctx.fillText(countText, left + 42 + w1, y + 26);
}

/**
 * @param {object} o
 * @param {Array} o.sides       Pitch bileşenindeki taraflar: [{ side, roster: { count }, slots: [{ x, y, role, entry }] }]
 * @param {object} o.detail     Maç detayı (matchName, matchDate, venue, stadium, result, capacity, mvp)
 * @param {string} o.homeLabel
 * @param {string} o.awayLabel
 * @param {number} o.perSide
 * @param {Function} o.t        i18next t
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderLineupImage({ sides, detail, homeLabel, awayLabel, perSide, t }) {
  try {
    await document.fonts?.ready;
  } catch {
    /* yazı tipi beklenemezse sistem yazı tipi */
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Arka plan
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COLORS.bg2);
  g.addColorStop(1, COLORS.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Başlık
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.home;
  ctx.font = font(30, 800);
  ctx.fillText(t('match:lineupImage.kicker'), 70, 92);
  ctx.fillStyle = COLORS.text;
  ctx.font = font(60, 800);
  ctx.fillText(fit(ctx, detail.matchName || '', detail.result ? 700 : 940), 70, 166);
  const date = dayjs(detail.matchDate);
  const venue = detail.venue
    ? [detail.venue.name, detail.venue.pitchName].filter(Boolean).join(' · ')
    : detail.stadium?.stadiumName || '';
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(32, 500);
  ctx.fillText(fit(ctx, `📅 ${date.format('DD MMMM dddd · HH:mm')}`, 940), 70, 220);
  if (venue) ctx.fillText(fit(ctx, `📍 ${venue}`, 940), 70, 266);

  // Skor (oynandıysa)
  if (detail.result) {
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.gold;
    ctx.font = font(84, 800);
    ctx.fillText(`${detail.result.homeScore}–${detail.result.awayScore}`, W - 70, 170);
  }

  drawField(ctx);

  // Oyuncular: x (0 = ev sahibi kalesi, 100 = deplasman kalesi) dikeyde aşağıdan yukarı, y yatayda
  // Dikey resimde hatlar sıkışmasın: her tarafın derinliği kendi yarı sahasına (kale önü → orta çizgi yakını) yayılır
  const mvpId = detail.mvp?.player?.playerId;
  sides.forEach((s) => {
    const color = s.side === SIDE.AWAY ? COLORS.away : COLORS.home;
    const depthOf = (slot) => (s.side === SIDE.AWAY ? 100 - slot.x : slot.x);
    const depths = s.slots.map(depthOf);
    const minD = Math.min(...depths);
    const maxD = Math.max(...depths);
    const spread = (d) => (maxD - minD < 1 ? 25 : 10 + ((d - minD) / (maxD - minD)) * 34); // 10..44
    s.slots.forEach((slot) => {
      const d = spread(depthOf(slot));
      const x = s.side === SIDE.AWAY ? 100 - d : d;
      const cx = FIELD.x + (slot.y / 100) * FIELD.w;
      const cy = FIELD.y + (1 - x / 100) * FIELD.h;
      const isMvp = !!mvpId && slot.entry?.kind === 'player' && slot.entry.p.player?.playerId === mvpId;
      drawToken(ctx, cx, cy, slot, color, isMvp);
    });
  });

  // Takım etiketleri (deplasman üstte, ev sahibi altta)
  const home = sides.find((s) => s.side === SIDE.HOME);
  const away = sides.find((s) => s.side === SIDE.AWAY);
  teamPill(ctx, awayLabel, `${away?.roster.count ?? 0}/${perSide}`, COLORS.away, FIELD.x + 20, FIELD.y + 18, 'left');
  teamPill(ctx, homeLabel, `${home?.roster.count ?? 0}/${perSide}`, COLORS.home, FIELD.x + FIELD.w - 20, FIELD.y + FIELD.h - 68, 'right');

  // Alt bilgi: kadro durumu + marka
  const total = (home?.roster.count || 0) + (away?.roster.count || 0);
  const missing = Math.max((detail.capacity || 0) - total, 0);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.text;
  ctx.font = font(34, 700);
  ctx.fillText(
    missing > 0 && !detail.isPast
      ? t('match:lineupImage.missing', { count: missing, total, capacity: detail.capacity })
      : t('match:lineupImage.full', { total }),
    70,
    1395
  );
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(26, 500);
  ctx.fillText(t('match:lineupImage.cta'), 70, 1440);

  // Marka (sağ alt)
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.home;
  ctx.font = font(44, 900);
  ctx.fillText('MatcBuddy', W - 70, 1405);
  ctx.fillStyle = COLORS.muted;
  ctx.font = font(26, 600);
  ctx.fillText('matcbuddy.com', W - 70, 1442);

  return canvas;
}

export const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
