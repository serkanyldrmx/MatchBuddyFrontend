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

// Backend NotificationType enum'u ile eşleşir
export const NOTIFICATION_TYPES = {
  0: { label: 'Mesaj', icon: <MessageOutlined />, color: '#38bdf8', bg: 'rgba(56,189,248,0.14)' },
  1: { label: 'Maça katılım', icon: <UserAddOutlined />, color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  2: { label: 'Maç onayı', icon: <CheckCircleOutlined />, color: '#22c55e', bg: 'rgba(34,197,94,0.14)' },
  3: { label: 'Maç reddi', icon: <CloseCircleOutlined />, color: '#f43f5e', bg: 'rgba(244,63,94,0.14)' },
  4: { label: 'Yeni halı saha', icon: <EnvironmentOutlined />, color: '#c6f432', bg: 'rgba(198,244,50,0.12)' },
  5: { label: 'Yeni maç', icon: <TrophyOutlined />, color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  6: { label: 'Maç hatırlatma', icon: <BellOutlined />, color: '#c6f432', bg: 'rgba(198,244,50,0.14)' },
  7: { label: 'Kadroya girdin', icon: <UserAddOutlined />, color: '#22c55e', bg: 'rgba(34,197,94,0.14)' },
  8: { label: 'Maç sonucu', icon: <TrophyOutlined />, color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  default: { label: 'Bildirim', icon: <NotificationOutlined />, color: '#94a3b8', bg: 'rgba(148,163,184,0.14)' },
};
