import React, { useCallback, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { App, Button, Input, Modal, Space, Tag, Tooltip, Typography } from 'antd';
import { OWNER_DATA_CHANGED, useOwnerVenue } from '../layout/VenueLayout';
import { ownerApi } from '../api/venues';
import { apiErrorMessage } from '../utils/format';
import './owner.css';

const { Text } = Typography;

/* ---------- Ortak yardımcılar (işletme paneli) ---------- */

export const notifyOwnerChanged = () => window.dispatchEvent(new Event(OWNER_DATA_CHANGED));

export const INACTIVE_TIP = 'Üyeliğiniz aktif olmadığı için değişiklik yapamazsınız.';

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
        if (id === seq.current) setState((s) => ({ ...s, loading: false, error: apiErrorMessage(e, 'Veriler yüklenemedi.') }));
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
  if (!membershipActive) return <Tooltip title={INACTIVE_TIP}>{btn}</Tooltip>;
  return tooltip ? <Tooltip title={tooltip}>{btn}</Tooltip> : btn;
});

const QUICK_REASONS = ['Bu saat dolu', 'Tesis bakımda', 'Saha o saatte kapalı', 'Talep bilgileri eksik'];

/**
 * Rezervasyon onay/red akışı.
 * const { approve, reject, busy, modal } = useReservationResponder(onDone)
 * modal öğesi sayfada render edilmelidir.
 */
export function useReservationResponder(onDone) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(null); // { matchId, approve }
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const respond = async (r, approve, why) => {
    setBusy({ matchId: r.matchId, approve });
    try {
      await ownerApi.respond(r.matchId, approve, why || undefined);
      message.success(approve ? 'Rezervasyon onaylandı. Oyunculara bildirim gönderildi.' : 'Talep reddedildi. Oyunculara bildirim gönderildi.');
      notifyOwnerChanged();
      setRejecting(null);
      onDone?.(r, approve);
    } catch (e) {
      message.error(apiErrorMessage(e, 'İşlem tamamlanamadı.'));
    } finally {
      setBusy(null);
    }
  };

  const modal = (
    <Modal
      open={Boolean(rejecting)}
      title="Talebi reddet"
      okText="Reddet"
      cancelText="Vazgeç"
      okButtonProps={{ danger: true, disabled: !reason.trim(), loading: busy?.approve === false }}
      onOk={() => respond(rejecting, false, reason.trim())}
      onCancel={() => setRejecting(null)}
      destroyOnClose
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Text type="secondary">
          <Text strong>{rejecting?.matchName}</Text> talebini reddetmek üzeresiniz. Lütfen oyunculara iletilecek kısa bir açıklama yazın.
        </Text>
        <Space size={[6, 6]} wrap>
          {QUICK_REASONS.map((q) => (
            <Tag key={q} className="mb-owner-quick-tag" onClick={() => setReason(q)}>
              {q}
            </Tag>
          ))}
        </Space>
        <Input.TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          showCount
          rows={3}
          placeholder="Örn. Seçtiğiniz saatte sahamız bakımda olacak, başka bir saat önerebiliriz."
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
  [r?.cleatCount ? `Krampon ×${r.cleatCount}` : null, r?.cameraRequested ? 'Kamera' : null].filter(Boolean).join(' · ');

export const isPastStart = (r) => dayjs(r?.start).isBefore(dayjs());
