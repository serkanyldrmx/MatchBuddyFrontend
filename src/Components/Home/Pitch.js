import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dropdown, Popconfirm, Popover, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  CheckCircleFilled,
  CrownFilled,
  DeleteOutlined,
  EditOutlined,
  LoginOutlined,
  MessageOutlined,
  PlusOutlined,
  SwapOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PARTICIPANT_STATUS, SIDE } from '../../api/matches';
import { PlayerAvatar, ReliabilityBadge } from '../../ui';
import { intlLocale } from '../../i18n';
import { fullName } from '../../utils/format';
import { buildFormation, ROLE_LABELS, roleShort } from './formations';

const COMPACT_QUERY = '(max-width: 720px)';

/** Mobil (dikey saha) mı? CSS'teki 720px kırılımıyla aynı */
function useCompactPitch() {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(COMPACT_QUERY).matches : false);
  const [compact, setCompact] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(COMPACT_QUERY);
    const onChange = (e) => setCompact(e.matches);
    setCompact(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return compact;
}

const time = (v) => {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
};

export const guestInitials = (name) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toLocaleUpperCase(intlLocale()) || '?';

const sideKey = (side) => (side === SIDE.AWAY ? 'away' : 'home');

/** Taraf kadrosu: oyuncular (kurucu önce, sonra katılım sırası), ardından misafirler */
export function sideRoster(detail, side) {
  const creatorId = detail.createdBy?.playerId;
  const players = (detail.participants || [])
    .filter((p) => p.status === PARTICIPANT_STATUS.GOING && (side === SIDE.AWAY ? p.side === SIDE.AWAY : p.side !== SIDE.AWAY))
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const ac = a.p.player.playerId === creatorId ? 0 : 1;
      const bc = b.p.player.playerId === creatorId ? 0 : 1;
      return ac - bc || time(a.p.joinedAt) - time(b.p.joinedAt) || a.i - b.i;
    })
    .map(({ p }) => p);
  const guests = (detail.guests || [])
    .filter((g) => (side === SIDE.AWAY ? g.side === SIDE.AWAY : g.side !== SIDE.AWAY))
    .map((g, i) => ({ g, i }))
    .sort((a, b) => time(a.g.createdAt) - time(b.g.createdAt) || a.i - b.i)
    .map(({ g }) => g);
  return { players, guests, count: players.length + guests.length };
}

/* ---------------- Saha çizgileri (SVG, 105 x 68 m) ---------------- */
function Markings() {
  return (
    <g>
      <rect x="2" y="2" width="101" height="64" rx="0.4" />
      <line x1="52.5" y1="2" x2="52.5" y2="66" />
      <circle cx="52.5" cy="34" r="9.15" />
      <circle cx="52.5" cy="34" r="0.55" className="is-spot" />
      {[false, true].map((mirror) => (
        <g key={String(mirror)} transform={mirror ? 'matrix(-1 0 0 1 105 0)' : undefined}>
          <rect x="2" y="13.85" width="16.5" height="40.3" />
          <rect x="2" y="24.84" width="5.5" height="18.32" />
          <circle cx="13" cy="34" r="0.45" className="is-spot" />
          <path d="M18.5 26.69 A9.15 9.15 0 0 1 18.5 41.31" />
          <rect x="0.3" y="30.34" width="1.7" height="7.32" className="is-goal" />
          <path d="M2 3.2 A1.2 1.2 0 0 0 3.2 2" />
          <path d="M3.2 66 A1.2 1.2 0 0 0 2 64.8" />
        </g>
      ))}
    </g>
  );
}

function PitchMarkings() {
  return (
    <>
      <svg className="mb-pitch__marks is-horizontal" viewBox="0 0 105 68" preserveAspectRatio="none" aria-hidden="true">
        <Markings />
      </svg>
      <svg className="mb-pitch__marks is-vertical" viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true">
        <g transform="matrix(0 1 1 0 0 0)">
          <Markings />
        </g>
      </svg>
    </>
  );
}

