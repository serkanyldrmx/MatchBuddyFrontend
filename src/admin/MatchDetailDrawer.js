import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, Descriptions, Drawer, Grid, List, Popconfirm, Row, Skeleton, Space, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, StarFilled, TeamOutlined } from '@ant-design/icons';
import { api } from '../api/config';
import { SURFACE, formatPrice } from '../api/venues';
import { EmptyState, MatchStatusTag, PlayerAvatar } from '../ui';
import { apiErrorMessage, formatDateTime, fromNow, fullName, isPast } from '../utils/format';
import './AdminResponsive.css';

const { Text, Paragraph } = Typography;

export const OVERRIDE_WARNING = 'Rezervasyonları normalde tesis işletmesi onaylar. Bu işlem işletmenin kararını geçersiz kılar.';

const teamName = (t) => t?.teamName || 'Takım';

/** GetMatchTeamInfo düz satırlarını takımlara gruplar */
export function groupTeams(rows) {
  const map = new Map();
  (rows || []).forEach((r) => {
    if (!map.has(r.teamId)) map.set(r.teamId, { teamId: r.teamId, teamName: r.teamName, players: [] });
    if (r.playerId) map.get(r.teamId).players.push(r);
  });
  return Array.from(map.values());
}

/**
 * Maç detay paneli (admin). match: liste satırı, stadiumName: eşleşen halı saha adı.
 * onStatusChange(matchId, status) verilirse ve maç onay bekliyorsa "Admin olarak onayla/reddet" butonları gösterilir.
 * Rezervasyonları artık işletmeler onaylar; bu butonlar işletmenin kararını geçersiz kılar.
 */
