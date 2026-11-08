import React from 'react';
import {
  BellOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EnvironmentOutlined,
  MessageOutlined,
  NotificationOutlined,
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

// Backend NotificationType enum'u ile eşleşir
export const NOTIFICATION_TYPES = {
  // Renkler CSS değişkenleri (App.css): açık/koyu temaya göre değişir
  0: type('message', { icon: <MessageOutlined />, color: 'var(--mb-info)', bg: 'rgba(var(--mb-info-rgb), 0.14)' }),
  1: type('matchJoin', { icon: <UserAddOutlined />, color: 'var(--mb-violet)', bg: 'rgba(var(--mb-violet-rgb), 0.14)' }),
  2: type('matchApproved', { icon: <CheckCircleOutlined />, color: 'var(--mb-pitch)', bg: 'rgba(var(--mb-pitch-rgb), 0.14)' }),
  3: type('matchRejected', { icon: <CloseCircleOutlined />, color: 'var(--mb-danger)', bg: 'rgba(var(--mb-danger-rgb), 0.14)' }),
  4: type('newVenue', { icon: <EnvironmentOutlined />, color: 'var(--mb-primary)', bg: 'rgba(var(--mb-primary-rgb), 0.12)' }),
  5: type('newMatch', { icon: <TrophyOutlined />, color: 'var(--mb-gold)', bg: 'rgba(var(--mb-gold-rgb), 0.14)' }),
  6: type('matchReminder', { icon: <BellOutlined />, color: 'var(--mb-primary)', bg: 'rgba(var(--mb-primary-rgb), 0.14)' }),
  7: type('addedToSquad', { icon: <UserAddOutlined />, color: 'var(--mb-pitch)', bg: 'rgba(var(--mb-pitch-rgb), 0.14)' }),
  8: type('matchResult', { icon: <TrophyOutlined />, color: 'var(--mb-gold)', bg: 'rgba(var(--mb-gold-rgb), 0.14)' }),
  default: type('default', { icon: <NotificationOutlined />, color: 'var(--mb-text-2)', bg: 'rgba(var(--mb-slate-rgb), 0.14)' }),
};