/* ---------------- Oyuncu ---------------- */
function PlayerToken({ p, role, me, canManage, mvpId, avatarSize, onSwap, onMessage }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMe = p.player.playerId === me?.playerId;
  const items = [{ key: 'profile', icon: <UserOutlined />, label: t('match:pitch.viewProfile'), onClick: () => navigate(`/player/${p.player.playerId}`) }];
  if (!isMe) items.push({ key: 'msg', icon: <MessageOutlined />, label: t('match:pitch.sendMessage'), onClick: () => onMessage(p.player) });
  if (canManage) items.push({ key: 'swap', icon: <SwapOutlined />, label: t('match:pitch.moveToOtherTeam'), onClick: () => onSwap(p) });

  return (
    <Dropdown menu={{ items }} trigger={['click']}>
      <button type="button" className="mb-token-btn" title={`${fullName(p.player)} · ${ROLE_LABELS[role]}`}>
        <div className={`mb-token ${isMe ? 'is-me' : ''}`}>
          <div className="mb-token__avatar">
            <PlayerAvatar player={p.player} size={avatarSize} />
            <span className="mb-token__pos">{roleShort(role)}</span>
            {p.confirmed && <CheckCircleFilled className="mb-token__check" />}
            {mvpId === p.player.playerId && <CrownFilled className="mb-token__crown" />}
            {p.goals > 0 && <span className="mb-token__goals">{p.goals}</span>}
          </div>
          <span className="mb-token__label">
            <span className="mb-token__name">{isMe ? t('match:pitch.you') : p.player.playerName || p.player.userName}</span>
            <span className="mb-token__score">{p.player.userScore ?? 0}</span>
          </span>
          {canManage && !isMe && p.reliability && (
            <span className="mb-token__rel">
              <ReliabilityBadge reliability={p.reliability} compact />
            </span>
          )}
        </div>
      </button>
    </Dropdown>
  );
}

/* ---------------- Misafir ---------------- */
function GuestToken({ g, role, manage, onEdit, onMove, onRemove }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  const token = (
    <button type="button" className="mb-token-btn" disabled={!manage} aria-label={t('match:guest.aria', { name: g.name })}>
      <div className="mb-token is-guest">
        <div className="mb-token__avatar">
          <span className="mb-token__guest">{guestInitials(g.name)}</span>
          <span className="mb-token__tag">{t('match:guest.tag')}</span>
          <span className="mb-token__pos">{roleShort(role)}</span>
        </div>
        <span className="mb-token__label">
          <span className="mb-token__name">{g.name}</span>
        </span>
      </div>
    </button>
  );

  const tip = (
    <div className="mb-guest-tip">
      <strong>{g.name}</strong>
      <span>{g.note || t('match:guest.defaultNote')}</span>
      {g.addedBy && <small>{t('match:guest.addedBy', { name: fullName(g.addedBy) })}</small>}
    </div>
  );

  if (!manage) {
    return (
      <Tooltip title={tip}>
        <span className="mb-pslot__hit">{token}</span>
      </Tooltip>
    );
  }

  const menu = (
    <div className="mb-pitch-menu">
      {g.note && <p className="mb-pitch-menu__note">{g.note}</p>}
      <button
        type="button"
        onClick={() => {
          close();
          onEdit(g);
        }}
      >
        <EditOutlined /> {t('common:actions.edit')}
      </button>
      <button
        type="button"
        onClick={() => {
          close();
          onMove(g);
        }}
      >
        <SwapOutlined /> {t('match:pitch.moveToOtherTeam')}
      </button>
      <Popconfirm
        title={t('match:guest.removeTitle')}
        description={t('match:guest.removeDescription', { name: g.name })}
        okText={t('match:guest.remove')}
        okButtonProps={{ danger: true }}
        cancelText={t('common:actions.cancel')}
        onConfirm={() => {
          close();
          return onRemove(g);
        }}
      >
        <button type="button" className="is-danger">
          <DeleteOutlined /> {t('match:guest.remove')}
        </button>
      </Popconfirm>
    </div>
  );

  return (
    <Tooltip title={tip} open={menuOpen ? false : undefined}>
      <span className="mb-pslot__hit">
        <Popover
          content={menu}
          title={<span className="mb-pitch-menu__title">{g.name}</span>}
          trigger="click"
          open={menuOpen}
          onOpenChange={setMenuOpen}
          overlayClassName="mb-pitch-menu-pop"
        >
          {token}
        </Popover>
      </span>
    </Tooltip>
  );
}

/* ---------------- Boş yer ---------------- */
function EmptySlot({ role, side, manage, canJoin, onJoin, onAddGuest }) {
  const { t } = useTranslation();
  const label = manage ? t('common:actions.add') : canJoin ? t('match:actions.joinShort') : t('match:pitch.emptySlot');
  const button = (
    <button
      type="button"
      className="mb-token-btn"
      disabled={!manage && !canJoin}
      onClick={manage ? undefined : onJoin}
      aria-label={`${ROLE_LABELS[role]} · ${label}`}
    >
      <div className="mb-token is-empty">
        <div className="mb-token__avatar">
          <span className="mb-token__role">{roleShort(role)}</span>
          <PlusOutlined className="mb-token__plus" />
        </div>
        <span className="mb-token__label">
          <span className="mb-token__name">{label}</span>
        </span>
      </div>
    </button>
  );

  if (!manage) return button;

  const items = [];
  if (canJoin) items.push({ key: 'join', icon: <LoginOutlined />, label: t('match:actions.join'), onClick: onJoin });
  items.push({ key: 'guest', icon: <UserAddOutlined />, label: t('match:guest.addByName'), onClick: () => onAddGuest(side) });
  return (
    <Dropdown menu={{ items }} trigger={['click']}>
      {button}
    </Dropdown>
  );
}

