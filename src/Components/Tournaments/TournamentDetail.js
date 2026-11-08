import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { App, Avatar, Button, Dropdown, Result, Select, Skeleton, Table, Tabs, Tooltip } from 'antd';
import { Trans, useTranslation } from 'react-i18next';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CrownFilled,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { FIXTURE_STATUS, tournamentsApi, TOURNAMENT_STATUS } from '../../api/tournaments';
import { EmptyState, PlayerAvatar } from '../../ui';
import { apiErrorMessage, formatDate, formatDateTime, formatTime, fullName } from '../../utils/format';
import { PlayerLink } from '../Social/FollowButton';
import Bracket from './Bracket';
import { DateModal, ResultModal } from './FixtureModals';
import { FormatChip, isKnockout, isLeague, roundName, TournamentStatusChip } from './tournamentUtils';
import '../Home/MatchDetails.css';
import './Tournaments.css';

/* ---------------- Fikstür satırı ---------------- */
function FixtureRow({ f, myTeamIds, canManage, ongoing, onResult, onDate }) {
  const { t } = useTranslation();
  const played = f.status === FIXTURE_STATUS.PLAYED;
  const bye = f.status === FIXTURE_STATUS.BYE;
  const w = f.winnerTeamId;
  const bothKnown = !!f.homeTeam && !!f.awayTeam;

  const side = (team, cls) => {
    const isWinner = team && w && team.teamId === w;
    const isLoser = team && w && team.teamId !== w;
    return (
      <div
        className={`mb-fx-row__team ${cls} ${isWinner ? 'is-winner' : ''} ${isLoser ? 'is-loser' : ''} ${
          team && myTeamIds.has(team.teamId) ? 'is-mine' : ''
        } ${team ? '' : 'is-empty'}`}
      >
        {isWinner && cls === 'is-away' && <CrownFilled className="mb-fx-row__crown" />}
        <strong>{team ? team.teamName : bye ? t('tournaments:bracket.bye') : t('tournaments:teamTbd')}</strong>
        {isWinner && cls === 'is-home' && <CrownFilled className="mb-fx-row__crown" />}
      </div>
    );
  };

  let center;
  if (bye) center = <span className="mb-fx-row__bye">{t('tournaments:bracket.byePassed')}</span>;
  else if (played)
    center = (
      <span className="mb-fx-row__score">
        {f.homeScore}
        <i>:</i>
        {f.awayScore}
      </span>
    );
  else center = <span className="mb-fx-row__time">{f.matchDate ? formatTime(f.matchDate) : '--:--'}</span>;

  const showActions = canManage && ongoing && !bye;

  return (
    <div className={`mb-fx-row ${played ? 'is-played' : ''} ${bye ? 'is-bye' : ''}`}>
      <div className="mb-fx-row__date">
        <CalendarOutlined /> {f.matchDate ? formatDate(f.matchDate) : t('tournaments:fixtures.noDate')}
        {played && w && f.homeScore === f.awayScore && <span className="mb-fx-row__pen">{t('tournaments:fixtures.onPenalties')}</span>}
      </div>
      <div className="mb-fx-row__board">
        {side(f.homeTeam, 'is-home')}
        <div className="mb-fx-row__center">{center}</div>
        {side(f.awayTeam, 'is-away')}
      </div>
      {showActions && (
        <div className="mb-fx-row__actions">
          <Tooltip title={bothKnown ? '' : t('tournaments:fixtures.resultNeedsTeams')}>
            <Button size="small" type={played ? 'default' : 'primary'} disabled={!bothKnown} onClick={() => onResult(f)}>
              {played ? t('tournaments:fixtures.editResult') : t('tournaments:result.title')}
            </Button>
          </Tooltip>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onDate(f)}>
            {t('tournaments:date.title')}
          </Button>
        </div>
      )}
    </div>
  );
}

