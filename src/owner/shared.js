import React, { useCallback, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { App, Button, Input, Modal, Space, Tag, Tooltip, Typography } from 'antd';
import { Trans, useTranslation } from 'react-i18next';
import { OWNER_DATA_CHANGED, useOwnerVenue } from '../layout/VenueLayout';
import { BLOCK_KIND, ownerApi } from '../api/venues';
import { apiErrorMessage } from '../utils/format';
import i18n from '../i18n';
import './owner.css';

const { Text } = Typography;

/* ---------- Ortak yardımcılar (işletme paneli) ---------- */

export const notifyOwnerChanged = () => window.dispatchEvent(new Event(OWNER_DATA_CHANGED));

/** Üyelik pasifken gösterilen açıklama (render sırasında çağırın) */
export const inactiveTip = () => i18n.t('owner:shared.inactiveTip');

/**
 * Geriye dönük uyumluluk için metin sabiti: canlı bağlama (live binding) olarak dil değişince güncellenir.
 * Yeni kodda inactiveTip() tercih edin.
 */
// eslint-disable-next-line import/no-mutable-exports
export let INACTIVE_TIP = inactiveTip();
i18n.on('languageChanged', () => {
  INACTIVE_TIP = inactiveTip();
});

/** Yanıt bir dizi değilse, verilen anahtarlardaki ilk diziyi döndürür */
export const asList = (res, ...keys) => {
  if (Array.isArray(res)) return res;
  for (const k of keys) if (Array.isArray(res?.[k])) return res[k];
  return [];
};

/** "09:00" / "09:00:00" → dakika */
export const hmToMinutes = (v) => {
  if (!v) return 0;
  const [h, m] = String(v).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const minutesToHm = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const hourLabel = (h) => `${String(h % 24).padStart(2, '0')}:00`;
export const hourRange = (from, to) => `${hourLabel(from)}–${to === 24 ? '24:00' : hourLabel(to)}`;

/** Haftanın pazartesisi (00:00) */
export const weekStart = (d) => {
  const day = dayjs(d).startOf('day');
  return day.subtract((day.day() + 6) % 7, 'day');
};
export const ymd = (d) => dayjs(d).format('YYYY-MM-DD');
export const isoLocal = (d) => dayjs(d).format('YYYY-MM-DDTHH:mm:ss');

/**
 * Açılış saatlerini 7 elemanlı diziye çevirir (0 = Pazartesi).
 * Her gün için açık aralık dakika cinsinden: [open, close) — kapanış açılıştan küçük/eşitse ertesi güne taşar.
 */
export const normalizeHours = (list) => {
  const arr = Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i, isClosed: false, openTime: '09:00', closeTime: '00:00' }));
  (list || []).forEach((h) => {
    if (h && h.dayOfWeek >= 0 && h.dayOfWeek <= 6) {
      arr[h.dayOfWeek] = {
        ...arr[h.dayOfWeek],
        ...h,
        openTime: String(h.openTime || '09:00').slice(0, 5),
        closeTime: String(h.closeTime || '00:00').slice(0, 5),
      };
    }
  });
  return arr.map((h) => {
    const open = hmToMinutes(h.openTime);
    let close = hmToMinutes(h.closeTime);
    if (close <= open) close += 1440;
    return { ...h, open, close };
  });
};

/** Bir saatin efektif fiyatı: sahaya özel kural > genel kural > taban fiyat (kampanyasız) */
export const effectivePrice = (pitch, rules, dayIdx, hour) => {
  const covers = (r) => r.daysMask & (1 << dayIdx) && hour >= r.fromHour && hour < r.toHour;
  const specific = rules.find((r) => r.pitchId != null && r.pitchId === pitch?.pitchId && covers(r));
  if (specific) return { price: Number(specific.pricePerHour), rule: specific };
  const general = rules.find((r) => r.pitchId == null && covers(r));
  if (general) return { price: Number(general.pricePerHour), rule: general };
  return { price: Number(pitch?.basePrice || 0), rule: null };
};

