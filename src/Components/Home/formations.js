// Saha dizilişi yapılandırması (saf fonksiyonlar, kolayca ayarlanabilir).
//
// Koordinatlar yüzde cinsindendir:
//  - depth: kendi kalesinden ileri doğru, tüm saha boyunun yüzdesi (kaleci ≈ 7, en ön hat ≈ 41)
//  - across: sahanın eni boyunca 0–100 (50 = orta)
// Ev sahibi soldan sağa hücum eder (x = depth); deplasman aynalanır (x = 100 - depth).
// Mobilde saha dikeydir: ev sahibi üst yarıda aşağı doğru hücum eder (top = depth, left = across).

/** Taraf başına oyuncu sayısına göre hatlar (kendi kalesinden dışarı doğru) */
export const FORMATION_PRESETS = {
  1: [1],
  2: [1, 1],
  3: [1, 1, 1],
  4: [1, 2, 1],
  5: [1, 2, 1, 1],
  6: [1, 2, 2, 1],
  7: [1, 3, 2, 1],
  8: [1, 3, 3, 1],
  9: [1, 3, 3, 2],
  10: [1, 4, 3, 2],
  11: [1, 4, 4, 2],
};

/** Hat başına en fazla oyuncu (11'den kalabalık kadrolarda) */
export const MAX_PER_LINE = 4;

export const ROLE_LABELS = {
  KL: 'Kaleci',
  DF: 'Defans',
  OS: 'Orta saha',
  OOS: 'Ofansif orta saha',
  FV: 'Forvet',
};

/** Yerleşim ayarları */
export const PITCH_GEOMETRY = {
  goalDepth: 7, // kalecinin kale çizgisinden uzaklığı (% saha boyu)
  frontDepth: 41, // en ön hattın derinliği (orta çizgi = 50)
  maxHalfSpan: 35, // bir hattın en geniş yayılımı: 50 ± 35 → 15..85
  minHalfSpan: 13, // 2 kişilik hattın yarı açıklığı tabanı
  spanStep: 7.5, // hatta eklenen her oyuncu için ek açıklık
};

/**
 * Hattın kavisi: kanattaki oyuncu, merkezdekine göre ne kadar ileride (% saha boyu).
 * Defansta sadece dörtlü hatta bekler öne çıkar; orta saha / forvette kanatlar öndedir.
 */
const lineCurve = (role, size) => {
  if (size < 2) return 0;
  switch (role) {
    case 'DF':
      return size >= 4 ? 2.6 : 1;
    case 'OS':
      return size >= 3 ? 4 : 2;
    case 'OOS':
      return 3.4;
    case 'FV':
      return size >= 3 ? 3 : 1.4;
    default:
      return 0;
  }
};

/** Taraf başına n oyuncu için hat dizisi. Örn. 6 → [1, 2, 2, 1] */
export function formationLines(n) {
  const size = Math.max(1, Math.floor(Number(n)) || 1);
  if (FORMATION_PRESETS[size]) return [...FORMATION_PRESETS[size]];
  const lines = [1, 4, 4];
  let rest = size - 9;
  while (rest > 0) {
    const k = Math.min(MAX_PER_LINE, rest);
    lines.push(k);
    rest -= k;
  }
  return lines;
}

/** Hat sayısına göre mevki kısaltmaları (0. hat her zaman kaleci) */
export function lineRoles(lineCount) {
  if (lineCount <= 1) return ['KL'];
  if (lineCount === 2) return ['KL', 'FV'];
  if (lineCount === 3) return ['KL', 'DF', 'FV'];
  if (lineCount === 4) return ['KL', 'DF', 'OS', 'FV'];
  const middle = Array.from({ length: lineCount - 3 }, (_, i) => (i === 0 ? 'OS' : 'OOS'));
  return ['KL', 'DF', ...middle, 'FV'];
}

/** Kalecisiz diziliş etiketi: [1, 2, 2, 1] → "2-2-1" */
export const formationLabel = (lines) => (lines.length > 1 ? lines.slice(1).join('-') : '1');

const halfSpan = (size) => {
  const g = PITCH_GEOMETRY;
  if (size <= 1) return 0;
  return Math.min(g.maxHalfSpan, g.minHalfSpan + g.spanStep * (size - 1));
};

/** Merkezden dışa doğru sıra: 4 kişilik hatta [1, 2, 0, 3] */
const centerOut = (size) =>
  Array.from({ length: size }, (_, i) => i).sort((a, b) => {
    const mid = (size - 1) / 2;
    const d = Math.abs(a - mid) - Math.abs(b - mid);
    return d !== 0 ? d : a - b;
  });

const round = (v) => Math.round(v * 100) / 100;

/**
 * n oyunculuk diziliş. slots doldurma sırasındadır: önce kaleci, sonra hat hat,
 * her hatta merkezden kanatlara.
 * @returns {{ lines: number[], label: string, slots: Array<{ id, line, index, role, depth, across }> }}
 */
export function buildFormation(n) {
  const g = PITCH_GEOMETRY;
  const lines = formationLines(n);
  const roles = lineRoles(lines.length);
  const lastLine = Math.max(lines.length - 1, 1);
  const slots = [];

  lines.forEach((size, line) => {
    const role = roles[line];
    const baseDepth = g.goalDepth + ((g.frontDepth - g.goalDepth) * line) / lastLine;
    const span = halfSpan(size);
    const curve = lineCurve(role, size);
    centerOut(size).forEach((index) => {
      const u = size > 1 ? (index - (size - 1) / 2) / ((size - 1) / 2) : 0; // -1..1
      slots.push({
        id: `${line}-${index}`,
        line,
        index,
        role,
        depth: round(baseDepth + curve * u * u),
        across: round(50 + span * u),
      });
    });
  });

  return { lines, label: formationLabel(lines), slots };
}
