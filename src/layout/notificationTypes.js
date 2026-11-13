import React from 'react';
import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FireOutlined,
  MailOutlined,
  MessageOutlined,
  NotificationOutlined,
  StarOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import i18n from '../i18n';

// label erişildiği anda (render sırasında) çevrilir
const type = (key, rest) => ({
  ...rest,
  get label() {
    return i18n.t(`notifications:types.${key}`);
  },
});

const tone = (name) => ({ color: `var(--mb-${name})`, bg: `rgba(var(--mb-${name}-rgb), 0.14)` });

// Backend NotificationType enum'u ile eşleşir
export const NOTIFICATION_TYPES = {
  // Renkler CSS değişkenleri (App.css): açık/koyu temaya göre değişir
  0: type('message', { icon: <MessageOutlined />, ...tone('info') }),
  1: type('matchJoin', { icon: <UserAddOutlined />, ...tone('violet') }),
  2: type('matchApproved', { icon: <CheckCircleOutlined />, ...tone('pitch') }),
  3: type('matchRejected', { icon: <CloseCircleOutlined />, ...tone('danger') }),
  4: type('newVenue', { icon: <EnvironmentOutlined />, color: 'var(--mb-primary)', bg: 'rgba(var(--mb-primary-rgb), 0.12)' }),
  5: type('newMatch', { icon: <TrophyOutlined />, ...tone('gold') }),
  6: type('matchReminder', { icon: <BellOutlined />, ...tone('primary') }),
  7: type('addedToSquad', { icon: <UserAddOutlined />, ...tone('pitch') }),
  8: type('matchResult', { icon: <TrophyOutlined />, ...tone('gold') }),
  9: type('newFollower', { icon: <UserAddOutlined />, ...tone('info') }),
  10: type('matchInvite', { icon: <MailOutlined />, ...tone('violet') }),
  11: type('teamInvite', { icon: <TeamOutlined />, ...tone('violet') }),
  12: type('tournament', { icon: <TrophyOutlined />, ...tone('gold') }),
  13: type('reservationRequest', { icon: <CalendarOutlined />, ...tone('primary') }),
  14: type('venueReview', { icon: <StarOutlined />, ...tone('gold') }),
  15: type('slotDeal', { icon: <FireOutlined />, ...tone('danger') }),
  16: type('matchUpdated', { icon: <EditOutlined />, ...tone('info') }),
  default: type('default', { icon: <NotificationOutlined />, color: 'var(--mb-text-2)', bg: 'rgba(var(--mb-slate-rgb), 0.14)' }),
};

const CANCELLED = type('matchCancelled', { icon: <CloseCircleOutlined />, ...tone('danger') });

export const notificationType = (n) => {
  const x = n?.notification;
  // Silinen maçın bildirimi maça bağlı değildir (matchId yok): "reddedildi" değil "iptal edildi"
  if (x?.type === 3 && !x.matchId) return CANCELLED;
  return NOTIFICATION_TYPES[x?.type] || NOTIFICATION_TYPES.default;
};

/**
 * Bildirime dokununca açılacak sayfa. Sunucu `url` döndürür (push ile aynı kural);
 * eski yanıtlar için istemcide aynı kural yedek olarak uygulanır. null = gidilecek yer yok.
 */
export function notificationLink(n) {
  if (n?.url && n.url !== '/NotificationList') return n.url;
  const x = n?.notification || {};
  switch (x.type) {
    case 0:
      return '/home?messages=1';
    case 4:
    case 15:
      return x.stadiumId ? `/venues/${x.stadiumId}` : '/venues';
    case 9:
      return '/friends';
    case 10:
    case 11:
      return '/invites';
    case 12:
      return '/tournaments';
    case 13:
      return '/venue/reservations';
    case 14:
      return '/venue/reviews';
    default:
      return x.matchId ? `/match-details/${x.matchId}` : null;
  }
}
