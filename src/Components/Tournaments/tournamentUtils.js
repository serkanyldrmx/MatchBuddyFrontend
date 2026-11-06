import React from 'react';
import { TrophyFilled, OrderedListOutlined } from '@ant-design/icons';
import { TOURNAMENT_FORMAT, TOURNAMENT_STATUS } from '../../api/tournaments';

export const FORMAT_LABEL = {
  [TOURNAMENT_FORMAT.LEAGUE]: 'Lig',
  [TOURNAMENT_FORMAT.KNOCKOUT]: 'Eleme',
};

export const isLeague = (t) => t?.format === TOURNAMENT_FORMAT.LEAGUE;
export const isKnockout = (t) => t?.format === TOURNAMENT_FORMAT.KNOCKOUT;

export function FormatIcon({ format, ...rest }) {
  return format === TOURNAMENT_FORMAT.KNOCKOUT ? <TrophyFilled {...rest} /> : <OrderedListOutlined {...rest} />;
}

const STATUS_CHIP = {
  [TOURNAMENT_STATUS.REGISTRATION]: { label: 'Kayıt açık', className: 'is-open' },
  [TOURNAMENT_STATUS.ONGOING]: { label: 'Devam ediyor', className: 'is-live' },
  [TOURNAMENT_STATUS.FINISHED]: { label: 'Tamamlandı', className: 'is-done' },
};

export function TournamentStatusChip({ status }) {
  const s = STATUS_CHIP[status] || STATUS_CHIP[TOURNAMENT_STATUS.FINISHED];
  return <span className={`mb-chip ${s.className}`}>{s.label}</span>;
}

export function FormatChip({ format }) {
  return (
    <span className="mb-chip mb-tr-format-chip">
      <FormatIcon format={format} /> {FORMAT_LABEL[format] || '-'}
    </span>
  );
}

/** Tur adı: lig için "1. Hafta", eleme için Final / Yarı final / ... */
export function roundName(tournament, round) {
  if (isLeague(tournament)) return `${round}. Hafta`;
  const left = (tournament?.roundCount || round) - round;
  if (left === 0) return 'Final';
  if (left === 1) return 'Yarı final';
  if (left === 2) return 'Çeyrek final';
  if (left === 3) return 'Son 16';
  return `${round}. Tur`;
}

export const teamName = (ref) => ref?.teamName || 'Belli değil';
