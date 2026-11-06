import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Progress, Segmented, Skeleton } from 'antd';
import { Trans, useTranslation } from 'react-i18next';
import { CalendarOutlined, CrownFilled, EnvironmentOutlined, PlusOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import { api } from '../../api/config';
import { tournamentsApi, TOURNAMENT_STATUS } from '../../api/tournaments';
import { EmptyState, MetaItem, PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, formatDateTime, fullName, getCurrentUser } from '../../utils/format';
import { PlayerLink } from '../Social/FollowButton';
import CreateTournamentModal from './CreateTournamentModal';
import { FORMAT_LABEL, FormatIcon, TournamentStatusChip } from './tournamentUtils';
import './Tournaments.css';

const FILTERS = [
  { value: 'all', labelKey: 'common:all' },
  { value: 'open', labelKey: 'tournaments:list.filters.open' },
  { value: 'ongoing', labelKey: 'tournaments:list.filters.ongoing' },
  { value: 'finished', labelKey: 'tournaments:list.filters.finished' },
  { value: 'mine', labelKey: 'tournaments:list.filters.mine' },
];

function TournamentCard({ t: tour, onOpen }) {
  const { t } = useTranslation();
  const finished = tour.status === TOURNAMENT_STATUS.FINISHED;
  const pct = tour.maxTeams ? Math.min(Math.round((tour.teamCount / tour.maxTeams) * 100), 100) : 0;
  const full = tour.maxTeams && tour.teamCount >= tour.maxTeams;
  const mine = tour.myTeamIds?.length > 0;

  return (
    <div
      className={`mb-tr-card ${finished ? 'is-finished' : ''} ${mine ? 'is-mine' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' ? onOpen() : null)}
    >
      <div className="mb-tr-card__top">
        <span className={`mb-tr-card__icon is-format-${tour.format}`}>
          <FormatIcon format={tour.format} />
        </span>
        <div className="mb-tr-card__chips">
          {mine && <span className="mb-chip is-approved">{t('tournaments:card.yourTeamJoined')}</span>}
          <TournamentStatusChip status={tour.status} />
        </div>
      </div>

      <span className="mb-tr-card__format">{FORMAT_LABEL[tour.format] || t('tournaments:card.tournament')}</span>
      <h3 className="mb-tr-card__name">{tour.name}</h3>

      <div className="mb-tr-card__meta">
        <MetaItem icon={<CalendarOutlined />}>{formatDateTime(tour.startDate)}</MetaItem>
        <MetaItem icon={<EnvironmentOutlined />}>{tour.stadium?.stadiumName || t('tournaments:card.noPitch')}</MetaItem>
      </div>

      {finished && tour.winner ? (
        <div className="mb-tr-card__winner">
          <CrownFilled />
          <div>
            <small>{t('tournaments:card.champion')}</small>
            <strong>{tour.winner.teamName}</strong>
          </div>
        </div>
      ) : (
        <div className="mb-tr-card__progress">
          <div className="mb-tr-card__progress-label">
            <span>
              <TeamOutlined /> {t('tournaments:card.teams')}
            </span>
            <strong>
              {t('tournaments:card.teamCount', { count: tour.teamCount ?? 0, max: tour.maxTeams })}
            </strong>
          </div>
          <Progress
            percent={pct}
            showInfo={false}
            size="small"
            strokeColor={full ? 'var(--mb-gold)' : 'var(--mb-primary)'}
            trailColor="rgba(148,163,184,0.16)"
          />
        </div>
      )}

      <div className="mb-tr-card__footer">
        <PlayerAvatar player={tour.createdBy} size={26} />
        <span>
          <Trans
            i18nKey="tournaments:card.organizedBy"
            values={{ name: fullName(tour.createdBy) }}
            components={{ link: <PlayerLink player={tour.createdBy} /> }}
          />
        </span>
      </div>
    </div>
  );
}

export default function Tournaments() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useTranslation();
  const me = getCurrentUser();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [stadiums, setStadiums] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await tournamentsApi.list();
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      message.error(apiErrorMessage(e, t('tournaments:list.loadError')));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get('/api/Stadium/GetStadiumList')
      .then((r) => setStadiums(Array.isArray(r.data) ? r.data : []))
      .catch(() => setStadiums([]));
  }, []);

  const myId = me?.playerId;
  const visible = useMemo(() => {
    switch (filter) {
      case 'open':
        return items.filter((t) => t.status === TOURNAMENT_STATUS.REGISTRATION);
      case 'ongoing':
        return items.filter((t) => t.status === TOURNAMENT_STATUS.ONGOING);
      case 'finished':
        return items.filter((t) => t.status === TOURNAMENT_STATUS.FINISHED);
      case 'mine':
        return items.filter((t) => t.myTeamIds?.length > 0 || (myId && t.createdBy?.playerId === myId));
      default:
        return items;
    }
  }, [items, filter, myId]);

  const emptyText = {
    all: t('tournaments:list.empty.all'),
    open: t('tournaments:list.empty.open'),
    ongoing: t('tournaments:list.empty.ongoing'),
    finished: t('tournaments:list.empty.finished'),
    mine: t('tournaments:list.empty.mine'),
  }[filter];

  return (
    <div className="mb-tr-page">
      <PageHeader
        eyebrow={t('tournaments:list.eyebrow')}
        title={t('tournaments:list.title')}
        icon={<TrophyOutlined />}
        subtitle={t('tournaments:list.subtitle')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {t('tournaments:list.create')}
          </Button>
        }
      />

      <div className="mb-tr-toolbar">
        <Segmented
          options={FILTERS.map((f) => ({ value: f.value, label: t(f.labelKey) }))}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {loading ? (
        <div className="mb-tr-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="mb-tr-card is-skeleton">
              <Skeleton active paragraph={{ rows: 4 }} />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState description={emptyText}>
          {(filter === 'all' || filter === 'mine') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {t('tournaments:list.create')}
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="mb-tr-grid">
          {visible.map((t) => (
            <TournamentCard key={t.tournamentId} t={t} onOpen={() => navigate(`/tournaments/${t.tournamentId}`)} />
          ))}
        </div>
      )}

      <CreateTournamentModal
        open={createOpen}
        stadiums={stadiums}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          if (id) navigate(`/tournaments/${id}`);
          else load();
        }}
      />
    </div>
  );
}
