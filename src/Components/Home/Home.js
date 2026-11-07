import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Card, Col, Input, Row, Segmented, Select, Skeleton, Space, Spin } from 'antd';
import {
  ArrowRightOutlined,
  CrownFilled,
  EnvironmentOutlined,
  FireOutlined,
  MailOutlined,
  PlusOutlined,
  RobotOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Trans, useTranslation } from 'react-i18next';
import { aiApi } from '../../api/ai';
import { matchesApi, playersApi, PARTICIPANT_STATUS } from '../../api/matches';
import { INVITES_CHANGED, invitesApi } from '../../api/social';
import { formatPrice, venuesApi } from '../../api/venues';
import { intlLocale } from '../../i18n';
import { CapacityRing, EmptyState, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fullName, isPast, mediaUrl } from '../../utils/format';
import MatchCard from '../Post/Post';
import './Home.css';

// Etiketler render sırasında çevrilir (home:filters.*, 'all' → common:all)
const FILTERS = ['upcoming', 'open', 'opponent', 'mine', 'friends', 'results', 'all'];

const sortDefault = (a, b) => {
  const pa = isPast(a.matchDate);
  const pb = isPast(b.matchDate);
  if (pa !== pb) return pa ? 1 : -1;
  return pa ? dayjs(b.matchDate).diff(a.matchDate) : dayjs(a.matchDate).diff(b.matchDate);
};

/** Sıradaki maça geri sayım */
function Countdown({ to }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(dayjs());
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 30000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(dayjs(to).diff(now, 'minute'), 0);
  const d = Math.floor(diff / 1440);
  const h = Math.floor((diff % 1440) / 60);
  const m = diff % 60;
  return (
    <div className="mb-countdown">
      {[
        [d, 'days'],
        [h, 'hours'],
        [m, 'minutes'],
      ].map(([v, l]) => (
        <div key={l}>
          <strong>{String(v).padStart(2, '0')}</strong>
          <span>{t(`home:countdown.${l}`)}</span>
        </div>
      ))}
    </div>
  );
}

const venueName = (m) => m.venue?.name || m.stadiumName || '';