function FixturesTab({ tour, myTeamIds, onResult, onDate }) {
  const { t } = useTranslation();
  const rounds = useMemo(() => {
    const map = new Map();
    [...(tour.fixtures || [])]
      .sort((a, b) => a.round - b.round || a.position - b.position)
      .forEach((f) => {
        if (!map.has(f.round)) map.set(f.round, []);
        map.get(f.round).push(f);
      });
    return [...map.entries()];
  }, [tour.fixtures]);

  if (!rounds.length) {
    return (
      <EmptyState
        description={
          tour.status === TOURNAMENT_STATUS.REGISTRATION
            ? t('tournaments:fixtures.emptyBeforeStart')
            : t('tournaments:fixtures.empty')
        }
      />
    );
  }

  return (
    <div className="mb-fx-rounds">
      {rounds.map(([round, list]) => {
        const done = list.every((f) => f.status !== FIXTURE_STATUS.SCHEDULED);
        return (
          <section key={round} className="mb-fx-round">
            <header className="mb-fx-round__head">
              <h3>{roundName(tour, round)}</h3>
              {done && <span className="mb-chip is-done">{t('common:status.completed')}</span>}
            </header>
            <div className="mb-fx-round__list">
              {list.map((f) => (
                <FixtureRow
                  key={f.fixtureId}
                  f={f}
                  myTeamIds={myTeamIds}
                  canManage={tour.canManage}
                  ongoing={tour.status === TOURNAMENT_STATUS.ONGOING}
                  onResult={onResult}
                  onDate={onDate}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- Puan tablosu ---------------- */
function StandingsTab({ tour, myTeamIds }) {
  const { t } = useTranslation();
  const rows = (tour.standings || []).map((s, i) => ({ ...s, rank: i + 1 }));
  if (!rows.length) return <EmptyState description={t('tournaments:standings.empty')} />;

  const num = (key, title, extra = {}) => ({ title, dataIndex: key, key, align: 'center', width: 52, ...extra });
  const columns = [
    {
      title: '#',
      dataIndex: 'rank',
      key: 'rank',
      width: 52,
      align: 'center',
      render: (r) => <span className={`mb-st-rank ${r === 1 ? 'is-first' : ''}`}>{r === 1 ? <CrownFilled /> : r}</span>,
    },
    {
      title: t('tournaments:standings.team'),
      key: 'team',
      render: (_, s) => (
        <span className="mb-st-team">
          <strong>{s.team?.teamName}</strong>
          {myTeamIds.has(s.team?.teamId) && <span className="mb-chip is-approved">{t('tournaments:standings.yours')}</span>}
        </span>
      ),
    },
    num('played', t('tournaments:standings.cols.played')),
    num('won', t('tournaments:standings.cols.won')),
    num('drawn', t('tournaments:standings.cols.drawn')),
    num('lost', t('tournaments:standings.cols.lost')),
    num('goalsFor', t('tournaments:standings.cols.goalsFor'), { responsive: ['sm'] }),
    num('goalsAgainst', t('tournaments:standings.cols.goalsAgainst'), { responsive: ['sm'] }),
    num('goalDiff', t('tournaments:standings.cols.goalDiff'), { render: (v) => (v > 0 ? `+${v}` : v) }),
    num('points', t('tournaments:standings.cols.points'), { width: 60, render: (v) => <span className="mb-st-points">{v}</span> }),
  ];

  return (
    <div className="mb-st-wrap">
      <Table
        rowKey={(s) => s.team?.teamId ?? s.rank}
        size="middle"
        pagination={false}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 520 }}
        rowClassName={(s) => `${s.rank === 1 ? 'mb-st-row-first' : ''} ${myTeamIds.has(s.team?.teamId) ? 'mb-st-row-mine' : ''}`}
      />
      <p className="mb-tr-legend">{t('tournaments:standings.legend')}</p>
    </div>
  );
}

/* ---------------- Takımlar ---------------- */
function TeamsTab({ tour, onWithdraw }) {
  const { t } = useTranslation();
  const teams = tour.teams || [];
  if (!teams.length) {
    return <EmptyState description={t('tournaments:teams.empty')} />;
  }
  const regOpen = tour.status === TOURNAMENT_STATUS.REGISTRATION;
  return (
    <div className="mb-tm-grid">
      {teams.map((team) => {
        const isWinner = tour.winner?.teamId === team.teamId;
        return (
          <div key={team.teamId} className={`mb-tm-card ${team.isMine ? 'is-mine' : ''} ${isWinner ? 'is-winner' : ''}`}>
            <div className="mb-tm-card__head">
              <span className="mb-tm-card__badge">{(team.teamName || '?').charAt(0).toUpperCase()}</span>
              <div className="mb-tm-card__title">
                <strong>{team.teamName}</strong>
                <small>
                  <TeamOutlined /> {t('tournaments:teams.players', { count: team.memberCount ?? team.members?.length ?? 0 })}
                </small>
              </div>
              {isWinner && <CrownFilled className="mb-tm-card__crown" />}
            </div>
            <div className="mb-tm-card__members">
              <Avatar.Group max={{ count: 6 }} size={34}>
                {(team.members || []).map((p) => (
                  <Tooltip key={p.playerId} title={fullName(p)}>
                    <Link to={`/player/${p.playerId}`}>
                      <PlayerAvatar player={p} size={34} />
                    </Link>
                  </Tooltip>
                ))}
              </Avatar.Group>
              {team.memberCount > (team.members?.length || 0) && (
                <span className="mb-tm-card__more">+{team.memberCount - team.members.length}</span>
              )}
            </div>
            <div className="mb-tm-card__footer">
              {team.isMine ? <span className="mb-chip is-approved">{t('tournaments:teams.yourTeam')}</span> : <span />}
              {regOpen && (team.isMine || tour.canManage) && (
                <Button size="small" type="text" danger icon={<LogoutOutlined />} onClick={() => onWithdraw(team)}>
                  {t('tournaments:teams.withdraw')}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Katılım alanı (hero) ---------------- */
function JoinPanel({ tour, onJoin, joining }) {
  const { t } = useTranslation();
  const [teamId, setTeamId] = useState();
  const eligible = useMemo(() => tour.myEligibleTeams || [], [tour.myEligibleTeams]);
  const full = tour.maxTeams && tour.teamCount >= tour.maxTeams;

  useEffect(() => {
    setTeamId(eligible.length === 1 ? eligible[0].teamId : undefined);
  }, [eligible]);

  if (full) return <span className="mb-tr-hint">{t('tournaments:join.full')}</span>;

  if (!eligible.length) {
    if (tour.myTeamIds?.length) return null;
    return (
      <div className="mb-tr-join is-empty">
        <span className="mb-tr-hint">{t('tournaments:join.needTeam')}</span>
        <Link to="/create-team">
          <Button icon={<UsergroupAddOutlined />}>{t('tournaments:join.createTeam')}</Button>
        </Link>
        <Link to="/teamAICreate">
          <Button icon={<RobotOutlined />}>{t('tournaments:join.createTeamAI')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-tr-join">
      <Select
        placeholder={t('tournaments:join.selectTeam')}
        value={teamId}
        onChange={setTeamId}
        style={{ minWidth: 200 }}
        options={eligible.map((x) => ({ value: x.teamId, label: x.teamName }))}
      />
      <Button type="primary" icon={<UsergroupAddOutlined />} disabled={!teamId} loading={joining} onClick={() => onJoin(teamId)}>
        {t('tournaments:join.join')}
      </Button>
    </div>
  );
}

/* ---------------- Sayfa ---------------- */
export default function TournamentDetail() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { t } = useTranslation();

  const [tour, setTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState();
  const [joining, setJoining] = useState(false);
  const [resultFixture, setResultFixture] = useState(null);
  const [dateFixture, setDateFixture] = useState(null);

  const load = useCallback(
    async (silent) => {
      if (!silent) setLoading(true);
      try {
        const d = await tournamentsApi.detail(tournamentId);
        setTour(d);
        setNotFound(!d);
      } catch (e) {
        if (e?.response?.status === 404) setNotFound(true);
        else message.error(apiErrorMessage(e, t('tournaments:detail.loadError')));
      } finally {
        setLoading(false);
      }
    },
    [tournamentId, message, t]
  );

  useEffect(() => {
    setTab(undefined);
    load();
  }, [load]);

  const myTeamIds = useMemo(
    () => new Set([...(tour?.myTeamIds || []), ...(tour?.teams || []).filter((x) => x.isMine).map((x) => x.teamId)]),
    [tour]
  );

  if (loading && !tour) {
    return (
      <div className="mb-tr-page">
        <Skeleton.Node active style={{ width: '100%', height: 260, borderRadius: 24 }} />
        <Skeleton active paragraph={{ rows: 6 }} style={{ marginTop: 24 }} />
      </div>
    );
  }

  if (notFound || !tour) {
    return (
      <Result
        status="404"
        title={t('tournaments:detail.notFound')}
        subTitle={t('tournaments:detail.notFoundSub')}
        extra={
          <Button type="primary" onClick={() => navigate('/tournaments')}>
            {t('tournaments:detail.backToList')}
          </Button>
        }
      />
    );
  }

  const regOpen = tour.status === TOURNAMENT_STATUS.REGISTRATION;
  const finished = tour.status === TOURNAMENT_STATUS.FINISHED;
  const league = isLeague(tour);
  const knockout = isKnockout(tour);
  const defaultTab = regOpen ? 'teams' : 'fixtures';
  const activeTab = tab || defaultTab;
  const myRegistered = (tour.teams || []).filter((x) => x.isMine);
  const minTeams = league ? 3 : 2;

  const run = async (fn, okText, errText) => {
    try {
      const res = await fn();
      if (res?.success === false) {
        message.error(res.message || errText);
        return false;
      }
      message.success(res?.message || okText);
      return true;
    } catch (e) {
      message.error(apiErrorMessage(e, errText));
      return false;
    }
  };

  const join = async (teamId) => {
    setJoining(true);
    const ok = await run(() => tournamentsApi.registerTeam(tour.tournamentId, teamId), t('tournaments:detail.joinSuccess'), t('tournaments:detail.joinError'));
    setJoining(false);
    if (ok) {
      setTab('teams');
      load(true);
    }
  };

  const withdraw = (team) =>
    modal.confirm({
      title: t('tournaments:detail.withdrawConfirm.title', { name: team.teamName }),
      content: t('tournaments:detail.withdrawConfirm.content'),
      okText: t('tournaments:teams.withdraw'),
      okButtonProps: { danger: true },
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        if (await run(() => tournamentsApi.withdrawTeam(tour.tournamentId, team.teamId), t('tournaments:detail.withdrawSuccess'), t('tournaments:detail.withdrawError'))) load(true);
      },
    });

  const start = () =>
    modal.confirm({
      title: t('tournaments:detail.startConfirm.title'),
      width: 480,
      content: (
        <div className="mb-tr-confirm">
          <p>{t('tournaments:detail.startConfirm.intro')}</p>
          <ul>
            <li>{t('tournaments:detail.startConfirm.closed')}</li>
            {league ? (
              <li>{t('tournaments:detail.startConfirm.league')}</li>
            ) : (
              <li>{t('tournaments:detail.startConfirm.knockout')}</li>
            )}
            <li>{t('tournaments:detail.startConfirm.notify')}</li>
          </ul>
          <p>
            <Trans
              i18nKey="tournaments:detail.startConfirm.registered"
              count={tour.teamCount}
              components={{ b: <strong /> }}
            />
          </p>
        </div>
      ),
      okText: t('tournaments:detail.startConfirm.ok'),
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        if (await run(() => tournamentsApi.start(tour.tournamentId), t('tournaments:detail.startSuccess'), t('tournaments:detail.startError'))) {
          setTab('fixtures');
          load(true);
        }
      },
    });

  const remove = () =>
    modal.confirm({
      title: t('tournaments:detail.deleteConfirm.title'),
      content: t('tournaments:detail.deleteConfirm.content'),
      okText: t('common:actions.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        if (await run(() => tournamentsApi.remove(tour.tournamentId), t('tournaments:detail.deleteSuccess'), t('tournaments:detail.deleteError'))) navigate('/tournaments');
      },
    });

  const withdrawButton =
    regOpen && myRegistered.length > 0 ? (
      myRegistered.length === 1 ? (
        <Button danger icon={<LogoutOutlined />} onClick={() => withdraw(myRegistered[0])}>
          {t('tournaments:detail.withdrawTeam')}
        </Button>
      ) : (
        <Dropdown
          menu={{
            items: myRegistered.map((x) => ({ key: x.teamId, label: x.teamName, onClick: () => withdraw(x) })),
          }}
        >
          <Button danger icon={<LogoutOutlined />}>
            {t('tournaments:detail.withdrawTeam')}
          </Button>
        </Dropdown>
      )
    ) : null;

  const tabs = [
    {
      key: 'fixtures',
      label: t('tournaments:detail.tabs.fixtures'),
      children: (
        <FixturesTab tour={tour} myTeamIds={myTeamIds} onResult={setResultFixture} onDate={setDateFixture} />
      ),
    },
  ];
  if (league) {
    tabs.push({ key: 'standings', label: t('tournaments:detail.tabs.standings'), children: <StandingsTab tour={tour} myTeamIds={myTeamIds} /> });
  }
  if (knockout) {
    tabs.push({
      key: 'bracket',
      label: t('tournaments:detail.tabs.bracket'),
      children: tour.fixtures?.length ? (
        <Bracket tournament={tour} />
      ) : (
        <EmptyState description={t('tournaments:detail.bracketEmpty')} />
      ),
    });
  }
  tabs.push({
    key: 'teams',
    label: t('tournaments:detail.tabs.teams', { count: tour.teams?.length ?? tour.teamCount ?? 0 }),
    children: <TeamsTab tour={tour} onWithdraw={withdraw} />,
  });

  return (
    <div className="mb-tr-page">
      <section className="mb-pitch-bg mb-tr-hero">
        <div className="mb-tr-hero__top">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/tournaments')} className="mb-ghost-link">
            {t('tournaments:list.title')}
          </Button>
          <div className="mb-tr-hero__chips">
            <FormatChip format={tour.format} />
            <TournamentStatusChip status={tour.status} />
          </div>
        </div>

        <h1 className="mb-tr-hero__title">{tour.name}</h1>
        {tour.description && <p className="mb-tr-hero__desc">{tour.description}</p>}

        <div className="mb-tr-hero__meta">
          <span>
            <CalendarOutlined /> {formatDateTime(tour.startDate)}
          </span>
          <span>
            <EnvironmentOutlined /> {tour.stadium?.stadiumName || t('tournaments:card.noPitch')}
          </span>
          <span>
            <TeamOutlined /> {t('tournaments:card.teamCount', { count: tour.teamCount ?? 0, max: tour.maxTeams })}
          </span>
          {tour.createdBy && (
            <span className="mb-tr-hero__creator">
              <PlayerAvatar player={tour.createdBy} size={22} />
              <PlayerLink player={tour.createdBy}>{fullName(tour.createdBy)}</PlayerLink>
            </span>
          )}
        </div>

        {finished && tour.winner && (
          <div className="mb-tr-champion">
            <CrownFilled className="mb-tr-champion__icon" />
            <div>
              <span className="mb-tr-champion__label">{t('tournaments:card.champion')}</span>
              <strong className="mb-tr-champion__name">{tour.winner.teamName}</strong>
            </div>
            {myTeamIds.has(tour.winner.teamId) && <span className="mb-chip is-pending">{t('tournaments:detail.congrats')}</span>}
          </div>
        )}

        {regOpen && (
          <div className="mb-tr-hero__actions">
            <JoinPanel tour={tour} onJoin={join} joining={joining} />
            <div className="mb-tr-hero__actions-right">
              {withdrawButton}
              {tour.canManage && (
                <>
                  <Tooltip title={tour.teamCount < minTeams ? t('tournaments:detail.minTeams', { count: minTeams }) : ''}>
                    <Button type="primary" icon={<PlayCircleOutlined />} disabled={tour.teamCount < minTeams} onClick={start}>
                      {t('tournaments:detail.start')}
                    </Button>
                  </Tooltip>
                  <Button danger type="text" icon={<DeleteOutlined />} onClick={remove}>
                    {t('common:actions.delete')}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <Tabs activeKey={activeTab} onChange={setTab} className="mb-match-tabs" items={tabs} />

      <ResultModal
        fixture={resultFixture}
        knockout={knockout}
        onClose={() => setResultFixture(null)}
        onSaved={() => {
          setResultFixture(null);
          load(true);
        }}
      />
      <DateModal
        fixture={dateFixture}
        onClose={() => setDateFixture(null)}
        onSaved={() => {
          setDateFixture(null);
          load(true);
        }}
      />
    </div>
  );
}