/* ---------------- Saha ---------------- */
function Pitch({
  detail,
  me,
  perSide,
  homeLabel,
  awayLabel,
  closed,
  canJoin,
  onJoin,
  onSwap,
  onMessage,
  onAddGuest,
  onEditGuest,
  onMoveGuest,
  onRemoveGuest,
}) {
  const { t } = useTranslation();
  const compact = useCompactPitch();
  const manage = !!detail.canManage && !closed;
  const mvpId = detail.mvp?.player?.playerId;
  const avatarSize = compact ? 40 : 52;

  const sides = useMemo(
    () =>
      [SIDE.HOME, SIDE.AWAY].map((side) => {
        const roster = sideRoster(detail, side);
        const formation = buildFormation(Math.max(perSide, roster.count));
        const entries = [
          ...roster.players.map((p) => ({ kind: 'player', key: `p${p.player.playerId}`, p })),
          ...roster.guests.map((g) => ({ kind: 'guest', key: `g${g.guestId}`, g })),
        ];
        const slots = formation.slots.map((slot, i) => {
          const entry = entries[i];
          const x = side === SIDE.AWAY ? 100 - slot.depth : slot.depth;
          return { ...slot, x, y: slot.across, side, entry, key: entry ? entry.key : `e${side}-${slot.id}` };
        });
        return { side, key: sideKey(side), roster, formation, slots };
      }),
    [detail, perSide]
  );

  const [home, away] = sides;
  const freeTotal = Math.max(perSide - home.roster.count, 0) + Math.max(perSide - away.roster.count, 0);
  const maxGaps = Math.max(home.formation.lines.length, away.formation.lines.length) - 1;

  const teamLabel = (s, label) => (
    <span className={`mb-pitch__team is-${s.key}`}>
      <i />
      <span className="mb-pitch__team-name">{label}</span>
      <span className="mb-pitch__team-count">
        {' · '}
        {s.roster.count}/{perSide}
      </span>
    </span>
  );

  let order = 0;
  const tokens = sides.flatMap((s) =>
    s.slots.map((slot) => {
      const style = { '--x': `${slot.x}%`, '--y': `${slot.y}%`, '--i': order++ };
      const { entry } = slot;
      let content;
      if (!entry) {
        content = (
          <EmptySlot role={slot.role} side={s.side} manage={manage} canJoin={canJoin} onJoin={onJoin} onAddGuest={onAddGuest} />
        );
      } else if (entry.kind === 'player') {
        content = (
          <PlayerToken
            p={entry.p}
            role={slot.role}
            me={me}
            canManage={detail.canManage}
            mvpId={mvpId}
            avatarSize={avatarSize}
            onSwap={onSwap}
            onMessage={onMessage}
          />
        );
      } else {
        content = (
          <GuestToken g={entry.g} role={slot.role} manage={manage} onEdit={onEditGuest} onMove={onMoveGuest} onRemove={onRemoveGuest} />
        );
      }
      return (
        <div key={slot.key} className={`mb-pslot is-${s.key} is-line-${slot.line}`} style={style}>
          {content}
        </div>
      );
    })
  );

  return (
    <div className="mb-pitch">
      <div className="mb-pitch__head">
        {teamLabel(home, homeLabel)}
        {manage && (
          <Tooltip title={freeTotal <= 0 ? t('match:pitch.noFreeSpots') : undefined}>
            <Button size="small" icon={<UserAddOutlined />} className="mb-pitch__add" disabled={freeTotal <= 0} onClick={() => onAddGuest()}>
              {t('match:guest.addByName')}
            </Button>
          </Tooltip>
        )}
        <span className="mb-pitch__head-away">{teamLabel(away, awayLabel)}</span>
      </div>

      <div className={`mb-pitch__field ${maxGaps >= 4 ? 'is-deep' : ''}`} style={{ '--mb-pitch-gaps': maxGaps }}>
        <div className="mb-pitch__turf" aria-hidden="true" />
        <PitchMarkings />
        {sides.map((s) => (
          <span key={s.key} className={`mb-pitch__formation is-${s.key}`}>
            <small>{t('match:formations.label')}</small> {s.formation.label}
          </span>
        ))}
        {tokens}
      </div>

      <div className="mb-pitch__foot">{teamLabel(away, awayLabel)}</div>
    </div>
  );
}

export default Pitch;
