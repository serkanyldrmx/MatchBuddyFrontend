import React, { useEffect, useMemo, useState } from 'react';
import { App, Card, Grid, Segmented, Skeleton, Table } from 'antd';
import { CrownFilled, StarFilled, TrophyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { playersApi } from '../../api/matches';
import { EmptyState, PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fullName, getCurrentUser } from '../../utils/format';
import './Leaderboard.css';

// labelKey: çeviri anahtarı (render anında t() ile çözülür)
const SORTS = {
  score: { labelKey: 'social:leaderboard.sort.score', key: (r) => r.userScore },
  goals: { labelKey: 'social:leaderboard.sort.goals', key: (r) => r.goals },
  mvp: { labelKey: 'social:leaderboard.sort.mvp', key: (r) => r.mvpCount },
  matches: { labelKey: 'social:leaderboard.sort.matches', key: (r) => r.matchesPlayed },
};

/** Telefonda tablo yerine kompakt liste: sıra, avatar, isim, seçili sıralamanın değeri */
function RankList({ rows, sort, meId }) {
  const { t } = useTranslation();
  return (
    <ol className="mb-rank-list">
      {rows.map((r, i) => (
        <li key={r.player.playerId} className={r.player.playerId === meId ? 'is-me' : ''}>
          <span className={`mb-rank-list__rank r${i + 1}`}>{i + 1}</span>
          <PlayerAvatar player={r.player} size={40} />
          <div className="mb-rank-list__name">
            <strong>{fullName(r.player)}</strong>
            <span>
              {t('social:leaderboard.rankLine', { matches: r.matchesPlayed, goals: r.goals, assists: r.assists ?? 0 })}
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
            <small>{t(SORTS[sort].labelKey)}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Podium({ rows }) {
  const { t } = useTranslation();
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
              {t('social:leaderboard.podiumLine', { matches: r.matchesPlayed, goals: r.goals, mvp: r.mvpCount })}
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
  const { t } = useTranslation();
  const me = getCurrentUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('score');
  const isPhone = Grid.useBreakpoint().md === false;

  useEffect(() => {
    playersApi
      .leaderboard(50)
      .then(setRows)
      .catch((e) => message.error(apiErrorMessage(e, t('social:leaderboard.loadFailed'))))
      .finally(() => setLoading(false));
  }, [message, t]);

  const sorted = useMemo(() => rows.slice().sort((a, b) => SORTS[sort].key(b) - SORTS[sort].key(a)), [rows, sort]);

  return (
    <>
      <PageHeader
        eyebrow={t('social:leaderboard.eyebrow')}
        title={t('social:leaderboard.title')}
        subtitle={t('social:leaderboard.subtitle')}
        icon={<TrophyOutlined />}
        extra={<Segmented value={sort} onChange={setSort} options={Object.entries(SORTS).map(([value, s]) => ({ value, label: t(s.labelKey) }))} />}
      />

      {loading ? (
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState description={t('social:leaderboard.empty')} />
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
                  title: t('social:leaderboard.columns.player'),
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
                { title: t('social:leaderboard.columns.matches'), dataIndex: 'matchesPlayed', width: 80, align: 'center' },
                { title: t('social:leaderboard.columns.goals'), dataIndex: 'goals', width: 80, align: 'center' },
                { title: t('social:leaderboard.columns.assists'), dataIndex: 'assists', width: 80, align: 'center' },
                {
                  title: t('social:leaderboard.columns.mvp'),
                  dataIndex: 'mvpCount',
                  width: 80,
                  align: 'center',
                  render: (v) => (v > 0 ? <span style={{ color: 'var(--mb-gold)' }}><CrownFilled /> {v}</span> : 0),
                },
                {
                  title: t('social:leaderboard.columns.avg'),
                  dataIndex: 'avgRating',
                  width: 90,
                  align: 'center',
                  render: (v) => (v != null ? <span><StarFilled style={{ color: 'var(--mb-gold)' }} /> {v.toFixed(1)}</span> : '-'),
                },
                {
                  title: t('social:leaderboard.columns.score'),
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
