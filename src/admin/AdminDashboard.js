import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, List, Progress, Row, Space, Statistic, Table, Typography } from 'antd';
import {
  AppstoreOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  RightOutlined,
  ScheduleOutlined,
  ShopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { api } from '../api/config';
import { adminVenuesApi } from '../api/venues';
import { colors } from '../theme/theme';
import { EmptyState, MatchStatusTag, MetaItem, PageHeader } from '../ui';
import { formatDate, formatDateTime, formatTime, fromNow, getCurrentUser, isPast } from '../utils/format';
import useAdminData, { venueLabel } from './useAdminData';

const { Text } = Typography;

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

/** Admin genel bakış ekranı */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const { matches, stadiumNames, loading } = useAdminData();
  const [playerCount, setPlayerCount] = useState(null);
  const [owners, setOwners] = useState(null);

  useEffect(() => {
    api
      .get('/api/Players/GetPlayerList')
      .then((r) => setPlayerCount(Array.isArray(r.data) ? r.data.length : null))
      .catch(() => setPlayerCount(null));
    adminVenuesApi
      .owners()
      .then((list) => setOwners(Array.isArray(list) ? list : []))
      .catch(() => setOwners(null));
  }, []);

  // Anlaşmalı tesis: aktif üyeliği olan işletmelere bağlı tesisler
  const ownerStats = useMemo(() => {
    if (!owners) return { activeOwners: '-', partnerVenues: '-' };
    const active = owners.filter((o) => o.membershipActive);
    return {
      activeOwners: active.length,
      partnerVenues: active.reduce((sum, o) => sum + (o.venues?.length || 0), 0),
    };
  }, [owners]);

  const pending = useMemo(
    () =>
      matches
        .filter((m) => m.isActive === 1 && !isPast(m.matchDate))
        .sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate)),
    [matches]
  );

  const upcomingApproved = useMemo(
    () =>
      matches
        .filter((m) => m.isActive === 2 && !isPast(m.matchDate))
        .sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate))
        .slice(0, 6),
    [matches]
  );

  const breakdown = useMemo(() => {
    const total = matches.length || 1;
    const rows = [
      { key: 'pending', label: 'Onay bekleyen', count: pending.length, color: colors.gold },
      {
        key: 'approved',
        label: 'Onaylı (yaklaşan)',
        count: matches.filter((m) => m.isActive === 2 && !isPast(m.matchDate)).length,
        color: colors.pitch,
      },
      {
        key: 'done',
        label: 'Tamamlanan',
        count: matches.filter((m) => m.isActive !== 3 && isPast(m.matchDate)).length,
        color: colors.textSecondary,
      },
      { key: 'rejected', label: 'Reddedilen', count: matches.filter((m) => m.isActive === 3).length, color: colors.danger },
    ];
    return rows.map((r) => ({ ...r, percent: Math.round((r.count / total) * 100) }));
  }, [matches, pending]);

  const stats = [
    { title: 'Toplam maç', value: matches.length, icon: <CalendarOutlined />, color: colors.primary },
    { title: 'İşletme onayı bekleyen', value: pending.length, icon: <ScheduleOutlined />, color: colors.gold },
    { title: 'Anlaşmalı tesis', value: ownerStats.partnerVenues, icon: <EnvironmentOutlined />, color: colors.info, async: true },
    { title: 'Aktif işletme', value: ownerStats.activeOwners, icon: <ShopOutlined />, color: colors.primary, async: true },
    { title: 'Oyuncu sayısı', value: playerCount ?? '-', icon: <TeamOutlined />, color: colors.pitch, async: true },
  ];

  const pendingColumns = [
    { title: 'Maç', dataIndex: 'matchName', render: (v) => <Text strong>{v}</Text> },
    { title: 'Tesis · Saha', key: 'venue', render: (_, m) => venueLabel(m, stadiumNames) || '-' },
    {
      title: 'Tarih',
      dataIndex: 'matchDate',
      render: (d) => (
        <span>
          {formatDate(d)} <Text type="secondary">· {formatTime(d)}</Text>
        </span>
      ),
    },
    { title: 'Durum', dataIndex: 'isActive', render: (s) => <MatchStatusTag status={s} /> },
  ];

  return (
    <>
      <PageHeader
        title="Genel Bakış"
        subtitle={`${greeting()}${user?.playerName ? `, ${user.playerName}` : ''}. Sistemin güncel durumu aşağıda.`}
        icon={<AppstoreOutlined />}
      />

      <Row gutter={[16, 16]}>
        {stats.map((s) => (
          <Col xs={24} sm={12} lg={8} xl={{ flex: '20%' }} key={s.title}>
            <Card bordered={false} loading={loading && !s.async}>
              <Statistic
                title={s.title}
                value={s.value}
                prefix={<span style={{ color: s.color, marginRight: 4 }}>{s.icon}</span>}
              />
            </Card>
          </Col>
        ))}

        <Col xs={24} xl={16}>
          <Card
            bordered={false}
            title="İşletme onayı bekleyen rezervasyonlar"
            extra={
              <Button type="link" onClick={() => navigate('/adminPanel/reservations')}>
                Tümünü gör <RightOutlined />
              </Button>
            }
          >
            <Table
              size="small"
              rowKey="matchId"
              columns={pendingColumns}
              dataSource={pending.slice(0, 6)}
              loading={loading}
              pagination={false}
              scroll={{ x: 560 }}
              onRow={() => ({
                onClick: () => navigate('/adminPanel/reservations'),
                style: { cursor: 'pointer' },
              })}
              locale={{ emptyText: <EmptyState description="Onay bekleyen rezervasyon yok" /> }}
            />
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card bordered={false} title="Maç durum dağılımı" loading={loading}>
            {matches.length === 0 ? (
              <EmptyState description="Henüz maç yok" />
            ) : (
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                {breakdown.map((b) => (
                  <div key={b.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>{b.label}</Text>
                      <Text strong>{b.count}</Text>
                    </div>
                    <Progress percent={b.percent} strokeColor={b.color} showInfo={false} size="small" />
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            bordered={false}
            title="Yaklaşan onaylı maçlar"
            extra={
              <Button type="link" onClick={() => navigate('/adminPanel/matches')}>
                Tüm maçlar <RightOutlined />
              </Button>
            }
          >
            <List
              loading={loading}
              dataSource={upcomingApproved}
              locale={{ emptyText: <EmptyState description="Yaklaşan onaylı maç yok" /> }}
              renderItem={(m) => (
                <List.Item key={m.matchId} extra={<MatchStatusTag status={m.isActive} />}>
                  <List.Item.Meta
                    title={m.matchName}
                    description={
                      <Space size={16} wrap>
                        <MetaItem icon={<ClockCircleOutlined />}>
                          {formatDateTime(m.matchDate)} ({fromNow(m.matchDate)})
                        </MetaItem>
                        <MetaItem icon={<EnvironmentOutlined />}>{venueLabel(m, stadiumNames) || '-'}</MetaItem>
                        <MetaItem icon={<TeamOutlined />}>{m.userCount ?? 0} oyuncu</MetaItem>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
