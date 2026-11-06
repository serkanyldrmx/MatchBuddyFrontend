import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Card, Col, Descriptions, Empty, Row, Skeleton, Tag } from 'antd';
import { CrownFilled, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../api/config';
import { playersApi } from '../../api/matches';
import { PlayerAvatar, Stat } from '../../ui';
import { apiErrorMessage, fullName, getCurrentUser } from '../../utils/format';
import './User.css';

function User() {
  const { message } = App.useApp();
  const navigate = useNavigate();
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
      .catch((e) => message.error(apiErrorMessage(e, 'Profil yüklenemedi.')))
      .finally(() => setLoading(false));
  }, [message]);

  if (loading || !player) {
    return (
      <Card>
        <Skeleton avatar active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  return (
    <>
      {/* ---------- Oyuncu kartı ---------- */}
      <section className="mb-profile-hero mb-pitch-bg">
        <div className="mb-profile-hero__id">
          <PlayerAvatar player={player} size={112} />
          <div>
            <span className="mb-profile-hero__eyebrow">Oyuncu kartı</span>
            <h1>{fullName(player)}</h1>
            <span className="mb-profile-hero__user">@{player.userName}</span>
            <div className="mb-profile-hero__tags">
              {player.age ? <span>{player.age} yaş</span> : null}
              {player.size ? <span>{player.size} cm</span> : null}
              {player.weight ? <span>{player.weight} kg</span> : null}
            </div>
          </div>
        </div>
        <div className="mb-profile-hero__rating">
          <span>Genel puan</span>
          <strong>{player.userScore ?? 0}</strong>
          <Button icon={<EditOutlined />} onClick={() => navigate('/userUpdate')} className="mb-ghost-btn">
            Profili düzenle
          </Button>
        </div>
      </section>

      <div className="mb-stat-strip">
        <Card><Stat value={stats?.matchesPlayed ?? 0} label="Maç" /></Card>
        <Card><Stat value={stats?.goals ?? 0} label="Gol" accent="var(--mb-primary)" /></Card>
        <Card><Stat value={stats?.assists ?? 0} label="Asist" /></Card>
        <Card><Stat value={stats?.mvpCount ?? 0} label="MVP" accent="var(--mb-gold)" /></Card>
        <Card><Stat value={stats?.avgRating != null ? stats.avgRating.toFixed(1) : '-'} label={`Ort. puan (${stats?.ratingCount ?? 0})`} /></Card>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={15}>
          <Card title="Son maçlar">
            {!stats?.recentMatches?.length ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Henüz oynanmış maçın yok." />
            ) : (
              <div className="mb-recent">
                {stats.recentMatches.map((m) => {
                  const mine = m.side === 2 ? m.awayScore : m.homeScore;
                  const theirs = m.side === 2 ? m.homeScore : m.awayScore;
                  const res = m.homeScore == null ? '-' : mine > theirs ? 'G' : mine < theirs ? 'M' : 'B';
                  return (
                    <div key={m.matchId} className="mb-recent__row" onClick={() => navigate(`/match-details/${m.matchId}`)}>
                      <span className={`mb-result-badge is-${res}`}>{res}</span>
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
          <Card title="İletişim bilgileri" style={{ marginBottom: 20 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="E-posta">{player.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="Telefon">{player.phoneNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label="Adres">{player.address || '-'}</Descriptions.Item>
            </Descriptions>
            <p className="mb-hint" style={{ textAlign: 'left' }}>Bu bilgileri sadece sen görebilirsin.</p>
          </Card>
          <Card title="Takımlarım">
            {teams.length ? (
              teams.map((t) => (
                <Tag key={t.teamId} style={{ marginBottom: 8, padding: '4px 10px' }}>
                  {t.teamName}
                </Tag>
              ))
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Henüz bir takımda değilsin." />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default User;
