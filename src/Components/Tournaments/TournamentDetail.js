import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { App, Avatar, Button, Dropdown, Result, Select, Skeleton, Table, Tabs, Tooltip } from 'antd';
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
        <strong>{team ? team.teamName : bye ? 'Bay' : 'Belli değil'}</strong>
        {isWinner && cls === 'is-home' && <CrownFilled className="mb-fx-row__crown" />}
      </div>
    );
  };

  let center;
  if (bye) center = <span className="mb-fx-row__bye">Bay geçti</span>;
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
        <CalendarOutlined /> {f.matchDate ? formatDate(f.matchDate) : 'Tarih belirlenmedi'}
        {played && w && f.homeScore === f.awayScore && <span className="mb-fx-row__pen">Penaltılarla</span>}
      </div>
      <div className="mb-fx-row__board">
        {side(f.homeTeam, 'is-home')}
        <div className="mb-fx-row__center">{center}</div>
        {side(f.awayTeam, 'is-away')}
      </div>
      {showActions && (
        <div className="mb-fx-row__actions">
          <Tooltip title={bothKnown ? '' : 'İki takım da belli olunca sonuç girebilirsin'}>
            <Button size="small" type={played ? 'default' : 'primary'} disabled={!bothKnown} onClick={() => onResult(f)}>
              {played ? 'Sonucu düzelt' : 'Sonuç gir'}
            </Button>
          </Tooltip>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onDate(f)}>
            Tarihi değiştir
          </Button>
        </div>
      )}
    </div>
  );
}