export default function MatchDetailDrawer({ match, stadiumName, open, onClose, onStatusChange, actionLoading }) {
  const { message } = App.useApp();
  const isPhone = Grid.useBreakpoint().md === false;
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !match) return undefined;
    let cancelled = false;
    setLoading(true);
    setTeams([]);
    api
      .get('/api/Match/GetMatchTeamInfo', { params: { matchId: match.matchId } })
      .then((r) => !cancelled && setTeams(groupTeams(r.data)))
      .catch((e) => !cancelled && message.error(apiErrorMessage(e, 'Takım bilgileri alınamadı.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, match, message]);

  const past = match ? isPast(match.matchDate) : false;
  const canDecide = Boolean(onStatusChange && match && match.isActive === 1);

  const footer = useMemo(() => {
    if (!canDecide) return null;
    return (
      <Space style={{ width: '100%', justifyContent: 'flex-end' }} className={isPhone ? 'mb-admin-drawer-actions' : undefined}>
        <Popconfirm
          title="Admin olarak reddedilsin mi?"
          description={OVERRIDE_WARNING}
          okText="Reddet"
          cancelText="Vazgeç"
          okButtonProps={{ danger: true }}
          onConfirm={() => onStatusChange(match.matchId, 3)}
        >
          <Button danger icon={<CloseOutlined />} loading={actionLoading === 3}>
            {isPhone ? 'Reddet' : 'Admin olarak reddet'}
          </Button>
        </Popconfirm>
        <Popconfirm
          title="Admin olarak onaylansın mı?"
          description={OVERRIDE_WARNING}
          okText="Onayla"
          cancelText="Vazgeç"
          onConfirm={() => onStatusChange(match.matchId, 2)}
        >
          <Button type="primary" icon={<CheckOutlined />} loading={actionLoading === 2}>
            {isPhone ? 'Onayla' : 'Admin olarak onayla'}
          </Button>
        </Popconfirm>
      </Space>
    );
  }, [canDecide, match, onStatusChange, actionLoading, isPhone]);

  return (
    <Drawer title={match?.matchName || 'Maç detayı'} width={520} open={open} onClose={onClose} footer={footer} destroyOnClose>
      {match && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions column={1} size="small" bordered labelStyle={isPhone ? { width: 110 } : undefined}>
            <Descriptions.Item label="Durum">
              <Space size={4} wrap>
                <MatchStatusTag status={match.isActive} />
                {past && <Tag>Tarihi geçti</Tag>}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Tesis">{match.venue?.name || match.stadiumName || stadiumName || '-'}</Descriptions.Item>
            {match.venue?.pitchName && (
              <Descriptions.Item label="Saha">
                <Space size={4} wrap>
                  {match.venue.pitchName}
                  {match.venue.surface != null && <Tag>{SURFACE[match.venue.surface] || 'Diğer'}</Tag>}
                  {match.venue.isIndoor != null && <Tag>{match.venue.isIndoor ? 'Kapalı' : 'Açık'}</Tag>}
                </Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Tarih & saat">
              {formatDateTime(match.matchDate)}{' '}
              <Text type="secondary">({fromNow(match.matchDate)})</Text>
            </Descriptions.Item>
            {match.durationMinutes != null && (
              <Descriptions.Item label="Süre">{match.durationMinutes} dakika</Descriptions.Item>
            )}
            <Descriptions.Item label="Oyuncu sayısı">
              {match.goingCount != null ? `${match.goingCount} / ` : ''}
              {match.userCount ?? match.capacity ?? '-'}
            </Descriptions.Item>
            {match.totalPrice != null && (
              <Descriptions.Item label="Tutar">
                <Text strong>{formatPrice(match.totalPrice)}</Text>
                {match.perPlayer != null && <Text type="secondary"> · kişi başı {formatPrice(match.perPlayer)}</Text>}
              </Descriptions.Item>
            )}
            {(match.cleatCount > 0 || match.cameraRequested) && (
              <Descriptions.Item label="Ekstralar">
                <Space size={4} wrap>
                  {match.cleatCount > 0 && <Tag>{match.cleatCount} krampon</Tag>}
                  {match.cameraRequested && <Tag>Maç kaydı</Tag>}
                </Space>
              </Descriptions.Item>
            )}
            {(match.homeTeam || match.awayTeam || match.lookingForOpponent) && (
              <Descriptions.Item label="Takımlar">
                <Space size={4} wrap>
                  {match.homeTeam ? <Tag color="lime">{teamName(match.homeTeam)}</Tag> : <Tag>Karma</Tag>}
                  <Text type="secondary">vs</Text>
                  {match.awayTeam ? (
                    <Tag color="blue">{teamName(match.awayTeam)}</Tag>
                  ) : match.lookingForOpponent ? (
                    <Tag color="gold">Rakip aranıyor</Tag>
                  ) : (
                    <Tag>Karma</Tag>
                  )}
                </Space>
              </Descriptions.Item>
            )}
            {match.createdBy && (
              <Descriptions.Item label="Kurucu">
                <Space size={8}>
                  <PlayerAvatar player={match.createdBy} size={24} />
                  {fullName(match.createdBy)}
                </Space>
              </Descriptions.Item>
            )}
            {match.isActive === 3 && match.rejectReason && (
              <Descriptions.Item label="Red sebebi">{match.rejectReason}</Descriptions.Item>
            )}
            {match.likes != null && <Descriptions.Item label="Beğeni">{match.likes}</Descriptions.Item>}
            {match.description && (
              <Descriptions.Item label="Açıklama">
                <Paragraph style={{ margin: 0 }}>{match.description}</Paragraph>
              </Descriptions.Item>
            )}
          </Descriptions>

          {loading ? (
            <Skeleton active />
          ) : teams.length === 0 ? (
            <EmptyState description="Bu maça ait takım bilgisi yok" />
          ) : (
            <Row gutter={[16, 16]}>
              {teams.map((team) => (
                <Col span={24} key={team.teamId}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <TeamOutlined />
                        {team.teamName || 'Takım'}
                      </Space>
                    }
                    extra={<Text type="secondary">{team.players.length} oyuncu</Text>}
                  >
                    <List
                      size="small"
                      dataSource={team.players}
                      locale={{ emptyText: 'Oyuncu yok' }}
                      renderItem={(p) => (
                        <List.Item
                          key={p.playerId}
                          extra={
                            p.userScore != null && (
                              <Tag icon={<StarFilled />} color="gold">
                                {p.userScore}
                              </Tag>
                            )
                          }
                        >
                          <List.Item.Meta
                            avatar={<PlayerAvatar player={p} size={32} />}
                            title={fullName(p)}
                            description={p.userName ? `@${p.userName}` : null}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Space>
      )}
    </Drawer>
  );
}
