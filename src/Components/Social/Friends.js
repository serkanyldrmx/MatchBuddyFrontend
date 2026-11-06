import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { App, Button, Card, Input, Segmented, Skeleton, Tooltip } from 'antd';
import { BulbOutlined, MessageOutlined, SearchOutlined, StarFilled, TeamOutlined } from '@ant-design/icons';
import { socialApi, SOCIAL_CHANGED } from '../../api/social';
import { useMessages } from '../../messaging/MessagesContext';
import { EmptyState, PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fullName } from '../../utils/format';
import FollowButton, { PlayerLink } from './FollowButton';
import './Friends.css';

const TABS = ['friends', 'following', 'followers', 'discover'];

const matches = (p, q) =>
  !q || fullName(p).toLocaleLowerCase('tr').includes(q) || (p.userName || '').toLocaleLowerCase('tr').includes(q);

/** Öneri sebebi: neden bu oyuncuyu görüyorum? */
const suggestionReason = (p) => {
  if (p.playedTogether > 0) return `${p.playedTogether} maçta birlikte oynadınız`;
  if (p.followsMe) return 'Seni takip ediyor';
  return 'Takip ettiklerin de takip ediyor';
};

/** Mini oyuncu kartı */
function PlayerCard({ player, reason, highlight, onFollowChange }) {
  const { openMessages } = useMessages();
  return (
    <Card bordered={false} className={`mb-friend-card ${highlight ? 'is-highlight' : ''}`}>
      <div className="mb-friend-card__head">
        <PlayerAvatar player={player} size={56} />
        <div className="mb-friend-card__name">
          <PlayerLink player={player} className="mb-friend-card__title" />
          <span className="mb-friend-card__user">@{player.userName}</span>
        </div>
        <span className="mb-friend-card__score" title="Oyuncu puanı">
          <StarFilled /> {player.userScore ?? 0}
        </span>
      </div>

      {reason && (
        <div className="mb-friend-card__reason">
          <BulbOutlined /> {reason}
        </div>
      )}

      <div className="mb-friend-card__chips">
        {player.isMutual && <span className="mb-chip is-approved">Arkadaş</span>}
        {!player.isMutual && player.followsMe && <span className="mb-chip is-pending">Seni takip ediyor</span>}
        {player.playedTogether > 0 && (
          <span className="mb-chip is-done">{player.playedTogether} maç birlikte</span>
        )}
      </div>

      <div className="mb-friend-card__actions">
        <FollowButton player={player} block onChange={(s) => onFollowChange?.(player.playerId, s)} />
        <Tooltip title="Mesaj gönder">
          <Button
            icon={<MessageOutlined />}
            aria-label="Mesaj gönder"
            onClick={() => openMessages({ type: 'user', data: player })}
          />
        </Tooltip>
      </div>
    </Card>
  );
}

function CardGrid({ loading, list, empty, renderReason, highlight, onFollowChange }) {
  if (loading) {
    return (
      <div className="mb-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} bordered={false}>
            <Skeleton avatar active paragraph={{ rows: 2 }} />
          </Card>
        ))}
      </div>
    );
  }
  if (!list.length) {
    return <Card bordered={false}>{empty}</Card>;
  }
  return (
    <div className="mb-grid">
      {list.map((p) => (
        <PlayerCard
          key={p.playerId}
          player={p}
          reason={renderReason?.(p)}
          highlight={highlight?.(p)}
          onFollowChange={onFollowChange}
        />
      ))}
    </div>
  );
}

