import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { App, Button, Card, Col, Row, Skeleton } from 'antd';
import {
  ArrowRightOutlined,
  CrownFilled,
  EnvironmentOutlined,
  FireOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  TeamOutlined,
  TrophyFilled,
  UserAddOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ACTIVITY, SOCIAL_CHANGED, socialApi } from '../../api/social';
import { matchesApi } from '../../api/matches';
import { EmptyState, PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fromNow, fullName, getCurrentUser, isPast } from '../../utils/format';
import FollowButton, { PlayerLink } from '../Social/FollowButton';
import './Feed.css';

const PAGE = 30;

const TYPE_META = {
  [ACTIVITY.MATCH_CREATED]: { icon: <PlusCircleOutlined />, className: 'is-created' },
  [ACTIVITY.JOINED_MATCH]: { icon: <ArrowRightOutlined />, className: 'is-joined' },
  [ACTIVITY.SCORED]: { icon: <FireOutlined />, className: 'is-scored' },
  [ACTIVITY.MVP_WON]: { icon: <CrownFilled />, className: 'is-mvp' },
  [ACTIVITY.TEAM_CREATED]: { icon: <TeamOutlined />, className: 'is-team' },
  [ACTIVITY.FOLLOWED]: { icon: <UserSwitchOutlined />, className: 'is-follow' },
  [ACTIVITY.TOURNAMENT_WON]: { icon: <TrophyFilled />, className: 'is-trophy' },
};

const MatchLink = ({ match }) =>
  match ? (
    <Link to={`/match-details/${match.matchId}`} className="mb-player-link">
      <strong>{match.matchName}</strong>
    </Link>
  ) : (
    <strong>bir maç</strong>
  );

