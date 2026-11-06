import React from 'react';
import dayjs from 'dayjs';
import { Button, Divider, Drawer, Space, Typography } from 'antd';
import { CheckOutlined, ClockCircleOutlined, CloseOutlined, MessageOutlined, PhoneOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { formatPrice } from '../api/venues';
import { useMessages } from '../messaging/MessagesContext';
import { CapacityRing, MatchStatusTag, PlayerAvatar } from '../ui';
import { formatDateTime, fullName } from '../utils/format';
import { WriteButton, isPastStart } from './shared';

const { Text } = Typography;

/** Rezervasyon detayı (ReservationDto) — takvim, talepler ve genel bakışta ortak */
export default function ReservationDrawer({ open, reservation: r, onClose, responder, loading }) {
  const { openMessages } = useMessages();
  if (!r) return <Drawer open={open} onClose={onClose} width={440} />;

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
      title="Rezervasyon detayı"
      loading={loading}
      footer={
        canRespond ? (
          <div className="mb-owner-drawer-actions">
            <WriteButton danger icon={<CloseOutlined />} onClick={() => responder.reject(r)} loading={busy?.approve === false}>
              Reddet
            </WriteButton>
            <WriteButton type="primary" icon={<CheckOutlined />} onClick={() => responder.approve(r)} loading={busy?.approve === true}>
              Onayla
            </WriteButton>
          </div>
        ) : null
      }
    >
      <div className="mb-owner-res-hero mb-pitch-bg">
        <div className="mb-owner-res-hero__top">
          <MatchStatusTag status={r.status} past={past} />
          {r.pitch?.name && <span className="mb-owner-res-hero__pitch">{r.pitch.name}</span>}
        </div>
        <div className="mb-owner-res-hero__title">{r.matchName || 'Maç'}</div>
        <div className="mb-owner-res-hero__time">
          <ClockCircleOutlined /> {start.format('DD MMMM dddd')} · {start.format('HH:mm')}–{end.format('HH:mm')}
          {r.durationMinutes ? ` (${r.durationMinutes} dk)` : ''}
        </div>
        {(r.homeTeam || r.awayTeam) && (
          <div className="mb-owner-res-teams">
            <div className="mb-owner-res-teams__side is-home">
              <span>Ev sahibi</span>
              <strong>{r.homeTeam?.teamName || 'Karma kadro'}</strong>
            </div>
            <div className="mb-owner-res-teams__vs">VS</div>
            <div className="mb-owner-res-teams__side is-away">
              <span>Rakip</span>
              <strong>{r.awayTeam?.teamName || 'Belirlenmedi'}</strong>
            </div>
          </div>
        )}
      </div>

      {r.status === 3 && r.rejectReason && (
        <div className="mb-owner-note is-danger">
          <strong>Red sebebi:</strong> {r.rejectReason}
        </div>
      )}

      <Divider orientation="left" plain>
        Kurucu
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
            Mesaj gönder
          </Button>
        </div>
      ) : (
        <Text type="secondary">Kurucu bilgisi bulunamadı.</Text>
      )}

      <Divider orientation="left" plain>
        Kadro ve ekstralar
      </Divider>
      <div className="mb-owner-res-grid">
        <CapacityRing going={r.goingCount || 0} capacity={r.capacity || 0} />
        <div className="mb-owner-res-extras">
          <span className={r.cleatCount ? 'is-on' : ''}>Krampon {r.cleatCount ? `×${r.cleatCount}` : 'yok'}</span>
          <span className={r.cameraRequested ? 'is-on' : ''}>
            <VideoCameraOutlined /> Kamera {r.cameraRequested ? 'istendi' : 'yok'}
          </span>
        </div>
      </div>

      <Divider orientation="left" plain>
        Ücret
      </Divider>
      <div className="mb-owner-receipt">
        {r.pitchPrice != null && (
          <div>
            <span>Saha ücreti</span>
            <span>{formatPrice(r.pitchPrice)}</span>
          </div>
        )}
        {r.extrasPrice != null && (
          <div>
            <span>Ekstralar</span>
            <span>{formatPrice(r.extrasPrice)}</span>
          </div>
        )}
        <div className="is-total">
          <span>Toplam</span>
          <span>{formatPrice(r.totalPrice)}</span>
        </div>
        {r.totalPrice != null && r.capacity ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Kişi başı yaklaşık {formatPrice(Math.ceil(r.totalPrice / r.capacity))}
          </Text>
        ) : null}
      </div>

      {r.createdAt && (
        <Space style={{ marginTop: 20 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Talep tarihi: {formatDateTime(r.createdAt)}
          </Text>
        </Space>
      )}
      {r.status === 1 && past && (
        <div className="mb-owner-note">Bu talebin saati geçti; artık yanıtlanamaz.</div>
      )}
    </Drawer>
  );
}
