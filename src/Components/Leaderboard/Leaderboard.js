import React, { useEffect, useMemo, useState } from 'react';
import { App, Card, Grid, Segmented, Skeleton, Table } from 'antd';
import { CrownFilled, StarFilled, TrophyOutlined } from '@ant-design/icons';
import { playersApi } from '../../api/matches';
import { EmptyState, PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fullName, getCurrentUser } from '../../utils/format';
import './Leaderboard.css';

const SORTS = {
  score: { label: 'Puan', key: (r) => r.userScore },
  goals: { label: 'Gol', key: (r) => r.goals },
  mvp: { label: 'MVP', key: (r) => r.mvpCount },
  matches: { label: 'Maç', key: (r) => r.matchesPlayed },
};

/** Telefonda tablo yerine kompakt liste: sıra, avatar, isim, seçili sıralamanın değeri */
function RankList({ rows, sort, meId }) {
  return (
    <ol className="mb-rank-list">
      {rows.map((r, i) => (
        <li key={r.player.playerId} className={r.player.playerId === meId ? 'is-me' : ''}>
          <span className={`mb-rank-list__rank r${i + 1}`}>{i + 1}</span>
          <PlayerAvatar player={r.player} size={40} />
          <div className="mb-rank-list__name">
            <strong>{fullName(r.player)}</strong>
            <span>
              {r.matchesPlayed} maç · {r.goals} gol · {r.assists ?? 0} asist
              {r.mvpCount > 0 && (
                <>
                  {' '}· <CrownFilled style={{ color: 'var(--mb-gold)' }} /> {r.mvpCount}
                </>
              )}
              {r.avgRating != null && (
                <>
                  {' '}· <StarFilled style={{ color: 'var(--mb-gold)' }} /> {r.avgRating.toFixed(1)}
                </>
              )}
            </span>
          </div>
          <span className="mb-rank-list__stat">
            <strong>{SORTS[sort].key(r) ?? 0}</strong>
            <small>{SORTS[sort].label}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Podium({ rows }) {
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  return (
    <div className="mb-podium">
      {order.map((r) => {
        const rank = rows.indexOf(r) + 1;
        return (
          <div key={r.player.playerId} className={`mb-podium__item r${rank}`}>
            {rank === 1 && <CrownFilled className="mb-podium__crown" />}
            <PlayerAvatar player={r.player} size={rank === 1 ? 96 : 76} />
            <strong>{fullName(r.player)}</strong>
            <span className="mb-podium__score">{r.userScore}</span>
            <span className="mb-podium__meta">
              {r.matchesPlayed} maç · {r.goals} gol · {r.mvpCount} MVP
            </span>
            <div className="mb-podium__base">{rank}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Leaderboard() {
  const { message } = App.useApp();
  const me = getCurrentUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('score');
  const isPhone = Grid.useBreakpoint().md === false;

  useEffect(() => {
    playersApi
      .leaderboard(50)
      .then(setRows)
      .catch((e) => message.error(apiErrorMessage(e, 'Sıralama yüklenemedi.')))
      .finally(() => setLoading(false));
  }, [message]);

  const sorted = useMemo(() => rows.slice().sort((a, b) => SORTS[sort].key(b) - SORTS[sort].key(a)), [rows, sort]);

  return (
    <>
      <PageHeader
        eyebrow="Sezon tablosu"
        title="Sıralama"
        subtitle="Maç sonrası puanlar, goller ve MVP oylarıyla belirlenir."
        icon={<TrophyOutlined />}
        extra={<Segmented value={sort} onChange={setSort} options={Object.entries(SORTS).map(([value, s]) => ({ value, label: s.label }))} />}
      />

      {loading ? (
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState description="Henüz puanlanmış maç yok. İlk maçını oyna, tabloya gir!" />
        </Card>
      ) : (
        <>
          {sorted.length >= 3 && <Podium rows={sorted} />}
          {isPhone ? (
            <Card className="mb-rank-card">
              <RankList rows={sorted} sort={sort} meId={me?.playerId} />
            </Card>
          ) : (
          <Card>
            <Table
              rowKey={(r) => r.player.playerId}
              dataSource={sorted}
              pagination={false}
              rowClassName={(r) => (r.player.playerId === me?.playerId ? 'mb-row-me' : '')}
              columns={[
                {
                  title: '#',
                  width: 56,
                  render: (_, __, i) => <span className="mb-rank">{i + 1}</span>,
                },
                {
                  title: 'Oyuncu',
                  render: (_, r) => (
                    <span className="mb-inline-player">
                      <PlayerAvatar player={r.player} size={34} />
                      <span>
                        <strong>{fullName(r.player)}</strong>
                        <br />
                        <small style={{ color: 'var(--mb-text-2)' }}>@{r.player.userName}</small>
                      </span>
                    </span>
                  ),
                },
                { title: 'Maç', dataIndex: 'matchesPlayed', width: 80, align: 'center' },
                { title: 'Gol', dataIndex: 'goals', width: 80, align: 'center' },
                { title: 'Asist', dataIndex: 'assists', width: 80, align: 'center' },
                {
                  title: 'MVP',
                  dataIndex: 'mvpCount',
                  width: 80,
                  align: 'center',
                  render: (v) => (v > 0 ? <span style={{ color: 'var(--mb-gold)' }}><CrownFilled /> {v}</span> : 0),
                },
                {
                  title: 'Ort.',
                  dataIndex: 'avgRating',
                  width: 90,
                  align: 'center',
                  render: (v) => (v != null ? <span><StarFilled style={{ color: 'var(--mb-gold)' }} /> {v.toFixed(1)}</span> : '-'),
                },
                {
                  title: 'Puan',
                  dataIndex: 'userScore',
                  width: 90,
                  align: 'right',
                  render: (v) => <span className="mb-points">{v}</span>,
                },
              ]}
            />
          </Card>
          )}
        </>
      )}
    </>
  );
}