// Türkçe belirtme hâli eki: Kaan'ı, Elif'i, Burcu'yu, Ömür'ü
const accusative = (name) => {
  const lower = (name || '').toLocaleLowerCase('tr');
  const vowels = lower.match(/[aeıioöuü]/g);
  const last = vowels ? vowels[vowels.length - 1] : 'e';
  const suffix = { a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' }[last];
  const endsWithVowel = /[aeıioöuü]$/.test(lower);
  return `'${endsWithVowel ? 'y' : ''}${suffix}`;
};

/** Akış içindeki küçük fikstür bileti */
function MiniFixture({ match, showJoin }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(null);
  const date = dayjs(match.matchDate);
  const past = isPast(match.matchDate);
  const hasScore = match.homeScore != null && match.awayScore != null;

  const join = async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await matchesApi.join(match.matchId);
      message.success(res?.message || 'Maça katıldın.');
      setJoined(res?.status === 2 ? 'Yedektesin' : 'Kadrodasın');
    } catch (err) {
      message.error(apiErrorMessage(err, 'Maça katılamadın.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-mini-fixture" role="button" tabIndex={0} onClick={() => navigate(`/match-details/${match.matchId}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/match-details/${match.matchId}`)}>
      <div className="mb-mini-fixture__when">
        {hasScore ? (
          <span className="mb-mini-fixture__score">
            {match.homeScore}<i>:</i>{match.awayScore}
          </span>
        ) : (
          <>
            <span className="mb-mini-fixture__dow">{date.format('ddd')}</span>
            <span className="mb-mini-fixture__day">{date.format('DD')}</span>
            <span className="mb-mini-fixture__time">{date.format('HH:mm')}</span>
          </>
        )}
      </div>
      <div className="mb-mini-fixture__body">
        <strong>{match.matchName}</strong>
        <span>
          <EnvironmentOutlined /> {match.stadiumName || 'Halı saha'} · {date.format('DD MMM, HH:mm')}
        </span>
      </div>
      {showJoin && !past && (
        joined ? (
          <span className="mb-chip is-live">{joined}</span>
        ) : (
          <Button type="primary" size="small" loading={busy} onClick={join}>
            Katıl
          </Button>
        )
      )}
    </div>
  );
}

function ActivityCard({ item, me }) {
  const meta = TYPE_META[item.type] || { icon: <ArrowRightOutlined />, className: '' };
  const actor = <PlayerLink player={item.actor} className="mb-activity__actor" />;
  const isMine = item.actor?.playerId === me?.playerId;

  let headline;
  let body = null;

  switch (item.type) {
    case ACTIVITY.MATCH_CREATED:
      headline = <>{actor} yeni bir maç kurdu</>;
      body = item.match && <MiniFixture match={item.match} showJoin={!isMine} />;
      break;
    case ACTIVITY.JOINED_MATCH:
      headline = <>{actor} <MatchLink match={item.match} /> maçının kadrosuna girdi</>;
      body = item.match && <MiniFixture match={item.match} showJoin={!isMine} />;
      break;
    case ACTIVITY.SCORED:
      headline = <>{actor}, <MatchLink match={item.match} /> maçında fileleri havalandırdı</>;
      body = (
        <div className="mb-activity__goals">
          <span className="mb-activity__ball" role="img" aria-label="gol">⚽</span>
          <span className="mb-activity__big">×{item.value || 1}</span>
          <span className="mb-activity__goals-text">
            {item.value > 2 ? 'Hat-trick!' : item.value === 2 ? 'Çift vuruş' : 'Gol'}
            {item.match && item.match.homeScore != null && (
              <small>Maç sonucu {item.match.homeScore}-{item.match.awayScore}</small>
            )}
          </span>
        </div>
      );
      break;
    case ACTIVITY.MVP_WON:
      headline = <>{actor}, <MatchLink match={item.match} /> maçının MVP'si seçildi</>;
      body = (
        <div className="mb-activity__mvp">
          <div className="mb-activity__mvp-avatar">
            <CrownFilled className="mb-activity__crown" />
            <PlayerAvatar player={item.actor} size={64} />
          </div>
          <div>
            <span className="mb-activity__mvp-label">Maçın oyuncusu</span>
            <strong>{fullName(item.actor)}</strong>
            {item.value > 0 && <small>{item.value} oy aldı</small>}
          </div>
        </div>
      );
      break;
    case ACTIVITY.TEAM_CREATED:
      headline = <>{actor} yeni bir takım kurdu</>;
      body = item.team && (
        <div className="mb-activity__team">
          <span className="mb-activity__team-logo">{(item.team.teamName || '?').charAt(0).toUpperCase()}</span>
          <strong>{item.team.teamName}</strong>
        </div>
      );
      break;
    case ACTIVITY.FOLLOWED: {
      const target = item.target;
      const targetIsMe = target?.playerId === me?.playerId;
      headline = (
        <>
          {actor}, {targetIsMe ? <strong>seni</strong> : <><PlayerLink player={target} />{accusative(fullName(target))}</>} takip etmeye başladı
        </>
      );
      body = target && !targetIsMe && (
        <div className="mb-activity__person">
          <PlayerAvatar player={target} size={40} />
          <div>
            <PlayerLink player={target} />
            <small>@{target.userName}</small>
          </div>
          <FollowButton player={target} size="small" />
        </div>
      );
      break;
    }
    case ACTIVITY.TOURNAMENT_WON:
      headline = <>{actor} bir turnuva kazandı</>;
      body = (
        <div className="mb-activity__trophy">
          <TrophyFilled />
          <div>
            <span>Şampiyon</span>
            <strong>{item.team?.teamName || fullName(item.actor)}</strong>
          </div>
        </div>
      );
      break;
    default:
      headline = <>{actor} bir şeyler yaptı</>;
  }

  return (
    <article className={`mb-activity ${meta.className}`}>
      <div className="mb-activity__rail">
        <PlayerAvatar player={item.actor} size={40} />
        <span className="mb-activity__type">{meta.icon}</span>
      </div>
      <div className="mb-activity__main">
        <div className="mb-activity__head">
          <p>{headline}</p>
          <time title={dayjs(item.createdAt).format('DD MMM YYYY, HH:mm')}>{fromNow(item.createdAt)}</time>
        </div>
        {body}
      </div>
    </article>
  );
}

function Suggestions({ items, loading, prominent }) {
  const navigate = useNavigate();
  if (loading) return <Skeleton active avatar paragraph={{ rows: 3 }} />;
  if (!items.length) return <EmptyState description="Şimdilik önerimiz yok" />;
  return (
    <div className={`mb-suggest ${prominent ? 'is-prominent' : ''}`}>
      {items.map((p) => (
        <div key={p.playerId} className="mb-suggest__row">
          <PlayerAvatar player={p} size={prominent ? 48 : 38} onClick={() => navigate(`/player/${p.playerId}`)} style={{ cursor: 'pointer' }} />
          <div className="mb-suggest__name">
            <PlayerLink player={p} />
            <small>
              {p.playedTogether > 0
                ? `${p.playedTogether} maç birlikte oynadınız`
                : p.followsMe
                ? 'Seni takip ediyor'
                : `@${p.userName}`}
            </small>
          </div>
          <FollowButton player={p} size="small" />
        </div>
      ))}
    </div>
  );
}

export default function Feed() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const me = getCurrentUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [sLoading, setSLoading] = useState(true);
  const [followingCount, setFollowingCount] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await socialApi.feed(undefined, PAGE)) || [];
      setItems(data);
      setHasMore(data.length >= PAGE);
    } catch (e) {
      message.error(apiErrorMessage(e, 'Akış yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [message]);

  const loadSide = useCallback(() => {
    socialApi
      .suggestions(5)
      .then((d) => setSuggestions(d || []))
      .catch(() => {})
      .finally(() => setSLoading(false));
    socialApi
      .following()
      .then((d) => setFollowingCount((d || []).length))
      .catch(() => setFollowingCount(null));
  }, []);

  useEffect(() => {
    load();
    loadSide();
  }, [load, loadSide]);

  // Birini takip edince takip sayısını tazele (akışı otomatik yenilemiyoruz, kullanıcı "Yenile"ye basar)
  useEffect(() => {
    const h = () =>
      socialApi
        .following()
        .then((d) => setFollowingCount((d || []).length))
        .catch(() => {});
    window.addEventListener(SOCIAL_CHANGED, h);
    return () => window.removeEventListener(SOCIAL_CHANGED, h);
  }, []);

  const loadMore = async () => {
    const last = items[items.length - 1];
    if (!last) return;
    setMore(true);
    try {
      const data = (await socialApi.feed(last.createdAt, PAGE)) || [];
      setItems((cur) => {
        const seen = new Set(cur.map((i) => i.activityId));
        return [...cur, ...data.filter((i) => !seen.has(i.activityId))];
      });
      setHasMore(data.length >= PAGE);
    } catch (e) {
      message.error(apiErrorMessage(e, 'Daha fazla yüklenemedi.'));
    } finally {
      setMore(false);
    }
  };

  const notFollowing = followingCount === 0;
  const empty = !loading && items.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Soyunma odası"
        title="Akış"
        icon={<FireOutlined />}
        subtitle="Takip ettiklerin sahada neler yapıyor, hepsi burada."
        extra={
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading && items.length > 0}>
            Yenile
          </Button>
        }
      />

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={empty ? { span: 16, offset: 4 } : 16}>
          {loading && items.length === 0 ? (
            <div className="mb-timeline">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <Skeleton active avatar paragraph={{ rows: 2 }} />
                </Card>
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="mb-feed-empty">
              <div className="mb-feed-empty__intro">
                <UserAddOutlined className="mb-feed-empty__icon" />
                <h3>{notFollowing ? 'Akışın şimdilik sessiz' : 'Henüz hareket yok'}</h3>
                <p>
                  {notFollowing
                    ? 'Birkaç oyuncuyu takip et; kurdukları maçlar, attıkları goller ve MVP ödülleri burada akmaya başlasın.'
                    : 'Takip ettiklerin maç kurdukça, gol attıkça burası dolacak. Bu arada birkaç oyuncu daha ekleyebilirsin.'}
                </p>
              </div>
              <Suggestions items={suggestions} loading={sLoading} prominent />
              <Button type="primary" block style={{ marginTop: 16 }} onClick={() => navigate('/friends?tab=discover')}>
                Daha fazla oyuncu keşfet
              </Button>
            </Card>
          ) : (
            <>
              <div className="mb-timeline">
                {items.map((it) => (
                  <ActivityCard key={it.activityId} item={it} me={me} />
                ))}
              </div>
              {hasMore && (
                <div className="mb-feed-more">
                  <Button size="large" loading={more} onClick={loadMore}>
                    Daha fazla
                  </Button>
                </div>
              )}
              {!hasMore && items.length > 5 && <div className="mb-feed-end">Hepsi bu kadar. Sahaya çıkma vakti!</div>}
            </>
          )}
        </Col>

        {!empty && (
        <Col xs={24} xl={8}>
          <div className="mb-feed-side">
            <Card
              title="Kimi takip etmeli?"
              extra={
                <Button type="link" onClick={() => navigate('/friends?tab=discover')}>
                  Keşfet
                </Button>
              }
            >
              <Suggestions items={suggestions} loading={sLoading} />
            </Card>
          </div>
        </Col>
        )}
      </Row>
    </>
  );
}