export default function Friends() {
  const { message } = App.useApp();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'friends';

  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [sugLoading, setSugLoading] = useState(true);
  const searchSeq = useRef(0);

  const load = useCallback(
    (silent) => {
      if (!silent) setLoading(true);
      return Promise.all([socialApi.following(), socialApi.followers()])
        .then(([fing, fers]) => {
          setFollowing(fing || []);
          setFollowers(fers || []);
        })
        .catch((e) => message.error(apiErrorMessage(e, 'Liste yüklenemedi.')))
        .finally(() => setLoading(false));
    },
    [message]
  );

  useEffect(() => {
    load();
    const onChange = () => load(true);
    window.addEventListener(SOCIAL_CHANGED, onChange);
    return () => window.removeEventListener(SOCIAL_CHANGED, onChange);
  }, [load]);

  // Öneriler: Keşfet sekmesi ilk açıldığında
  useEffect(() => {
    if (tab !== 'discover') return;
    setSugLoading(true);
    socialApi
      .suggestions()
      .then((list) => setSuggestions(list || []))
      .catch(() => setSuggestions([]))
      .finally(() => setSugLoading(false));
  }, [tab]);

  // Arama: 300 ms gecikmeli
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const t = setTimeout(() => {
      socialApi
        .discover(q)
        .then((list) => seq === searchSeq.current && setResults(list || []))
        .catch((e) => seq === searchSeq.current && message.error(apiErrorMessage(e, 'Arama yapılamadı.')))
        .finally(() => seq === searchSeq.current && setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, message]);

  // Keşfet kartlarında takip durumu yerelde güncellensin
  const patchLocal = useCallback((playerId, s) => {
    const patch = (list) =>
      list.map((p) => (p.playerId === playerId ? { ...p, iFollow: s.iFollow, isMutual: s.isMutual } : p));
    setResults(patch);
    setSuggestions(patch);
  }, []);

  const mutuals = useMemo(() => following.filter((p) => p.isMutual), [following]);
  const notFollowedBack = useMemo(() => followers.filter((p) => !p.iFollow).length, [followers]);

  const q = filter.trim().toLocaleLowerCase('tr');
  const sortedFollowers = useMemo(
    () => followers.slice().sort((a, b) => Number(!!a.iFollow) - Number(!!b.iFollow)),
    [followers]
  );

  const setTab = (value) => {
    const next = new URLSearchParams(params);
    if (value === 'friends') next.delete('tab');
    else next.set('tab', value);
    setParams(next, { replace: true });
    setFilter('');
  };

  const goDiscover = (
    <Button type="primary" icon={<SearchOutlined />} onClick={() => setTab('discover')}>
      Oyuncu keşfet
    </Button>
  );

  return (
    <>
      <PageHeader
        eyebrow="Topluluk"
        title="Arkadaşlar"
        subtitle="Takip et, geri takip edilince arkadaş olursunuz. Arkadaşlarınla kolayca mesajlaş ve maça çağır."
        icon={<TeamOutlined />}
      />

      <Card bordered={false} className="mb-friends-toolbar">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { label: `Arkadaşlar (${mutuals.length})`, value: 'friends' },
            { label: `Takip ettiklerim (${following.length})`, value: 'following' },
            {
              label: (
                <span>
                  Takipçilerim ({followers.length})
                  {notFollowedBack > 0 && <span className="mb-friends-dot" title="Geri takip etmediklerin var" />}
                </span>
              ),
              value: 'followers',
            },
            { label: 'Keşfet', value: 'discover' },
          ]}
        />
        {tab !== 'discover' && (
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Listede ara"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mb-friends-toolbar__filter"
          />
        )}
      </Card>

      {tab === 'friends' && (
        <CardGrid
          loading={loading}
          list={mutuals.filter((p) => matches(p, q))}
          empty={
            <EmptyState description={q ? 'Eşleşen arkadaş yok.' : 'Henüz arkadaşın yok. Birini takip et, o da seni takip edince arkadaş olursunuz.'}>
              {!q && goDiscover}
            </EmptyState>
          }
        />
      )}

      {tab === 'following' && (
        <CardGrid
          loading={loading}
          list={following.filter((p) => matches(p, q))}
          empty={
            <EmptyState description={q ? 'Eşleşen oyuncu yok.' : 'Henüz kimseyi takip etmiyorsun.'}>
              {!q && goDiscover}
            </EmptyState>
          }
        />
      )}

      {tab === 'followers' && (
        <>
          {!loading && notFollowedBack > 0 && !q && (
            <div className="mb-friends-note">
              {notFollowedBack} takipçini henüz geri takip etmiyorsun. Geri takip edersen arkadaş olursunuz.
            </div>
          )}
          <CardGrid
            loading={loading}
            list={sortedFollowers.filter((p) => matches(p, q))}
            highlight={(p) => !p.iFollow}
            empty={<EmptyState description={q ? 'Eşleşen takipçi yok.' : 'Henüz takipçin yok.'} />}
          />
        </>
      )}

      {tab === 'discover' && (
        <>
          <Input
            size="large"
            allowClear
            autoFocus
            prefix={<SearchOutlined />}
            placeholder="İsim veya kullanıcı adıyla oyuncu ara"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-discover-search"
          />
          {query.trim() ? (
            <CardGrid
              loading={searching}
              list={results}
              onFollowChange={patchLocal}
              empty={<EmptyState description={`"${query.trim()}" için oyuncu bulunamadı.`} />}
            />
          ) : (
            <>
              <h3 className="mb-friends-section">Senin için öneriler</h3>
              <CardGrid
                loading={sugLoading}
                list={suggestions}
                renderReason={suggestionReason}
                onFollowChange={patchLocal}
                empty={<EmptyState description="Şimdilik öneri yok. Birkaç maça katıl, öneriler gelsin." />}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
