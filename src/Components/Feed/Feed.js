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
import { Trans, useTranslation } from 'react-i18next';
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

function MatchLink({ match }) {
  const { t } = useTranslation();
  return match ? (
    <Link to={`/match-details/${match.matchId}`} className="mb-player-link">
      <strong>{match.matchName}</strong>
    </Link>
  ) : (
    <strong>{t('social:feed.aMatch')}</strong>
  );
}

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
  const { t } = useTranslation();
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
      message.success(res?.message || t('social:feed.fixture.joined'));
      setJoined(res?.status === 2 ? t('social:feed.fixture.onBench') : t('social:feed.fixture.inSquad'));
    } catch (err) {
      message.error(apiErrorMessage(err, t('social:feed.fixture.joinFailed')));
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
          <EnvironmentOutlined /> {match.stadiumName || t('social:feed.fixture.defaultVenue')} · {date.format('DD MMM, HH:mm')}
        </span>
      </div>
      {showJoin && !past && (
        joined ? (
          <span className="mb-chip is-live">{joined}</span>
        ) : (
          <Button type="primary" size="small" loading={busy} onClick={join}>
            {t('social:feed.fixture.join')}
          </Button>
        )
      )}
    </div>
  );
}

function ActivityCard({ item, me }) {
  const { t } = useTranslation();
  const meta = TYPE_META[item.type] || { icon: <ArrowRightOutlined />, className: '' };
  const actor = <PlayerLink player={item.actor} className="mb-activity__actor" />;
  const isMine = item.actor?.playerId === me?.playerId;
  // Etkinlik cümleleri: <actor/> ve <match/> yer tutucuları çeviri metnine yerleştirilir
  const sentence = (key, extraComponents, values) => (
    <Trans
      i18nKey={`social:feed.activity.${key}`}
      values={values}
      components={{ actor, match: <MatchLink match={item.match} />, ...extraComponents }}
    />
  );

  let headline;
  let body = null;

  switch (item.type) {
    case ACTIVITY.MATCH_CREATED:
      headline = sentence('matchCreated');
      body = item.match && <MiniFixture match={item.match} showJoin={!isMine && !item.match.inMatch} />;
      break;
    case ACTIVITY.JOINED_MATCH:
      headline = sentence('joinedMatch');
      body = item.match && <MiniFixture match={item.match} showJoin={!isMine && !item.match.inMatch} />;
      break;
    case ACTIVITY.SCORED:
      headline = sentence('scored');
      body = (
        <div className="mb-activity__goals">
          <span className="mb-activity__ball" role="img" aria-label={t('social:feed.goalAria')}>⚽</span>
          <span className="mb-activity__big">×{item.value || 1}</span>
          <span className="mb-activity__goals-text">
            {item.value > 2 ? t('social:feed.hatTrick') : item.value === 2 ? t('social:feed.brace') : t('social:feed.goal')}
            {item.match && item.match.homeScore != null && (
              <small>{t('social:feed.matchResult', { home: item.match.homeScore, away: item.match.awayScore })}</small>
            )}
          </span>
        </div>
      );
      break;
    case ACTIVITY.MVP_WON:
      headline = sentence('mvpWon');
      body = (
        <div className="mb-activity__mvp">
          <div className="mb-activity__mvp-avatar">
            <CrownFilled className="mb-activity__crown" />
            <PlayerAvatar player={item.actor} size={64} />
          </div>
          <div>
            <span className="mb-activity__mvp-label">{t('social:feed.playerOfTheMatch')}</span>
            <strong>{fullName(item.actor)}</strong>
            {item.value > 0 && <small>{t('social:feed.votesReceived', { count: item.value })}</small>}
          </div>
        </div>
      );
      break;
    case ACTIVITY.TEAM_CREATED:
      headline = sentence('teamCreated');
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
      headline = targetIsMe
        ? sentence('followedYou', { b: <strong /> })
        : sentence('followed', { target: <PlayerLink player={target} /> }, { suffix: accusative(fullName(target)) });
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
      headline = sentence('tournamentWon');
      body = (
        <div className="mb-activity__trophy">
          <TrophyFilled />
          <div>
            <span>{t('social:feed.champion')}</span>
            <strong>{item.team?.teamName || fullName(item.actor)}</strong>
          </div>
        </div>
      );
      break;
    default:
      headline = sentence('default');
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
  const { t } = useTranslation();
  if (loading) return <Skeleton active avatar paragraph={{ rows: 3 }} />;
  if (!items.length) return <EmptyState description={t('social:feed.noSuggestions')} />;
  return (
    <div className={`mb-suggest ${prominent ? 'is-prominent' : ''}`}>
      {items.map((p) => (
        <div key={p.playerId} className="mb-suggest__row">
          <PlayerAvatar player={p} size={prominent ? 48 : 38} onClick={() => navigate(`/player/${p.playerId}`)} style={{ cursor: 'pointer' }} />
          <div className="mb-suggest__name">
            <PlayerLink player={p} />
            <small>
              {p.playedTogether > 0
                ? t('social:feed.playedTogether', { count: p.playedTogether })
                : p.followsMe
                ? t('social:friends.followsYou')
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
  const { t } = useTranslation();
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
      message.error(apiErrorMessage(e, t('social:feed.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

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
      message.error(apiErrorMessage(e, t('social:feed.loadMoreFailed')));
    } finally {
      setMore(false);
    }
  };

  const notFollowing = followingCount === 0;
  const empty = !loading && items.length === 0;

  return (
    <>
      <PageHeader
        eyebrow={t('social:feed.eyebrow')}
        title={t('social:feed.title')}
        icon={<FireOutlined />}
        subtitle={t('social:feed.subtitle')}
        extra={
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading && items.length > 0}>
            {t('common:actions.refresh')}
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
                <h3>{notFollowing ? t('social:feed.empty.notFollowingTitle') : t('social:feed.empty.quietTitle')}</h3>
                <p>
                  {notFollowing
                    ? t('social:feed.empty.notFollowingText')
                    : t('social:feed.empty.quietText')}
                </p>
              </div>
              <Suggestions items={suggestions} loading={sLoading} prominent />
              <Button type="primary" block style={{ marginTop: 16 }} onClick={() => navigate('/friends?tab=discover')}>
                {t('social:feed.discoverMore')}
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
                    {t('social:feed.loadMore')}
                  </Button>
                </div>
              )}
              {!hasMore && items.length > 5 && <div className="mb-feed-end">{t('social:feed.end')}</div>}
            </>
          )}
        </Col>

        {!empty && (
        <Col xs={24} xl={8}>
          <div className="mb-feed-side">
            <Card
              title={t('social:feed.whoToFollow')}
              extra={
                <Button type="link" onClick={() => navigate('/friends?tab=discover')}>
                  {t('social:friends.tabs.discover')}
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