function Home() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [matches, setMatches] = useState([]);
  const [deals, setDeals] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOrder, setAiOrder] = useState(null); // matchId -> { rank, message }
  const [filter, setFilter] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [stadiumFilter, setStadiumFilter] = useState();
  const [pendingInvites, setPendingInvites] = useState(0);

  const load = useCallback(async () => {
    try {
      setMatches(await matchesApi.feed());
    } catch (e) {
      message.error(apiErrorMessage(e, t('home:loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    load();
    playersApi.leaderboard(5).then(setLeaders).catch(() => {});
    venuesApi
      .list()
      .then((list) => setDeals((list || []).filter((v) => v.hasActiveCampaign)))
      .catch(() => {});
  }, [load]);

  // Bekleyen davetler bandı
  useEffect(() => {
    const loadInvites = () => invitesApi.pendingCount().then(setPendingInvites).catch(() => {});
    loadInvites();
    window.addEventListener(INVITES_CHANGED, loadInvites);
    return () => window.removeEventListener(INVITES_CHANGED, loadInvites);
  }, []);

  const sortWithAI = async () => {
    setAiLoading(true);
    try {
      const list = await aiApi.matchRecommendations();
      const order = {};
      list.forEach((r, i) => (order[r.matchId] = { rank: i, message: t(`home:ai.reasons.${r.reason}`, { ...(r.args || {}), defaultValue: '' }) }));
      setAiOrder(order);
      setFilter('upcoming');
      message.success(list.length ? t('home:ai.sorted') : t('home:ai.noSuggestions'));
    } catch (e) {
      message.error(apiErrorMessage(e, t('home:ai.failed')));
    } finally {
      setAiLoading(false);
    }
  };

  const nextMatch = useMemo(
    () =>
      matches
        .filter((m) => !isPast(m.matchDate) && (m.myStatus === PARTICIPANT_STATUS.GOING || m.myStatus === PARTICIPANT_STATUS.WAITLIST))
        .sort((a, b) => dayjs(a.matchDate).diff(b.matchDate))[0],
    [matches]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = matches.filter((m) => {
      const past = isPast(m.matchDate);
      if (filter === 'upcoming' && (past || m.isActive === 3)) return false;
      if (filter === 'open' && (past || m.isActive === 3 || m.goingCount >= m.capacity)) return false;
      if (filter === 'opponent' && (past || m.isActive === 3 || !m.lookingForOpponent)) return false;
      if (filter === 'mine' && !m.myStatus) return false;
      if (filter === 'friends' && !(m.followingGoingCount > 0)) return false;
      if (filter === 'results' && !(past && m.homeScore != null)) return false;
      if (stadiumFilter && venueName(m) !== stadiumFilter) return false;
      if (q && !`${m.matchName} ${venueName(m)} ${m.venue?.pitchName || ''} ${m.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
    list = list.slice().sort(sortDefault);
    if (aiOrder) list.sort((a, b) => (aiOrder[a.matchId]?.rank ?? 1e6) - (aiOrder[b.matchId]?.rank ?? 1e6));
    return list;
  }, [matches, filter, search, stadiumFilter, aiOrder]);

  const stadiumOptions = useMemo(
    () =>
      [...new Set(matches.map(venueName).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, intlLocale()))
        .map((n) => ({ value: n, label: n })),
    [matches]
  );

  const upcoming = matches.filter((m) => !isPast(m.matchDate) && m.isActive !== 3);
  const openSpots = upcoming.reduce((s, m) => s + Math.max(m.capacity - m.goingCount, 0), 0);
  const thisWeek = upcoming.filter((m) => dayjs(m.matchDate).isBefore(dayjs().add(7, 'day'))).length;
  const filterOptions = FILTERS.map((value) => ({ value, label: value === 'all' ? t('common:all') : t(`home:filters.${value}`) }));

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="mb-hero mb-pitch-bg">
        <div className="mb-hero__left">
          <span className="mb-hero__eyebrow">
            <span className="mb-dot" /> {t('home:hero.thisWeek', { count: thisWeek })}
          </span>
          <h1 className="mb-hero__title">
            <Trans i18nKey="home:hero.title" components={{ br: <br />, em: <em /> }} />
          </h1>
          <p className="mb-hero__text">
            {openSpots > 0 ? t('home:hero.openSpots', { count: openSpots }) : ''}
            {t('home:hero.text')}
          </p>
          <Space wrap>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/matches/new')}>
              {t('home:hero.createMatch')}
            </Button>
            <Button size="large" icon={<SearchOutlined />} onClick={() => setFilter('open')} className="mb-ghost-btn">
              {t('home:hero.seeOpen')}
            </Button>
          </Space>
        </div>

        <div className="mb-hero__right">
          {nextMatch ? (
            <div className="mb-next" onClick={() => navigate(`/match-details/${nextMatch.matchId}`)}>
              <span className="mb-next__label">{t('home:next.label')}</span>
              <h3>{nextMatch.matchName}</h3>
              <div className="mb-next__meta">
                <EnvironmentOutlined /> {venueName(nextMatch)} · {dayjs(nextMatch.matchDate).format('DD MMM, HH:mm')}
              </div>
              <Countdown to={nextMatch.matchDate} />
              <div className="mb-next__footer">
                <CapacityRing going={nextMatch.goingCount} capacity={nextMatch.capacity} size={40} />
                <span className="mb-next__go">
                  {nextMatch.myStatus === PARTICIPANT_STATUS.WAITLIST ? t('home:next.waitlisted') : t('home:next.matchCenter')} <ArrowRightOutlined />
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-next is-empty">
              <span className="mb-next__label">{t('home:next.label')}</span>
              <h3>{t('home:next.emptyTitle')}</h3>
              <p>{t('home:next.emptyText')}</p>
              <Button type="primary" onClick={() => setFilter('open')}>
                {t('home:next.findMatch')}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Kampanyalı tesisler ---------- */}
      {deals.length > 0 && (
        <section className="mb-deals">
          <div className="mb-section-head">
            <h2 className="mb-section-title">
              <FireOutlined style={{ color: 'var(--mb-gold)' }} /> {t('home:deals.title')}
            </h2>
            <Button type="link" onClick={() => navigate('/venues')}>
              {t('home:deals.allVenues')} <ArrowRightOutlined />
            </Button>
          </div>
          <div className="mb-deals__strip">
            {deals.map((v) => (
              <button type="button" key={v.stadiumId} className="mb-deal" onClick={() => navigate(`/venues/${v.stadiumId}`)}>
                <span className="mb-deal__cover">
                  {v.coverPhotoUrl ? <img src={mediaUrl(v.coverPhotoUrl, 'md')} alt="" loading="lazy" decoding="async" /> : <span className="mb-deal__ph mb-pitch-bg" />}
                  <span className="mb-deal__badge">
                    <FireOutlined /> {t('home:deals.badge')}
                  </span>
                </span>
                <span className="mb-deal__body">
                  <strong>{v.name}</strong>
                  <small>{[v.district, v.city].filter(Boolean).join(', ')}</small>
                  {v.minPrice != null && (
                    <em>
                      <Trans i18nKey="home:deals.fromPrice" values={{ price: formatPrice(v.minPrice) }} components={{ s: <span /> }} />
                    </em>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {pendingInvites > 0 && (
        <button type="button" className="mb-invite-banner" onClick={() => navigate('/invites')}>
          <MailOutlined className="mb-invite-banner__icon" />
          <span>
            <Trans i18nKey="home:invites.banner" count={pendingInvites} components={{ b: <strong /> }} />
          </span>
          <span className="mb-invite-banner__go">
            {t('home:invites.go')} <ArrowRightOutlined />
          </span>
        </button>
      )}

      <Row gutter={[24, 24]}>
        {/* ---------- Fikstür ---------- */}
        <Col xs={24} xl={16}>
          <div className="mb-section-head">
            <h2 className="mb-section-title">{t('home:feed.title')}</h2>
            <Button icon={<RobotOutlined />} loading={aiLoading} onClick={sortWithAI} className="mb-ai-btn">
              {t('home:ai.sortButton')}
            </Button>
          </div>

          <div className="mb-filters">
            <Segmented options={filterOptions} value={filter} onChange={setFilter} />
            <Space wrap className="mb-filters__search">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={t('home:feed.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 200 }}
              />
              <Select
                allowClear
                placeholder={t('home:feed.venuePlaceholder')}
                value={stadiumFilter}
                onChange={setStadiumFilter}
                style={{ width: 180 }}
                options={stadiumOptions}
              />
            </Space>
          </div>

          {aiOrder && (
            <div className="mb-ai-banner">
              <ThunderboltOutlined /> {t('home:ai.banner')}
              <Button type="link" size="small" onClick={() => setAiOrder(null)}>
                {t('home:ai.reset')}
              </Button>
            </div>
          )}

          <Spin spinning={aiLoading} tip={t('home:ai.sorting')}>
            <div className="mb-feed">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <Card key={i}>
                    <Skeleton active avatar paragraph={{ rows: 2 }} />
                  </Card>
                ))
              ) : visible.length === 0 ? (
                <Card>
                  <EmptyState
                    description={
                      filter === 'friends' ? t('home:feed.emptyFriends') : t('home:feed.empty')
                    }
                  >
                    {filter === 'friends' && (
                      <Button onClick={() => navigate('/friends?tab=discover')} style={{ marginRight: 8 }}>
                        {t('home:feed.discoverPlayers')}
                      </Button>
                    )}
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/matches/new')}>
                      {t('home:hero.createMatch')}
                    </Button>
                  </EmptyState>
                </Card>
              ) : (
                visible.map((m) => (
                  <div key={m.matchId}>
                    {aiOrder?.[m.matchId]?.message && (
                      <div className="mb-ai-tip">
                        <RobotOutlined /> {aiOrder[m.matchId].message}
                      </div>
                    )}
                    <MatchCard match={m} onChanged={load} />
                  </div>
                ))
              )}
            </div>
          </Spin>
        </Col>

        {/* ---------- Yan sütun ---------- */}
        <Col xs={24} xl={8}>
          <div className="mb-side">
            <Card
              title={
                <span>
                  <TrophyOutlined style={{ color: 'var(--mb-gold)', marginRight: 8 }} />
                  {t('home:leaders.title')}
                </span>
              }
              extra={
                <Button type="link" onClick={() => navigate('/leaderboard')}>
                  {t('common:all')}
                </Button>
              }
            >
              {leaders.length === 0 ? (
                <EmptyState description={t('home:leaders.empty')} />
              ) : (
                <ol className="mb-leaders">
                  {leaders.map((l, i) => (
                    <li key={l.player.playerId}>
                      <span className={`mb-leaders__rank r${i + 1}`}>{i + 1}</span>
                      <PlayerAvatar player={l.player} size={36} />
                      <div className="mb-leaders__name">
                        <strong>{fullName(l.player)}</strong>
                        <span>
                          {t('home:leaders.matches', { count: l.matchesPlayed })} · {t('home:leaders.goals', { count: l.goals })}{' '}
                          {l.mvpCount > 0 && <><CrownFilled style={{ color: 'var(--mb-gold)' }} /> {l.mvpCount}</>}
                        </span>
                      </div>
                      <span className="mb-leaders__score">{l.userScore}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <div className="mb-promo" onClick={() => navigate('/teamAICreate')}>
              <ThunderboltOutlined className="mb-promo__icon" />
              <div>
                <h4>{t('home:promo.aiTeamTitle')}</h4>
                <p>{t('home:promo.aiTeamText')}</p>
              </div>
              <ArrowRightOutlined />
            </div>
            <div className="mb-promo is-blue" onClick={() => navigate('/venues')}>
              <EnvironmentOutlined className="mb-promo__icon" />
              <div>
                <h4>{t('home:promo.venuesTitle')}</h4>
                <p>{t('home:promo.venuesText')}</p>
              </div>
              <ArrowRightOutlined />
            </div>
          </div>
        </Col>
      </Row>

    </>
  );
}

export default Home;
