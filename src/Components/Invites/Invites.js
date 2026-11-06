import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { App, Button, Card, Skeleton } from 'antd';
import { CalendarOutlined, CheckOutlined, CloseOutlined, EnvironmentOutlined, MailOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { emit, INVITES_CHANGED, invitesApi } from '../../api/social';
import { PARTICIPANT_STATUS } from '../../api/matches';
import { CapacityRing, EmptyState, PageHeader, PlayerAvatar } from '../../ui';
import { apiErrorMessage, fromNow, isPast } from '../../utils/format';
import { PlayerLink } from '../Social/FollowButton';
import './Invites.css';

function InviteCard({ invite, kind, busy, onRespond }) {
  const navigate = useNavigate();
  const m = invite.match;
  const t = invite.team;
  const date = m ? dayjs(m.matchDate) : null;
  const expired = m ? isPast(m.matchDate) || m.isActive === 3 : false;

  return (
    <article className={`mb-invite-card ${kind === 'team' ? 'is-team' : ''}`}>
      <div className="mb-invite-card__stub">
        {m ? (
          <>
            <span className="mb-invite-card__dow">{date.format('ddd')}</span>
            <span className="mb-invite-card__day">{date.format('DD')}</span>
            <span className="mb-invite-card__month">{date.format('MMM')}</span>
            <span className="mb-invite-card__time">{date.format('HH:mm')}</span>
          </>
        ) : (
          <span className="mb-invite-card__logo">{(t?.teamName || '?').charAt(0).toUpperCase()}</span>
        )}
      </div>

      <div className="mb-invite-card__body">
        <div className="mb-invite-card__who">
          <PlayerAvatar player={invite.inviter} size={28} />
          <span>
            <PlayerLink player={invite.inviter} /> seni{' '}
            {m ? (
              <>
                <Link to={`/match-details/${m.matchId}`} className="mb-player-link">
                  <strong>{m.matchName}</strong>
                </Link>{' '}
                maçına
              </>
            ) : (
              <>
                <strong>{t?.teamName}</strong> takımına
              </>
            )}{' '}
            davet etti
          </span>
          <small>{fromNow(invite.createdAt)}</small>
        </div>
        <h3 className="mb-invite-card__title" onClick={() => m && navigate(`/match-details/${m.matchId}`)}>
          {m ? m.matchName : t?.teamName}
        </h3>
        <div className="mb-invite-card__meta">
          {m ? (
            <>
              <span><EnvironmentOutlined /> {m.stadiumName || 'Halı saha'}</span>
              <span><CalendarOutlined /> {date.format('DD MMMM dddd, HH:mm')}</span>
            </>
          ) : (
            <span><TeamOutlined /> {t?.memberCount ?? 0} oyuncu</span>
          )}
        </div>
        {expired && <span className="mb-chip is-done" style={{ marginTop: 8 }}>Bu maç artık oynanmıyor</span>}
      </div>

      <div className="mb-invite-card__side">
        {m && <CapacityRing going={m.goingCount} capacity={m.capacity} size={44} />}
        <div className="mb-invite-card__actions">
          <Button icon={<CloseOutlined />} loading={busy === 'no'} disabled={!!busy} onClick={() => onRespond(false)}>
            Reddet
          </Button>
          <Button type="primary" icon={<CheckOutlined />} loading={busy === 'yes'} disabled={!!busy || expired} onClick={() => onRespond(true)}>
            Kabul et
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function Invites() {
  const { message, notification } = App.useApp();
  const navigate = useNavigate();
  const [data, setData] = useState({ matchInvites: [], teamInvites: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({}); // `${kind}-${id}` -> 'yes' | 'no'

  const load = useCallback(async () => {
    try {
      const res = await invitesApi.my();
      setData({ matchInvites: res?.matchInvites || [], teamInvites: res?.teamInvites || [] });
    } catch (e) {
      message.error(apiErrorMessage(e, 'Davetler yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
    window.addEventListener(INVITES_CHANGED, load);
    return () => window.removeEventListener(INVITES_CHANGED, load);
  }, [load]);

  const respond = async (kind, invite, accept) => {
    const key = `${kind}-${invite.inviteId}`;
    setBusy((b) => ({ ...b, [key]: accept ? 'yes' : 'no' }));
    try {
      const res = await invitesApi.respond(kind, invite.inviteId, accept);
      const listKey = kind === 'match' ? 'matchInvites' : 'teamInvites';
      setData((d) => ({ ...d, [listKey]: d[listKey].filter((i) => i.inviteId !== invite.inviteId) }));
      if (!accept) {
        message.info('Davet reddedildi.');
      } else if (kind === 'match') {
        const waitlist = res?.status === PARTICIPANT_STATUS.WAITLIST;
        const matchId = invite.match.matchId;
        const nKey = `invite-${invite.inviteId}`;
        // Bildirim kutusu Router dışında çizildiği için Link yerine navigate kullanılır
        notification[waitlist ? 'warning' : 'success']({
          key: nKey,
          message: waitlist ? 'Yedek listesindesin' : 'Kadrodasın!',
          description: res?.message || (waitlist ? 'Maç dolu, yedek listesine eklendin.' : 'Maça katıldın.'),
          btn: (
            <Button
              type="primary"
              size="small"
              onClick={() => {
                notification.destroy(nKey);
                navigate(`/match-details/${matchId}`);
              }}
            >
              Maça git
            </Button>
          ),
          placement: 'bottomRight',
        });
      } else {
        message.success(res?.message || `${invite.team?.teamName} takımına katıldın.`);
      }
    } catch (e) {
      message.error(apiErrorMessage(e, 'Davete yanıt verilemedi.'));
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[key];
        return n;
      });
      emit(INVITES_CHANGED);
    }
  };

  const total = data.matchInvites.length + data.teamInvites.length;

  const section = (kind, title, icon, items, emptyText) => (
    <section className="mb-invites-section">
      <div className="mb-section-head">
        <h2 className="mb-section-title">
          {icon} {title}
          {items.length > 0 && <span className="mb-invites-count">{items.length}</span>}
        </h2>
      </div>
      {loading ? (
        <Card>
          <Skeleton active avatar paragraph={{ rows: 2 }} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState description={emptyText} />
        </Card>
      ) : (
        <div className="mb-invites-list">
          {items.map((inv) => (
            <InviteCard
              key={inv.inviteId}
              invite={inv}
              kind={kind}
              busy={busy[`${kind}-${inv.inviteId}`]}
              onRespond={(accept) => respond(kind, inv, accept)}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <>
      <PageHeader
        eyebrow="Kapıda bekleyenler"
        title="Davetler"
        icon={<MailOutlined />}
        subtitle={
          loading ? 'Davetlerin yükleniyor…' : total ? `${total} davet cevabını bekliyor.` : 'Şu an bekleyen davetin yok.'
        }
        extra={
          <Button icon={<CalendarOutlined />} onClick={() => navigate('/calendar')}>
            Takvimim
          </Button>
        }
      />
      {section('match', 'Maç davetleri', null, data.matchInvites, 'Bekleyen maç davetin yok. Arkadaşların seni çağırınca burada görünecek.')}
      {section('team', 'Takım davetleri', null, data.teamInvites, 'Bekleyen takım davetin yok.')}
    </>
  );
}
