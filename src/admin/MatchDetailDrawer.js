import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, Descriptions, Drawer, Grid, List, Popconfirm, Row, Skeleton, Space, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, StarFilled, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api } from '../api/config';
import i18n from '../i18n';
import { SURFACE, formatPrice } from '../api/venues';
import { EmptyState, MatchStatusTag, PlayerAvatar } from '../ui';
import { apiErrorMessage, formatDateTime, fromNow, fullName, isPast } from '../utils/format';
import './AdminResponsive.css';

const { Text, Paragraph } = Typography;

const teamName = (team, t) => team?.teamName || t('admin:matchDetail.team');

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
  const { t } = useTranslation();
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
      .catch((e) => !cancelled && message.error(apiErrorMessage(e, i18n.t('admin:matchDetail.teamsLoadFailed'))))
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
          title={t('admin:shared.rejectAsAdminConfirm')}
          description={t('admin:matchDetail.overrideWarning')}
          okText={t('common:actions.reject')}
          cancelText={t('common:actions.cancel')}
          okButtonProps={{ danger: true }}
          onConfirm={() => onStatusChange(match.matchId, 3)}
        >
          <Button danger icon={<CloseOutlined />} loading={actionLoading === 3}>
            {isPhone ? t('common:actions.reject') : t('admin:shared.rejectAsAdmin')}
          </Button>
        </Popconfirm>
        <Popconfirm
          title={t('admin:shared.approveAsAdminConfirm')}
          description={t('admin:matchDetail.overrideWarning')}
          okText={t('common:actions.confirm')}
          cancelText={t('common:actions.cancel')}
          onConfirm={() => onStatusChange(match.matchId, 2)}
        >
          <Button type="primary" icon={<CheckOutlined />} loading={actionLoading === 2}>
            {isPhone ? t('common:actions.confirm') : t('admin:shared.approveAsAdmin')}
          </Button>
        </Popconfirm>
      </Space>
    );
  }, [canDecide, match, onStatusChange, actionLoading, isPhone, t]);

  return (
    <Drawer title={match?.matchName || t('admin:matchDetail.title')} width={520} open={open} onClose={onClose} footer={footer} destroyOnClose>
      {match && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions column={1} size="small" bordered labelStyle={isPhone ? { width: 110 } : undefined}>
            <Descriptions.Item label={t('admin:matchDetail.labels.status')}>
              <Space size={4} wrap>
                <MatchStatusTag status={match.isActive} />
                {past && <Tag>{t('admin:shared.expired')}</Tag>}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label={t('admin:matchDetail.labels.venue')}>
              {match.venue?.name || match.stadiumName || stadiumName || '-'}
            </Descriptions.Item>
            {match.venue?.pitchName && (
              <Descriptions.Item label={t('admin:matchDetail.labels.pitch')}>
                <Space size={4} wrap>
                  {match.venue.pitchName}
                  {match.venue.surface != null && <Tag>{SURFACE[match.venue.surface] || t('common:other')}</Tag>}
                  {match.venue.isIndoor != null && (
                    <Tag>{match.venue.isIndoor ? t('common:indoor') : t('common:outdoor')}</Tag>
                  )}
                </Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label={t('admin:matchDetail.labels.dateTime')}>
              {formatDateTime(match.matchDate)}{' '}
              <Text type="secondary">({fromNow(match.matchDate)})</Text>
            </Descriptions.Item>
            {match.durationMinutes != null && (
              <Descriptions.Item label={t('admin:matchDetail.labels.duration')}>
                {t('admin:matchDetail.durationMinutes', { count: match.durationMinutes })}
              </Descriptions.Item>
            )}
            <Descriptions.Item label={t('admin:matchDetail.labels.playerCount')}>
              {match.goingCount != null ? `${match.goingCount} / ` : ''}
              {match.userCount ?? match.capacity ?? '-'}
            </Descriptions.Item>
            {match.totalPrice != null && (
              <Descriptions.Item label={t('admin:matchDetail.labels.amount')}>
                <Text strong>{formatPrice(match.totalPrice)}</Text>
                {match.perPlayer != null && (
                  <Text type="secondary"> · {t('admin:shared.perPlayer', { price: formatPrice(match.perPlayer) })}</Text>
                )}
              </Descriptions.Item>
            )}
            {(match.cleatCount > 0 || match.cameraRequested) && (
              <Descriptions.Item label={t('admin:matchDetail.labels.extras')}>
                <Space size={4} wrap>
                  {match.cleatCount > 0 && <Tag>{t('admin:matchDetail.cleats', { count: match.cleatCount })}</Tag>}
                  {match.cameraRequested && <Tag>{t('admin:matchDetail.recording')}</Tag>}
                </Space>
              </Descriptions.Item>
            )}
            {(match.homeTeam || match.awayTeam || match.lookingForOpponent) && (
              <Descriptions.Item label={t('admin:matchDetail.labels.teams')}>
                <Space size={4} wrap>
                  {match.homeTeam ? (
                    <Tag color="lime">{teamName(match.homeTeam, t)}</Tag>
                  ) : (
                    <Tag>{t('admin:shared.mixed')}</Tag>
                  )}
                  <Text type="secondary">{t('admin:matchDetail.vs')}</Text>
                  {match.awayTeam ? (
                    <Tag color="blue">{teamName(match.awayTeam, t)}</Tag>
                  ) : match.lookingForOpponent ? (
                    <Tag color="gold">{t('admin:shared.lookingForOpponent')}</Tag>
                  ) : (
                    <Tag>{t('admin:shared.mixed')}</Tag>
                  )}
                </Space>
              </Descriptions.Item>
            )}
            {match.createdBy && (
              <Descriptions.Item label={t('admin:matchDetail.labels.creator')}>
                <Space size={8}>
                  <PlayerAvatar player={match.createdBy} size={24} />
                  {fullName(match.createdBy)}
                </Space>
              </Descriptions.Item>
            )}
            {match.isActive === 3 && match.rejectReason && (
              <Descriptions.Item label={t('admin:matchDetail.labels.rejectReason')}>{match.rejectReason}</Descriptions.Item>
            )}
            {match.likes != null && (
              <Descriptions.Item label={t('admin:matchDetail.labels.likes')}>{match.likes}</Descriptions.Item>
            )}
            {match.description && (
              <Descriptions.Item label={t('admin:matchDetail.labels.description')}>
                <Paragraph style={{ margin: 0 }}>{match.description}</Paragraph>
              </Descriptions.Item>
            )}
          </Descriptions>

          {loading ? (
            <Skeleton active />
          ) : teams.length === 0 ? (
            <EmptyState description={t('admin:matchDetail.noTeams')} />
          ) : (
            <Row gutter={[16, 16]}>
              {teams.map((team) => (
                <Col span={24} key={team.teamId}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <TeamOutlined />
                        {teamName(team, t)}
                      </Space>
                    }
                    extra={<Text type="secondary">{t('admin:shared.playerCount', { count: team.players.length })}</Text>}
                  >
                    <List
                      size="small"
                      dataSource={team.players}
                      locale={{ emptyText: t('admin:matchDetail.noPlayers') }}
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
