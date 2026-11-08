import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { App, Divider, Drawer, Popconfirm, Switch, Tag, Typography } from 'antd';
import { ClockCircleOutlined, DeleteOutlined, EditOutlined, PhoneOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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

  const remove = async (allFollowing = false) => {
    setDeleting(true);
    try {
      const res = await ownerApi.deleteBlock(b.slotBlockId, allFollowing);
      message.success(allFollowing ? res?.message || t('owner:booking.drawer.deleted') : t('owner:booking.drawer.deleted'));
      notifyOwnerChanged();
      onChanged?.(null);
      onClose?.();
    } catch (e) {
      message.error(apiErrorMessage(e, t('owner:booking.drawer.deleteFailed')));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={440}
      title={
        <span>
          {t('owner:booking.drawer.title')}{' '}
          {b?.seriesId && <Tag color="green">{t('owner:booking.drawer.weekly')}</Tag>}
        </span>
      }
      footer={
        <div className="mb-owner-drawer-actions">
          <Popconfirm
            title={t('owner:booking.drawer.deleteTitle')}
            description={t('owner:booking.drawer.deleteConfirm')}
            okText={t('common:actions.delete')}
            cancelText={t('common:actions.cancel')}
            okButtonProps={{ danger: true, loading: deleting }}
            onConfirm={() => remove(false)}
            disabled={!membershipActive}
          >
            <WriteButton danger icon={<DeleteOutlined />} loading={deleting}>
              {b.seriesId ? t('owner:booking.drawer.deleteThisWeek') : t('common:actions.delete')}
            </WriteButton>
          </Popconfirm>
          {b.seriesId && (
            <Popconfirm
              title={t('owner:booking.drawer.deleteSeriesTitle')}
              description={t('owner:booking.drawer.deleteSeriesConfirm')}
              okText={t('common:actions.delete')}
              cancelText={t('common:actions.cancel')}
              okButtonProps={{ danger: true, loading: deleting }}
              onConfirm={() => remove(true)}
              disabled={!membershipActive}
            >
              <WriteButton danger loading={deleting}>
                {t('owner:booking.drawer.deleteSeries')}
              </WriteButton>
            </Popconfirm>
          )}
          {onEdit && (
            <WriteButton type="primary" icon={<EditOutlined />} onClick={() => onEdit({ ...b, isPaid })}>
              {t('common:actions.edit')}
            </WriteButton>
          )}
        </div>
      }
    >
      <div className="mb-mbk-hero">
        <div className="mb-mbk-hero__top">
          <span className="mb-mbk-tag">{t('owner:booking.external')}</span>
          {b.pitchName && <span className="mb-owner-res-hero__pitch">{b.pitchName}</span>}
        </div>
        <div className="mb-mbk-hero__title">{b.customerName || t('owner:booking.customer')}</div>
        {b.reason && <div className="mb-mbk-hero__sub">{b.reason}</div>}
        <div className="mb-owner-res-hero__time">
          <ClockCircleOutlined /> {start.format('DD MMMM dddd')} · {start.format('HH:mm')}–{end.format('HH:mm')}{' '}
          {t('owner:booking.duration', { count: mins })}
        </div>
      </div>

      <Divider orientation="left" plain>
        {t('owner:booking.customer')}
      </Divider>
      <div className="mb-mbk-contact">
        <Text strong>{b.customerName || '-'}</Text>
        {b.customerPhone ? (
          <a href={`tel:${b.customerPhone}`} className="mb-mbk-call">
            <PhoneOutlined /> {b.customerPhone}
          </a>
        ) : (
          <Text type="secondary">{t('owner:booking.drawer.noPhone')}</Text>
        )}
      </div>

      <Divider orientation="left" plain>
        {t('owner:booking.drawer.feeAndPayment')}
      </Divider>
      <div className={`mb-mbk-pay${isPaid ? ' is-paid' : ''}`}>
        <div>
          <span className="mb-mbk-pay__label">{t('owner:booking.fee')}</span>
          <span className="mb-mbk-pay__amount">{formatPrice(b.price)}</span>
        </div>
        <div className="mb-mbk-pay__switch">
          <span>{isPaid ? t('owner:booking.paymentReceived') : t('owner:booking.paymentNotReceived')}</span>
          <InactiveTip>
            <Switch checked={isPaid} onChange={togglePaid} loading={paid.busyId === b.slotBlockId} disabled={!membershipActive} />
          </InactiveTip>
        </div>
      </div>
      {!isPaid && finished && (
        <div className="mb-owner-note">{t('owner:booking.drawer.unpaidNote')}</div>
      )}

      {b.note && (
        <>
          <Divider orientation="left" plain>
            {t('owner:booking.drawer.note')}
          </Divider>
          <Text>{b.note}</Text>
        </>
      )}
      {b.createdAt && (
        <div style={{ marginTop: 20 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('owner:booking.drawer.addedAt', { date: formatDateTime(b.createdAt) })}
          </Text>
        </div>
      )}
    </Drawer>
  );
}
