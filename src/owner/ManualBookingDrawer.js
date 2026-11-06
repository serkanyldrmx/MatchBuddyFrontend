import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { App, Divider, Drawer, Popconfirm, Switch, Typography } from 'antd';
import { ClockCircleOutlined, DeleteOutlined, EditOutlined, PhoneOutlined } from '@ant-design/icons';
import { formatPrice, ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { apiErrorMessage, formatDateTime } from '../utils/format';
import { InactiveTip, WriteButton, notifyOwnerChanged, useBlockPaidToggle } from './shared';

const { Text } = Typography;

/**
 * Harici rezervasyon (blok kind 1) detayı.
 * booking: normalizeBlock çıktısı. onEdit verilmezse "Düzenle" gizlenir.
 * onChanged(updated | null): ödeme durumu değişince güncel kayıt, silinince null.
 */
export default function ManualBookingDrawer({ open, booking: b, onClose, onEdit, onChanged }) {
  const { message } = App.useApp();
  const { membershipActive } = useOwnerVenue();
  const [isPaid, setIsPaid] = useState(Boolean(b?.isPaid));
  const [deleting, setDeleting] = useState(false);
  const paid = useBlockPaidToggle();

  useEffect(() => setIsPaid(Boolean(b?.isPaid)), [b]);

  if (!b) return <Drawer open={open} onClose={onClose} width={440} />;

  const start = dayjs(b.start);
  const end = dayjs(b.end);
  const mins = end.diff(start, 'minute');
  const finished = !end.isAfter(dayjs());

  const togglePaid = async (v) => {
    const ok = await paid.toggle(b.slotBlockId, v);
    if (ok) {
      setIsPaid(v);
      onChanged?.({ ...b, isPaid: v });
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await ownerApi.deleteBlock(b.slotBlockId);
      message.success('Harici rezervasyon silindi; saat yeniden rezervasyona açıldı.');
      notifyOwnerChanged();
      onChanged?.(null);
      onClose?.();
    } catch (e) {
      message.error(apiErrorMessage(e, 'Rezervasyon silinemedi.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={440}
      title="Harici rezervasyon"
      footer={
        <div className="mb-owner-drawer-actions">
          <Popconfirm
            title="Rezervasyonu sil"
            description="Bu kayıt silinecek ve saat yeniden rezervasyona açılacak. Emin misiniz?"
            okText="Sil"
            cancelText="Vazgeç"
            okButtonProps={{ danger: true, loading: deleting }}
            onConfirm={remove}
            disabled={!membershipActive}
          >
            <WriteButton danger icon={<DeleteOutlined />} loading={deleting}>
              Sil
            </WriteButton>
          </Popconfirm>
          {onEdit && (
            <WriteButton type="primary" icon={<EditOutlined />} onClick={() => onEdit({ ...b, isPaid })}>
              Düzenle
            </WriteButton>
          )}
        </div>
      }
    >
      <div className="mb-mbk-hero">
        <div className="mb-mbk-hero__top">
          <span className="mb-mbk-tag">Harici</span>
          {b.pitchName && <span className="mb-owner-res-hero__pitch">{b.pitchName}</span>}
        </div>
        <div className="mb-mbk-hero__title">{b.customerName || 'Müşteri'}</div>
        {b.reason && <div className="mb-mbk-hero__sub">{b.reason}</div>}
        <div className="mb-owner-res-hero__time">
          <ClockCircleOutlined /> {start.format('DD MMMM dddd')} · {start.format('HH:mm')}–{end.format('HH:mm')} ({mins} dk)
        </div>
      </div>

      <Divider orientation="left" plain>
        Müşteri
      </Divider>
      <div className="mb-mbk-contact">
        <Text strong>{b.customerName || '-'}</Text>
        {b.customerPhone ? (
          <a href={`tel:${b.customerPhone}`} className="mb-mbk-call">
            <PhoneOutlined /> {b.customerPhone}
          </a>
        ) : (
          <Text type="secondary">Telefon girilmemiş</Text>
        )}
      </div>

      <Divider orientation="left" plain>
        Ücret ve ödeme
      </Divider>
      <div className={`mb-mbk-pay${isPaid ? ' is-paid' : ''}`}>
        <div>
          <span className="mb-mbk-pay__label">Ücret</span>
          <span className="mb-mbk-pay__amount">{formatPrice(b.price)}</span>
        </div>
        <div className="mb-mbk-pay__switch">
          <span>{isPaid ? 'Ödeme alındı' : 'Ödeme alınmadı'}</span>
          <InactiveTip>
            <Switch checked={isPaid} onChange={togglePaid} loading={paid.busyId === b.slotBlockId} disabled={!membershipActive} />
          </InactiveTip>
        </div>
      </div>
      {!isPaid && finished && (
        <div className="mb-owner-note">Bu rezervasyon oynandı ancak ödemesi henüz alınmadı; “Tahsil edilmemiş” tutarında görünür.</div>
      )}

      {b.note && (
        <>
          <Divider orientation="left" plain>
            Not
          </Divider>
          <Text>{b.note}</Text>
        </>
      )}
      {b.createdAt && (
        <div style={{ marginTop: 20 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Eklenme: {formatDateTime(b.createdAt)}
          </Text>
        </div>
      )}
    </Drawer>
  );
}
