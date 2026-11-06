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
import { aiFetch, AI_BASE_URL } from '../../api/config';
import { matchesApi, playersApi, PARTICIPANT_STATUS } from '../../api/matches';
import { INVITES_CHANGED, invitesApi } from '../../api/social';
import { formatPrice, venuesApi } from '../../api/venues';
import { CapacityRing, EmptyState, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fileUrl, fullName, getCurrentUser, isPast } from '../../utils/format';
import MatchCard from '../Post/Post';
import './Home.css';

const FILTERS = [
  { label: 'Yaklaşan', value: 'upcoming' },
  { label: 'Kadrosu eksik', value: 'open' },
  { label: 'Rakip arayanlar', value: 'opponent' },
  { label: 'Maçlarım', value: 'mine' },
  { label: 'Arkadaşlarım', value: 'friends' },
  { label: 'Sonuçlar', value: 'results' },
  { label: 'Tümü', value: 'all' },
];

const sortDefault = (a, b) => {
  const pa = isPast(a.matchDate);
  const pb = isPast(b.matchDate);
  if (pa !== pb) return pa ? 1 : -1;
  return pa ? dayjs(b.matchDate).diff(a.matchDate) : dayjs(a.matchDate).diff(b.matchDate);
};

/** Sıradaki maça geri sayım */
function Countdown({ to }) {
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
        [d, 'gün'],
        [h, 'saat'],
        [m, 'dk'],
      ].map(([v, l]) => (
        <div key={l}>
          <strong>{String(v).padStart(2, '0')}</strong>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

const venueName = (m) => m.venue?.name || m.stadiumName || '';

function Home() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const me = getCurrentUser();

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
      message.error(apiErrorMessage(e, 'Maçlar yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [message]);

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
      const res = await aiFetch(AI_BASE_URL, `/sort-matches?playerId=${me.playerId}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Sıralama başarısız oldu.');
      const order = {};
      (data.matches || []).forEach((m, i) => (order[m.matchId] = { rank: i, message: m.personalizedMessage }));
      setAiOrder(order);
      setFilter('upcoming');
      message.success('Maçlar sana göre sıralandı.');
    } catch (e) {
      message.error(e.message === 'Failed to fetch' ? 'Yapay zeka servisine ulaşılamadı.' : e.message);
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
        .sort((a, b) => a.localeCompare(b, 'tr'))
        .map((n) => ({ value: n, label: n })),
    [matches]
  );

  const upcoming = matches.filter((m) => !isPast(m.matchDate) && m.isActive !== 3);
  const openSpots = upcoming.reduce((s, m) => s + Math.max(m.capacity - m.goingCount, 0), 0);

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="mb-hero mb-pitch-bg">
        <div className="mb-hero__left">
          <span className="mb-hero__eyebrow">
            <span className="mb-dot" /> Bu hafta {upcoming.filter((m) => dayjs(m.matchDate).isBefore(dayjs().add(7, 'day'))).length} maç oynanıyor
          </span>
          <h1 className="mb-hero__title">
            Sahaya çık,
            <br />
            <em>kadroyu tamamla.</em>
          </h1>
          <p className="mb-hero__text">
            {openSpots > 0 ? `Şu an ${openSpots} oyunculuk boş yer var. ` : ''}Maçını kur, takımını topla, maçın yıldızı sen ol.
          </p>
          <Space wrap>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/matches/new')}>
              Maç oluştur
            </Button>
            <Button size="large" icon={<SearchOutlined />} onClick={() => setFilter('open')} className="mb-ghost-btn">
              Eksik kadroları gör
            </Button>
          </Space>
        </div>

        <div className="mb-hero__right">
          {nextMatch ? (
            <div className="mb-next" onClick={() => navigate(`/match-details/${nextMatch.matchId}`)}>
              <span className="mb-next__label">Sıradaki maçın</span>
              <h3>{nextMatch.matchName}</h3>
              <div className="mb-next__meta">
                <EnvironmentOutlined /> {venueName(nextMatch)} · {dayjs(nextMatch.matchDate).format('DD MMM, HH:mm')}
              </div>
              <Countdown to={nextMatch.matchDate} />
              <div className="mb-next__footer">
                <CapacityRing going={nextMatch.goingCount} capacity={nextMatch.capacity} size={40} />
                <span className="mb-next__go">
                  {nextMatch.myStatus === PARTICIPANT_STATUS.WAITLIST ? 'Yedek listesindesin' : 'Maç merkezi'} <ArrowRightOutlined />
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-next is-empty">
              <span className="mb-next__label">Sıradaki maçın</span>
              <h3>Henüz bir maça yazılmadın</h3>
              <p>Aşağıdan kadrosu eksik bir maç bul ya da kendi maçını kur.</p>
              <Button type="primary" onClick={() => setFilter('open')}>
                Maç bul
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
              <FireOutlined style={{ color: 'var(--mb-gold)' }} /> Kampanyalı tesisler
            </h2>
            <Button type="link" onClick={() => navigate('/venues')}>
              Tüm tesisler <ArrowRightOutlined />
            </Button>
          </div>
          <div className="mb-deals__strip">
            {deals.map((v) => (
              <button type="button" key={v.stadiumId} className="mb-deal" onClick={() => navigate(`/venues/${v.stadiumId}`)}>
                <span className="mb-deal__cover">
                  {v.coverPhotoUrl ? <img src={fileUrl(v.coverPhotoUrl)} alt="" loading="lazy" /> : <span className="mb-deal__ph mb-pitch-bg" />}
                  <span className="mb-deal__badge">
                    <FireOutlined /> Kampanya
                  </span>
                </span>
                <span className="mb-deal__body">
                  <strong>{v.name}</strong>
                  <small>{[v.district, v.city].filter(Boolean).join(', ')}</small>
                  {v.minPrice != null && (
                    <em>
                      {formatPrice(v.minPrice)}
                      <span>'den /saat</span>
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
            <strong>{pendingInvites} davetin var</strong> · Arkadaşların seni sahaya çağırıyor
          </span>
          <span className="mb-invite-banner__go">
            Davetlere bak <ArrowRightOutlined />
          </span>
        </button>
      )}

      <Row gutter={[24, 24]}>
        {/* ---------- Fikstür ---------- */}
        <Col xs={24} xl={16}>
          <div className="mb-section-head">
            <h2 className="mb-section-title">Fikstür</h2>
            <Button icon={<RobotOutlined />} loading={aiLoading} onClick={sortWithAI} className="mb-ai-btn">
              Bana göre sırala
            </Button>
          </div>

          <div className="mb-filters">
            <Segmented options={FILTERS} value={filter} onChange={setFilter} />
            <Space wrap>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Maç veya saha ara"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 200 }}
              />
              <Select
                allowClear
                placeholder="Tüm halı sahalar"
                value={stadiumFilter}
                onChange={setStadiumFilter}
                style={{ width: 180 }}
                options={stadiumOptions}
              />
            </Space>
          </div>

          {aiOrder && (
            <div className="mb-ai-banner">
              <ThunderboltOutlined /> Liste yapay zeka tarafından senin geçmişine göre sıralandı.
              <Button type="link" size="small" onClick={() => setAiOrder(null)}>
                Varsayılana dön
              </Button>
            </div>
          )}

          <Spin spinning={aiLoading} tip="Maçlar sana göre sıralanıyor…">
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
                      filter === 'friends' ? 'Takip ettiklerinin katıldığı bir maç yok. Daha çok oyuncu takip et!' : 'Bu filtrede maç yok'
                    }
                  >
                    {filter === 'friends' && (
                      <Button onClick={() => navigate('/friends?tab=discover')} style={{ marginRight: 8 }}>
                        Oyuncu keşfet
                      </Button>
                    )}
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/matches/new')}>
                      Maç oluştur
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
                  Haftanın yıldızları
                </span>
              }
              extra={
                <Button type="link" onClick={() => navigate('/leaderboard')}>
                  Tümü
                </Button>
              }
            >
              {leaders.length === 0 ? (
                <EmptyState description="Puanlanan maç oynandıkça burası dolacak" />
              ) : (
                <ol className="mb-leaders">
                  {leaders.map((l, i) => (
                    <li key={l.player.playerId}>
                      <span className={`mb-leaders__rank r${i + 1}`}>{i + 1}</span>
                      <PlayerAvatar player={l.player} size={36} />
                      <div className="mb-leaders__name">
                        <strong>{fullName(l.player)}</strong>
                        <span>
                          {l.matchesPlayed} maç · {l.goals} gol {l.mvpCount > 0 && <><CrownFilled style={{ color: 'var(--mb-gold)' }} /> {l.mvpCount}</>}
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
                <h4>Dengeli takım kur</h4>
                <p>Yapay zeka oyuncuları puanlarına göre iki denk takıma bölsün.</p>
              </div>
              <ArrowRightOutlined />
            </div>
            <div className="mb-promo is-blue" onClick={() => navigate('/venues')}>
              <EnvironmentOutlined className="mb-promo__icon" />
              <div>
                <h4>Anlaşmalı halı sahalar</h4>
                <p>Boş saatleri gör, fiyatları karşılaştır, sahanı ayırt.</p>
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
