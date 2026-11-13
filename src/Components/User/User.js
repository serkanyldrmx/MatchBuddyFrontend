import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Card, Col, Descriptions, Empty, Grid, Row, Tag } from 'antd';
import { CrownFilled, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/config';
import { playersApi } from '../../api/matches';
import { PageLoader, PlayerAvatar, Stat } from '../../ui';
import { apiErrorMessage, fullName, getCurrentUser } from '../../utils/format';
import './User.css';
import { formatPhone } from '../../utils/phone';

function User() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isPhone = Grid.useBreakpoint().md === false;
  const [player, setPlayer] = useState(null);
  const [stats, setStats] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const me = getCurrentUser();
    if (!me?.playerId) return;
    Promise.all([
      api.get(`/api/Players/GetPlayerById?playerId=${me.playerId}`),
      api.get('/api/Team/GetTeamList'),
      playersApi.stats(me.playerId).catch(() => null),
    ])
      .then(([p, t, s]) => {
        setPlayer(p.data);
        setTeams((t.data || []).filter((team) => (team.playerId || []).includes(me.playerId)));
        setStats(s);
      })
      .catch((e) => message.error(apiErrorMessage(e, t('profile:loadError'))))
      .finally(() => setLoading(false));
  }, [message, t]);

  if (loading || !player) {
    return <PageLoader caption={t('profile:loading')} />;
  }

  return (
    <>
      {/* ---------- Oyuncu kartı ---------- */}
      <section className="mb-profile-hero mb-pitch-bg">
        <div className="mb-profile-hero__id">
          <PlayerAvatar player={player} size={isPhone ? 76 : 112} />
          <div>
            <span className="mb-profile-hero__eyebrow">{t('profile:hero.eyebrow')}</span>
            <h1>{fullName(player)}</h1>
            <span className="mb-profile-hero__user">@{player.userName}</span>
            <div className="mb-profile-hero__tags">
              {player.age ? <span>{t('profile:hero.age', { count: player.age })}</span> : null}
              {player.size ? <span>{player.size} cm</span> : null}
              {player.weight ? <span>{player.weight} kg</span> : null}
            </div>
          </div>
        </div>
        <div className="mb-profile-hero__rating">
          <span>{t('profile:hero.overallScore')}</span>
          <strong>{player.userScore ?? 0}</strong>
          <Button icon={<EditOutlined />} onClick={() => navigate('/userUpdate')} className="mb-ghost-btn">
            {t('profile:edit.title')}
          </Button>
        </div>
      </section>

      <div className="mb-stat-strip">
        <Card><Stat value={stats?.matchesPlayed ?? 0} label={t('profile:stats.matches')} /></Card>
        <Card><Stat value={stats?.goals ?? 0} label={t('profile:stats.goals')} accent="var(--mb-primary)" /></Card>
        <Card><Stat value={stats?.assists ?? 0} label={t('profile:stats.assists')} /></Card>
        <Card><Stat value={stats?.mvpCount ?? 0} label={t('profile:stats.mvp')} accent="var(--mb-gold)" /></Card>
        <Card><Stat value={stats?.avgRating != null ? stats.avgRating.toFixed(1) : '-'} label={t('profile:stats.avgRating', { count: stats?.ratingCount ?? 0 })} /></Card>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={15}>
          <Card title={t('profile:recent.title')}>
            {!stats?.recentMatches?.length ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('profile:recent.empty')} />
            ) : (
              <div className="mb-recent">
                {stats.recentMatches.map((m) => {
                  const mine = m.side === 2 ? m.awayScore : m.homeScore;
                  const theirs = m.side === 2 ? m.homeScore : m.awayScore;
                  const res = m.homeScore == null ? '-' : mine > theirs ? 'G' : mine < theirs ? 'M' : 'B';
                  return (
                    <div key={m.matchId} className="mb-recent__row" onClick={() => navigate(`/match-details/${m.matchId}`)}>
                      <span className={`mb-result-badge is-${res}`}>
                        {res === 'G' ? t('profile:recent.win') : res === 'M' ? t('profile:recent.loss') : res === 'B' ? t('profile:recent.draw') : res}
                      </span>
                      <div className="mb-recent__name">
                        <strong>{m.matchName}</strong>
                        <span>{dayjs(m.matchDate).format('DD MMM YYYY')}</span>
                      </div>
                      <span className="mb-recent__score">
                        {m.homeScore ?? '-'} : {m.awayScore ?? '-'}
                      </span>
                      <span className="mb-recent__me">
                        {m.goals > 0 && <>⚽ {m.goals} </>}
                        {m.assists > 0 && <>🅰 {m.assists} </>}
                        {m.wasMvp && <CrownFilled style={{ color: 'var(--mb-gold)' }} />}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card title={t('profile:contact.title')} style={{ marginBottom: 20 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t('profile:fields.email')}>{player.email || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('profile:fields.phone')}>{player.phoneNumber ? formatPhone(player.phoneNumber) : '-'}</Descriptions.Item>
              <Descriptions.Item label={t('profile:fields.address')}>{player.address || '-'}</Descriptions.Item>
            </Descriptions>
            <p className="mb-hint" style={{ textAlign: 'left' }}>{t('profile:contact.privateHint')}</p>
          </Card>
          <Card title={t('profile:teams.title')}>
            {teams.length ? (
              teams.map((t) => (
                <Tag key={t.teamId} style={{ marginBottom: 8, padding: '4px 10px' }}>
                  {t.teamName}
                </Tag>
              ))
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('profile:teams.empty')} />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default User;
