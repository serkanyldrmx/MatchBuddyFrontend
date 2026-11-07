import React, { useState } from 'react';
import dayjs from 'dayjs';
import { App, Button, Divider, Drawer, Space, Tag, Typography } from 'antd';
import { CheckOutlined, ClockCircleOutlined, CloseOutlined, MessageOutlined, PhoneOutlined, SyncOutlined, VideoCameraOutlined, WarningOutlined } from '@ant-design/icons';
import { Trans, useTranslation } from 'react-i18next';
import { formatPrice } from '../api/venues';
import { useMessages } from '../messaging/MessagesContext';
import { matchesApi } from '../api/matches';
import { CapacityRing, MatchStatusTag, PlayerAvatar, ReliabilityBadge } from '../ui';
import { apiErrorMessage, formatDateTime, fullName } from '../utils/format';
import { WriteButton, isPastStart } from './shared';

const { Text } = Typography;

/**
 * Kurucunun güvenilirliği (docs/venue-growth-api.md): işletme onaylamadan önce son dakika iptal / gelmeme geçmişini görür.
 */
function OrganizerReliability({ value }) {
  const { t } = useTranslation();
  if (!value) return null;
  const risky = value.lateCancels + value.noShows + value.organizerLateCancels > 0 || value.level === 'risky';
  return (
    <div className={`mb-owner-reliability${risky ? ' is-risky' : ''}`}>
      <div className="mb-owner-reliability__head">
        <ReliabilityBadge reliability={value} />
        <span>{risky ? <><WarningOutlined /> {t('owner:reliability.watch')}</> : t('owner:reliability.ok')}</span>
      </div>
      <ul>
        <li>{t('owner:reliability.asPlayer', { late: value.lateCancels, noShow: value.noShows })}</li>
        <li>{t('owner:reliability.asOrganizer', { count: value.pastReservations, late: value.organizerLateCancels })}</li>
      </ul>
    </div>
  );
}

