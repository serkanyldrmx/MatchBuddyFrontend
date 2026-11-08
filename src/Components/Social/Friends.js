import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { App, Button, Card, Input, Segmented, Skeleton, Tooltip } from 'antd';
import { BulbOutlined, MessageOutlined, SearchOutlined, StarFilled, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
const suggestionReason = (p, t) => {
  if (p.playedTogether > 0) return t('social:friends.reason.playedTogether', { count: p.playedTogether });
  if (p.followsMe) return t('social:friends.followsYou');
  return t('social:friends.reason.followedByFollowing');
};

/** Mini oyuncu kartı */
function PlayerCard({ player, reason, highlight, onFollowChange }) {
  const { openMessages } = useMessages();
  const { t } = useTranslation();
  return (
    <Card bordered={false} className={`mb-friend-card ${highlight ? 'is-highlight' : ''}`}>
      <div className="mb-friend-card__head">
        <PlayerAvatar player={player} size={56} />
        <div className="mb-friend-card__name">
          <PlayerLink player={player} className="mb-friend-card__title" />
          <span className="mb-friend-card__user">@{player.userName}</span>
        </div>
        <span className="mb-friend-card__score" title={t('social:friends.playerScore')}>
          <StarFilled /> {player.userScore ?? 0}
        </span>
      </div>

      {reason && (
        <div className="mb-friend-card__reason">
          <BulbOutlined /> {reason}
        </div>
      )}

      <div className="mb-friend-card__chips">
        {player.isMutual && <span className="mb-chip is-approved">{t('social:friends.friend')}</span>}
        {!player.isMutual && player.followsMe && <span className="mb-chip is-pending">{t('social:friends.followsYou')}</span>}
        {player.playedTogether > 0 && (
          <span className="mb-chip is-done">{t('social:friends.matchesTogether', { count: player.playedTogether })}</span>
        )}
      </div>

      <div className="mb-friend-card__actions">
        <FollowButton player={player} block onChange={(s) => onFollowChange?.(player.playerId, s)} />
        <Tooltip title={t('social:friends.sendMessage')}>
          <Button
            icon={<MessageOutlined />}
            aria-label={t('social:friends.sendMessage')}
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
  const { t } = useTranslation();
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
        .catch((e) => message.error(apiErrorMessage(e, t('social:friends.loadFailed'))))
        .finally(() => setLoading(false));
    },
    [message, t]
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
    const timer = setTimeout(() => {
      socialApi
        .discover(q)
        .then((list) => seq === searchSeq.current && setResults(list || []))
        .catch((e) => seq === searchSeq.current && message.error(apiErrorMessage(e, t('social:friends.searchFailed'))))
        .finally(() => seq === searchSeq.current && setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, message, t]);

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
      {t('social:friends.discoverPlayers')}
    </Button>
  );

  return (
    <>
      <PageHeader
        eyebrow={t('social:friends.eyebrow')}
        title={t('social:friends.title')}
        subtitle={t('social:friends.subtitle')}
        icon={<TeamOutlined />}
      />

      <Card bordered={false} className="mb-friends-toolbar">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { label: t('social:friends.tabs.friends', { count: mutuals.length }), value: 'friends' },
            { label: t('social:friends.tabs.following', { count: following.length }), value: 'following' },
            {
              label: (
                <span>
                  {t('social:friends.tabs.followers', { count: followers.length })}
                  {notFollowedBack > 0 && <span className="mb-friends-dot" title={t('social:friends.notFollowedBackHint')} />}
                </span>
              ),
              value: 'followers',
            },
            { label: t('social:friends.tabs.discover'), value: 'discover' },
          ]}
        />
        {tab !== 'discover' && (
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t('social:friends.filterPlaceholder')}
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
            <EmptyState description={q ? t('social:friends.empty.noMatchingFriends') : t('social:friends.empty.noFriends')}>
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
            <EmptyState description={q ? t('social:friends.empty.noMatchingPlayers') : t('social:friends.empty.noFollowing')}>
              {!q && goDiscover}
            </EmptyState>
          }
        />
      )}

      {tab === 'followers' && (
        <>
          {!loading && notFollowedBack > 0 && !q && (
            <div className="mb-friends-note">
              {t('social:friends.notFollowedBackNote', { count: notFollowedBack })}
            </div>
          )}
          <CardGrid
            loading={loading}
            list={sortedFollowers.filter((p) => matches(p, q))}
            highlight={(p) => !p.iFollow}
            empty={<EmptyState description={q ? t('social:friends.empty.noMatchingFollowers') : t('social:friends.empty.noFollowers')} />}
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
            placeholder={t('social:friends.discoverPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-discover-search"
          />
          {query.trim() ? (
            <CardGrid
              loading={searching}
              list={results}
              onFollowChange={patchLocal}
              empty={<EmptyState description={t('social:friends.empty.noSearchResults', { query: query.trim() })} />}
            />
          ) : (
            <>
              <h3 className="mb-friends-section">{t('social:friends.suggestionsTitle')}</h3>
              <CardGrid
                loading={sugLoading}
                list={suggestions}
                renderReason={(p) => suggestionReason(p, t)}
                onFollowChange={patchLocal}
                empty={<EmptyState description={t('social:friends.empty.noSuggestions')} />}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