function FixturesTab({ t, myTeamIds, onResult, onDate }) {
  const rounds = useMemo(() => {
    const map = new Map();
    [...(t.fixtures || [])]
      .sort((a, b) => a.round - b.round || a.position - b.position)
      .forEach((f) => {
        if (!map.has(f.round)) map.set(f.round, []);
        map.get(f.round).push(f);
      });
    return [...map.entries()];
  }, [t.fixtures]);

  if (!rounds.length) {
    return (
      <EmptyState
        description={
          t.status === TOURNAMENT_STATUS.REGISTRATION
            ? 'Fikstür, turnuva başladığında otomatik oluşturulur.'
            : 'Fikstür bulunamadı.'
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
              <h3>{roundName(t, round)}</h3>
              {done && <span className="mb-chip is-done">Tamamlandı</span>}
            </header>
            <div className="mb-fx-round__list">
              {list.map((f) => (
                <FixtureRow
                  key={f.fixtureId}
                  f={f}
                  myTeamIds={myTeamIds}
                  canManage={t.canManage}
                  ongoing={t.status === TOURNAMENT_STATUS.ONGOING}
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
function StandingsTab({ t, myTeamIds }) {
  const rows = (t.standings || []).map((s, i) => ({ ...s, rank: i + 1 }));
  if (!rows.length) return <EmptyState description="Puan tablosu, turnuva başlayınca oluşur." />;

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
      title: 'Takım',
      key: 'team',
      render: (_, s) => (
        <span className="mb-st-team">
          <strong>{s.team?.teamName}</strong>
          {myTeamIds.has(s.team?.teamId) && <span className="mb-chip is-approved">Senin</span>}
        </span>
      ),
    },
    num('played', 'O'),
    num('won', 'G'),
    num('drawn', 'B'),
    num('lost', 'M'),
    num('goalsFor', 'A', { responsive: ['sm'] }),
    num('goalsAgainst', 'Y', { responsive: ['sm'] }),
    num('goalDiff', 'AV', { render: (v) => (v > 0 ? `+${v}` : v) }),
    num('points', 'P', { width: 60, render: (v) => <span className="mb-st-points">{v}</span> }),
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
      <p className="mb-tr-legend">O: oynanan · G: galibiyet · B: beraberlik · M: mağlubiyet · A: atılan · Y: yenilen · AV: averaj · P: puan</p>
    </div>
  );
}

/* ---------------- Takımlar ---------------- */
function TeamsTab({ t, onWithdraw }) {
  const teams = t.teams || [];
  if (!teams.length) {
    return <EmptyState description="Henüz kayıtlı takım yok. İlk takım senin olsun!" />;
  }
  const regOpen = t.status === TOURNAMENT_STATUS.REGISTRATION;
  return (
    <div className="mb-tm-grid">
      {teams.map((team) => {
        const isWinner = t.winner?.teamId === team.teamId;
        return (
          <div key={team.teamId} className={`mb-tm-card ${team.isMine ? 'is-mine' : ''} ${isWinner ? 'is-winner' : ''}`}>
            <div className="mb-tm-card__head">
              <span className="mb-tm-card__badge">{(team.teamName || '?').charAt(0).toUpperCase()}</span>
              <div className="mb-tm-card__title">
                <strong>{team.teamName}</strong>
                <small>
                  <TeamOutlined /> {team.memberCount ?? team.members?.length ?? 0} oyuncu
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
              {team.isMine ? <span className="mb-chip is-approved">Senin takımın</span> : <span />}
              {regOpen && (team.isMine || t.canManage) && (
                <Button size="small" type="text" danger icon={<LogoutOutlined />} onClick={() => onWithdraw(team)}>
                  Kaydı çek
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
function JoinPanel({ t, onJoin, joining }) {
  const [teamId, setTeamId] = useState();
  const eligible = useMemo(() => t.myEligibleTeams || [], [t.myEligibleTeams]);
  const full = t.maxTeams && t.teamCount >= t.maxTeams;

  useEffect(() => {
    setTeamId(eligible.length === 1 ? eligible[0].teamId : undefined);
  }, [eligible]);

  if (full) return <span className="mb-tr-hint">Kontenjan doldu, yeni takım alınmıyor.</span>;

  if (!eligible.length) {
    if (t.myTeamIds?.length) return null;
    return (
      <div className="mb-tr-join is-empty">
        <span className="mb-tr-hint">Katılmak için bir takımın olmalı.</span>
        <Link to="/create-team">
          <Button icon={<UsergroupAddOutlined />}>Takım kur</Button>
        </Link>
        <Link to="/teamAICreate">
          <Button icon={<RobotOutlined />}>AI ile dengeli takım kur</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-tr-join">
      <Select
        placeholder="Takımını seç"
        value={teamId}
        onChange={setTeamId}
        style={{ minWidth: 200 }}
        options={eligible.map((x) => ({ value: x.teamId, label: x.teamName }))}
      />
      <Button type="primary" icon={<UsergroupAddOutlined />} disabled={!teamId} loading={joining} onClick={() => onJoin(teamId)}>
        Takımımla katıl
      </Button>
    </div>
  );
}

/* ---------------- Sayfa ---------------- */
export default function TournamentDetail() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();

  const [t, setT] = useState(null);
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
        setT(d);
        setNotFound(!d);
      } catch (e) {
        if (e?.response?.status === 404) setNotFound(true);
        else message.error(apiErrorMessage(e, 'Turnuva yüklenemedi.'));
      } finally {
        setLoading(false);
      }
    },
    [tournamentId, message]
  );

  useEffect(() => {
    setTab(undefined);
    load();
  }, [load]);

  const myTeamIds = useMemo(
    () => new Set([...(t?.myTeamIds || []), ...(t?.teams || []).filter((x) => x.isMine).map((x) => x.teamId)]),
    [t]
  );

  if (loading && !t) {
    return (
      <div className="mb-tr-page">
        <Skeleton.Node active style={{ width: '100%', height: 260, borderRadius: 24 }} />
        <Skeleton active paragraph={{ rows: 6 }} style={{ marginTop: 24 }} />
      </div>
    );
  }

  if (notFound || !t) {
    return (
      <Result
        status="404"
        title="Turnuva bulunamadı"
        subTitle="Silinmiş ya da hiç var olmamış olabilir."
        extra={
          <Button type="primary" onClick={() => navigate('/tournaments')}>
            Turnuvalara dön
          </Button>
        }
      />
    );
  }

  const regOpen = t.status === TOURNAMENT_STATUS.REGISTRATION;
  const finished = t.status === TOURNAMENT_STATUS.FINISHED;
  const league = isLeague(t);
  const knockout = isKnockout(t);
  const defaultTab = regOpen ? 'teams' : 'fixtures';
  const activeTab = tab || defaultTab;
  const myRegistered = (t.teams || []).filter((x) => x.isMine);
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
    const ok = await run(() => tournamentsApi.registerTeam(t.tournamentId, teamId), 'Takımın turnuvaya kaydoldu!', 'Takım kaydedilemedi.');
    setJoining(false);
    if (ok) {
      setTab('teams');
      load(true);
    }
  };

  const withdraw = (team) =>
    modal.confirm({
      title: `${team.teamName} turnuvadan çekilsin mi?`,
      content: 'Kayıt açık olduğu sürece tekrar katılabilirsin.',
      okText: 'Kaydı çek',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        if (await run(() => tournamentsApi.withdrawTeam(t.tournamentId, team.teamId), 'Takım turnuvadan çekildi.', 'Takım çekilemedi.')) load(true);
      },
    });

  const start = () =>
    modal.confirm({
      title: 'Turnuvayı başlatalım mı?',
      width: 480,
      content: (
        <div className="mb-tr-confirm">
          <p>Başlattığında:</p>
          <ul>
            <li>Kayıtlar kapanır, yeni takım katılamaz.</li>
            {league ? (
              <li>Herkesin herkesle bir kez oynadığı lig fikstürü oluşturulur; haftalar 7 gün arayla, başlangıç saatinde oynanır.</li>
            ) : (
              <li>Takımlar rastgele eşleşir ve eleme ağacı kurulur; eksik yerlerde takımlar bay geçer.</li>
            )}
            <li>Kayıtlı takımların tüm oyuncularına bildirim gider.</li>
          </ul>
          <p>
            Şu an <strong>{t.teamCount}</strong> takım kayıtlı.
          </p>
        </div>
      ),
      okText: 'Başlat',
      cancelText: 'Vazgeç',
      onOk: async () => {
        if (await run(() => tournamentsApi.start(t.tournamentId), 'Turnuva başladı, bol şans!', 'Turnuva başlatılamadı.')) {
          setTab('fixtures');
          load(true);
        }
      },
    });

  const remove = () =>
    modal.confirm({
      title: 'Turnuva silinsin mi?',
      content: 'Bu işlem geri alınamaz; kayıtlı takımların kaydı da silinir.',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        if (await run(() => tournamentsApi.remove(t.tournamentId), 'Turnuva silindi.', 'Turnuva silinemedi.')) navigate('/tournaments');
      },
    });

  const withdrawButton =
    regOpen && myRegistered.length > 0 ? (
      myRegistered.length === 1 ? (
        <Button danger icon={<LogoutOutlined />} onClick={() => withdraw(myRegistered[0])}>
          Takımını çek
        </Button>
      ) : (
        <Dropdown
          menu={{
            items: myRegistered.map((x) => ({ key: x.teamId, label: x.teamName, onClick: () => withdraw(x) })),
          }}
        >
          <Button danger icon={<LogoutOutlined />}>
            Takımını çek
          </Button>
        </Dropdown>
      )
    ) : null;

  const tabs = [
    {
      key: 'fixtures',
      label: 'Fikstür',
      children: (
        <FixturesTab t={t} myTeamIds={myTeamIds} onResult={setResultFixture} onDate={setDateFixture} />
      ),
    },
  ];
  if (league) {
    tabs.push({ key: 'standings', label: 'Puan tablosu', children: <StandingsTab t={t} myTeamIds={myTeamIds} /> });
  }
  if (knockout) {
    tabs.push({
      key: 'bracket',
      label: 'Ağaç',
      children: t.fixtures?.length ? (
        <Bracket tournament={t} />
      ) : (
        <EmptyState description="Eleme ağacı, turnuva başladığında kurulur." />
      ),
    });
  }
  tabs.push({
    key: 'teams',
    label: `Takımlar (${t.teams?.length ?? t.teamCount ?? 0})`,
    children: <TeamsTab t={t} onWithdraw={withdraw} />,
  });

  return (
    <div className="mb-tr-page">
      <section className="mb-pitch-bg mb-tr-hero">
        <div className="mb-tr-hero__top">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/tournaments')} className="mb-ghost-link">
            Turnuvalar
          </Button>
          <div className="mb-tr-hero__chips">
            <FormatChip format={t.format} />
            <TournamentStatusChip status={t.status} />
          </div>
        </div>

        <h1 className="mb-tr-hero__title">{t.name}</h1>
        {t.description && <p className="mb-tr-hero__desc">{t.description}</p>}

        <div className="mb-tr-hero__meta">
          <span>
            <CalendarOutlined /> {formatDateTime(t.startDate)}
          </span>
          <span>
            <EnvironmentOutlined /> {t.stadium?.stadiumName || 'Saha belirlenmedi'}
          </span>
          <span>
            <TeamOutlined /> {t.teamCount ?? 0}/{t.maxTeams} takım
          </span>
          {t.createdBy && (
            <span className="mb-tr-hero__creator">
              <PlayerAvatar player={t.createdBy} size={22} />
              <PlayerLink player={t.createdBy}>{fullName(t.createdBy)}</PlayerLink>
            </span>
          )}
        </div>

        {finished && t.winner && (
          <div className="mb-tr-champion">
            <CrownFilled className="mb-tr-champion__icon" />
            <div>
              <span className="mb-tr-champion__label">Şampiyon</span>
              <strong className="mb-tr-champion__name">{t.winner.teamName}</strong>
            </div>
            {myTeamIds.has(t.winner.teamId) && <span className="mb-chip is-pending">Tebrikler, kupa sizin!</span>}
          </div>
        )}

        {regOpen && (
          <div className="mb-tr-hero__actions">
            <JoinPanel t={t} onJoin={join} joining={joining} />
            <div className="mb-tr-hero__actions-right">
              {withdrawButton}
              {t.canManage && (
                <>
                  <Tooltip title={t.teamCount < minTeams ? `Başlatmak için en az ${minTeams} takım gerekli` : ''}>
                    <Button type="primary" icon={<PlayCircleOutlined />} disabled={t.teamCount < minTeams} onClick={start}>
                      Turnuvayı başlat
                    </Button>
                  </Tooltip>
                  <Button danger type="text" icon={<DeleteOutlined />} onClick={remove}>
                    Sil
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