/** Seçili tesis için veri yükleyici: { data, loading, error, reload, setData } */
export function useOwnerData(loader, deps = []) {
  const { venueId } = useOwnerVenue();
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const seq = useRef(0);

  const reload = useCallback(
    async (silent) => {
      if (!venueId) return;
      const id = ++seq.current;
      if (!silent) setState((s) => ({ ...s, loading: true }));
      try {
        const data = await loaderRef.current(venueId);
        if (id === seq.current) setState({ data, loading: false, error: null });
      } catch (e) {
        if (id === seq.current) setState((s) => ({ ...s, loading: false, error: apiErrorMessage(e, i18n.t('owner:shared.loadFailed')) }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [venueId, ...deps]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const setData = useCallback((fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })), []);
  return { ...state, reload, setData, venueId };
}

/** Üyelik aktif değilse devre dışı kalan ve açıklama gösteren buton */
export const WriteButton = React.forwardRef(function WriteButton({ tooltip, children, disabled, ...rest }, ref) {
  const { membershipActive } = useOwnerVenue();
  const btn = (
    <Button ref={ref} disabled={disabled || !membershipActive} {...rest}>
      {children}
    </Button>
  );
  if (!membershipActive) return <Tooltip title={inactiveTip()}>{btn}</Tooltip>;
  return tooltip ? <Tooltip title={tooltip}>{btn}</Tooltip> : btn;
});

const QUICK_REASON_KEYS = ['slotTaken', 'maintenance', 'pitchClosed', 'missingInfo'];

/**
 * Rezervasyon onay/red akışı.
 * const { approve, reject, busy, modal } = useReservationResponder(onDone)
 * modal öğesi sayfada render edilmelidir.
 */
export function useReservationResponder(onDone) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(null); // { matchId, approve }
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const respond = async (r, approve, why) => {
    setBusy({ matchId: r.matchId, approve });
    try {
      await ownerApi.respond(r.matchId, approve, why || undefined);
      message.success(approve ? t('owner:shared.respond.approved') : t('owner:shared.respond.rejected'));
      notifyOwnerChanged();
      setRejecting(null);
      onDone?.(r, approve);
    } catch (e) {
      message.error(apiErrorMessage(e, t('owner:shared.respond.failed')));
    } finally {
      setBusy(null);
    }
  };

  const modal = (
    <Modal
      open={Boolean(rejecting)}
      title={t('owner:shared.respond.rejectTitle')}
      okText={t('common:actions.reject')}
      cancelText={t('common:actions.cancel')}
      okButtonProps={{ danger: true, disabled: !reason.trim(), loading: busy?.approve === false }}
      onOk={() => respond(rejecting, false, reason.trim())}
      onCancel={() => setRejecting(null)}
      destroyOnClose
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Text type="secondary">
          <Trans
            i18nKey="owner:shared.respond.rejectIntro"
            values={{ name: rejecting?.matchName ?? '' }}
            components={{ b: <Text strong /> }}
          />
        </Text>
        <Space size={[6, 6]} wrap>
          {QUICK_REASON_KEYS.map((k) => {
            const q = t(`owner:shared.respond.quickReasons.${k}`);
            return (
              <Tag key={k} className="mb-owner-quick-tag" onClick={() => setReason(q)}>
                {q}
              </Tag>
            );
          })}
        </Space>
        <Input.TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          showCount
          rows={3}
          placeholder={t('owner:shared.respond.reasonPlaceholder')}
          autoFocus
        />
      </Space>
    </Modal>
  );

  return {
    approve: (r) => respond(r, true),
    reject: (r) => {
      setReason('');
      setRejecting(r);
    },
    busy,
    modal,
  };
}

/** Yıldızlı puan gösterimi (salt okunur, küçük) */
export function Stars({ value = 0, size = 14 }) {
  return (
    <span className="mb-owner-stars" style={{ fontSize: size }} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(value) ? 'is-on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

/** Ekstralar özeti: "Krampon ×2 · Kamera" */
export const extrasText = (r) =>
  [
    r?.cleatCount ? i18n.t('owner:shared.extras.cleats', { count: r.cleatCount }) : null,
    r?.cameraRequested ? i18n.t('owner:shared.extras.camera') : null,
  ]
    .filter(Boolean)
    .join(' · ');

export const isPastStart = (r) => dayjs(r?.start).isBefore(dayjs());

/* ---------- Bloklar / harici rezervasyon ---------- */

/** Takvim öğesi bir maç mı? (Calendar öğelerinde kind: "match" | "block") */
export const isMatchItem = (it) => it?.kind === 'match' || (it?.matchId != null && it?.slotBlockId == null);

/**
 * Blok türü (0 = kapalı, 1 = harici rezervasyon).
 * Blocks uç noktası sayısal `kind` döner; Calendar öğelerinde `kind` "block" olduğundan
 * `blockKind` alanı ya da müşteri adı üzerinden çıkarım yapılır.
 */
export const blockKindOf = (b) => {
  if (b?.blockKind != null) return Number(b.blockKind);
  if (typeof b?.kind === 'number') return b.kind;
  if (b?.kind != null && /^\d+$/.test(String(b.kind))) return Number(b.kind);
  return b?.customerName ? BLOCK_KIND.MANUAL_BOOKING : BLOCK_KIND.CLOSED;
};
export const isManualBooking = (b) => blockKindOf(b) === BLOCK_KIND.MANUAL_BOOKING;

/** Blocks / Calendar blok öğesini tek biçime getirir: { start, end, pitchName, blockKind, ... } */
export const normalizeBlock = (b, pitchName) => ({
  ...b,
  start: b.start ?? b.startAt,
  end: b.end ?? b.endAt,
  pitchName: b.pitchName ?? pitchName ?? b.pitch?.name,
  blockKind: blockKindOf(b),
  isPaid: Boolean(b.isPaid),
});

/** Harici rezervasyon ödeme durumunu değiştirir: const { toggle, busyId } = useBlockPaidToggle(onDone) */
export function useBlockPaidToggle(onDone) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [busyId, setBusyId] = useState(null);
  const toggle = async (slotBlockId, isPaid) => {
    setBusyId(slotBlockId);
    try {
      await ownerApi.setBlockPaid(slotBlockId, isPaid);
      message.success(isPaid ? t('owner:shared.paid.markedPaid') : t('owner:shared.paid.markedUnpaid'));
      notifyOwnerChanged();
      onDone?.(slotBlockId, isPaid);
      return true;
    } catch (e) {
      message.error(apiErrorMessage(e, t('owner:shared.paid.failed')));
      return false;
    } finally {
      setBusyId(null);
    }
  };
  return { toggle, busyId };
}

/** Üyelik aktif değilse devre dışı kalan Switch sarmalayıcısı için yardımcı */
export const InactiveTip = ({ children }) => {
  const { membershipActive } = useOwnerVenue();
  return membershipActive ? (
    children
  ) : (
    <Tooltip title={inactiveTip()}>
      <span style={{ display: 'inline-flex' }}>{children}</span>
    </Tooltip>
  );
};