/** Rezervasyon detayı (ReservationDto) — takvim, talepler ve genel bakışta ortak */
export default function ReservationDrawer({ open, reservation: r, onClose, responder, loading }) {
  const { openMessages } = useMessages();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [stopped, setStopped] = useState(null);
  if (!r) return <Drawer open={open} onClose={onClose} width={440} />;
  const repeating = r.repeatWeekly && stopped !== r.matchId;
  const stopRepeat = async () => {
    try {
      const res = await matchesApi.stopRepeat(r.matchId);
      message.success(res?.message || t('owner:reservations.drawer.repeatStopped'));
      setStopped(r.matchId);
    } catch (e) {
      message.error(apiErrorMessage(e));
    }
  };

  const start = dayjs(r.start);
  const end = r.end ? dayjs(r.end) : start.add(r.durationMinutes || 60, 'minute');
  const past = isPastStart(r);
  const canRespond = r.status === 1 && !past && responder;
  const busy = responder?.busy?.matchId === r.matchId ? responder.busy : null;
  const creator = r.creator;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={460}
      title={t('owner:reservations.drawer.title')}
      loading={loading}
      footer={
        canRespond ? (
          <div className="mb-owner-drawer-actions">
            <WriteButton danger icon={<CloseOutlined />} onClick={() => responder.reject(r)} loading={busy?.approve === false}>
              {t('common:actions.reject')}
            </WriteButton>
            <WriteButton type="primary" icon={<CheckOutlined />} onClick={() => responder.approve(r)} loading={busy?.approve === true}>
              {t('common:actions.confirm')}
            </WriteButton>
          </div>
        ) : null
      }
    >
      <div className="mb-owner-res-hero mb-pitch-bg">
        <div className="mb-owner-res-hero__top">
          <MatchStatusTag status={r.status} past={past} />
          {repeating && (
            <Tag color="green" icon={<SyncOutlined />}>
              {t('owner:reservations.drawer.weekly')}
            </Tag>
          )}
          {r.pitch?.name && <span className="mb-owner-res-hero__pitch">{r.pitch.name}</span>}
        </div>
        <div className="mb-owner-res-hero__title">{r.matchName || t('owner:reservations.drawer.match')}</div>
        <div className="mb-owner-res-hero__time">
          <ClockCircleOutlined /> {start.format('DD MMMM dddd')} · {start.format('HH:mm')}–{end.format('HH:mm')}
          {r.durationMinutes ? ` ${t('owner:reservations.drawer.duration', { count: r.durationMinutes })}` : ''}
        </div>
        {(r.homeTeam || r.awayTeam) && (
          <div className="mb-owner-res-teams">
            <div className="mb-owner-res-teams__side is-home">
              <span>{t('owner:reservations.drawer.home')}</span>
              <strong>{r.homeTeam?.teamName || t('owner:reservations.drawer.mixedSquad')}</strong>
            </div>
            <div className="mb-owner-res-teams__vs">{t('owner:reservations.drawer.vs')}</div>
            <div className="mb-owner-res-teams__side is-away">
              <span>{t('owner:reservations.drawer.away')}</span>
              <strong>{r.awayTeam?.teamName || t('owner:reservations.drawer.undetermined')}</strong>
            </div>
          </div>
        )}
      </div>

      {r.status === 3 && r.rejectReason && (
        <div className="mb-owner-note is-danger">
          <Trans i18nKey="owner:reservations.drawer.rejectReason" values={{ reason: r.rejectReason }} components={{ b: <strong /> }} />
        </div>
      )}

      <Divider orientation="left" plain>
        {t('owner:reservations.table.creator')}
      </Divider>
      {creator ? (
        <div className="mb-owner-person">
          <PlayerAvatar player={creator} size={48} />
          <div className="mb-owner-person__text">
            <Text strong>{fullName(creator)}</Text>
            {creator.userName && <Text type="secondary">@{creator.userName}</Text>}
            {creator.phoneNumber && (
              <a href={`tel:${creator.phoneNumber}`} className="mb-owner-phone">
                <PhoneOutlined /> {creator.phoneNumber}
              </a>
            )}
          </div>
          <Button
            icon={<MessageOutlined />}
            onClick={() => {
              onClose?.();
              openMessages({ type: 'user', data: creator });
            }}
          >
            {t('owner:reservations.sendMessage')}
          </Button>
        </div>
      ) : (
        <Text type="secondary">{t('owner:reservations.drawer.noCreator')}</Text>
      )}
      <OrganizerReliability value={r.creatorReliability} />
      {repeating && (
        <div className="mb-owner-note">
          {t('owner:reservations.drawer.weeklyInfo')}{' '}
          <WriteButton size="small" onClick={stopRepeat}>
            {t('owner:reservations.drawer.stopRepeat')}
          </WriteButton>
        </div>
      )}

      <Divider orientation="left" plain>
        {t('owner:reservations.drawer.squadExtras')}
      </Divider>
      <div className="mb-owner-res-grid">
        <CapacityRing going={r.goingCount || 0} capacity={r.capacity || 0} />
        <div className="mb-owner-res-extras">
          <span className={r.cleatCount ? 'is-on' : ''}>
            {r.cleatCount
              ? t('owner:reservations.drawer.cleats', { count: r.cleatCount })
              : t('owner:reservations.drawer.noCleats')}
          </span>
          <span className={r.cameraRequested ? 'is-on' : ''}>
            <VideoCameraOutlined />{' '}
            {r.cameraRequested ? t('owner:reservations.drawer.cameraRequested') : t('owner:reservations.drawer.noCamera')}
          </span>
        </div>
      </div>

      <Divider orientation="left" plain>
        {t('owner:reservations.table.fee')}
      </Divider>
      <div className="mb-owner-receipt">
        {r.pitchPrice != null && (
          <div>
            <span>{t('owner:reservations.drawer.pitchFee')}</span>
            <span>{formatPrice(r.pitchPrice)}</span>
          </div>
        )}
        {r.extrasPrice != null && (
          <div>
            <span>{t('owner:reservations.table.extras')}</span>
            <span>{formatPrice(r.extrasPrice)}</span>
          </div>
        )}
        <div className="is-total">
          <span>{t('owner:reservations.drawer.total')}</span>
          <span>{formatPrice(r.totalPrice)}</span>
        </div>
        {r.totalPrice != null && r.capacity ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('owner:reservations.drawer.perPerson', { amount: formatPrice(Math.ceil(r.totalPrice / r.capacity)) })}
          </Text>
        ) : null}
      </div>

      {r.createdAt && (
        <Space style={{ marginTop: 20 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('owner:reservations.drawer.requestDate', { date: formatDateTime(r.createdAt) })}
          </Text>
        </Space>
      )}
      {r.status === 1 && past && (
        <div className="mb-owner-note">{t('owner:reservations.drawer.expiredNote')}</div>
      )}
    </Drawer>
  );
}
