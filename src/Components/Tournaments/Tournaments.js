import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Progress, Segmented, Skeleton } from 'antd';
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
  { value: 'all', label: 'Tümü' },
  { value: 'open', label: 'Kayıt açık' },
  { value: 'ongoing', label: 'Devam eden' },
  { value: 'finished', label: 'Tamamlanan' },
  { value: 'mine', label: 'Benimkiler' },
];

function TournamentCard({ t, onOpen }) {
  const finished = t.status === TOURNAMENT_STATUS.FINISHED;
  const pct = t.maxTeams ? Math.min(Math.round((t.teamCount / t.maxTeams) * 100), 100) : 0;
  const full = t.maxTeams && t.teamCount >= t.maxTeams;
  const mine = t.myTeamIds?.length > 0;

  return (
    <div
      className={`mb-tr-card ${finished ? 'is-finished' : ''} ${mine ? 'is-mine' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' ? onOpen() : null)}
    >
      <div className="mb-tr-card__top">
        <span className={`mb-tr-card__icon is-format-${t.format}`}>
          <FormatIcon format={t.format} />
        </span>
        <div className="mb-tr-card__chips">
          {mine && <span className="mb-chip is-approved">Takımın katılıyor</span>}
          <TournamentStatusChip status={t.status} />
        </div>
      </div>

      <span className="mb-tr-card__format">{FORMAT_LABEL[t.format] || 'Turnuva'}</span>
      <h3 className="mb-tr-card__name">{t.name}</h3>

      <div className="mb-tr-card__meta">
        <MetaItem icon={<CalendarOutlined />}>{formatDateTime(t.startDate)}</MetaItem>
        <MetaItem icon={<EnvironmentOutlined />}>{t.stadium?.stadiumName || 'Saha belirlenmedi'}</MetaItem>
      </div>

      {finished && t.winner ? (
        <div className="mb-tr-card__winner">
          <CrownFilled />
          <div>
            <small>Şampiyon</small>
            <strong>{t.winner.teamName}</strong>
          </div>
        </div>
      ) : (
        <div className="mb-tr-card__progress">
          <div className="mb-tr-card__progress-label">
            <span>
              <TeamOutlined /> Takımlar
            </span>
            <strong>
              {t.teamCount ?? 0}/{t.maxTeams} takım
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
        <PlayerAvatar player={t.createdBy} size={26} />
        <span>
          <PlayerLink player={t.createdBy}>{fullName(t.createdBy)}</PlayerLink> düzenliyor
        </span>
      </div>
    </div>
  );
}

export default function Tournaments() {
  const navigate = useNavigate();
  const { message } = App.useApp();
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
      message.error(apiErrorMessage(e, 'Turnuvalar yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [message]);

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
    all: 'Henüz turnuva yok. İlkini sen başlat!',
    open: 'Şu an kaydı açık turnuva yok.',
    ongoing: 'Devam eden turnuva yok.',
    finished: 'Tamamlanan turnuva yok.',
    mine: 'Katıldığın ya da düzenlediğin bir turnuva yok.',
  }[filter];

  return (
    <div className="mb-tr-page">
      <PageHeader
        eyebrow="Rekabet"
        title="Turnuvalar"
        icon={<TrophyOutlined />}
        subtitle="Takımını kur, lige ya da elemeye katıl, kupayı kaldır."
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Turnuva oluştur
          </Button>
        }
      />

      <div className="mb-tr-toolbar">
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
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
              Turnuva oluştur
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
