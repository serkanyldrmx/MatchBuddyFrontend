import React from 'react';
import { TrophyFilled, OrderedListOutlined } from '@ant-design/icons';
import { TOURNAMENT_FORMAT, TOURNAMENT_STATUS } from '../../api/tournaments';
import { useTranslation } from 'react-i18next';
import i18n, { localizedMap } from '../../i18n';

// Etiketler erişildiği anda (render sırasında) çevrilir
export const FORMAT_LABEL = localizedMap({
  [TOURNAMENT_FORMAT.LEAGUE]: 'tournaments:format.league',
  [TOURNAMENT_FORMAT.KNOCKOUT]: 'tournaments:format.knockout',
});

export const isLeague = (t) => t?.format === TOURNAMENT_FORMAT.LEAGUE;
export const isKnockout = (t) => t?.format === TOURNAMENT_FORMAT.KNOCKOUT;

export function FormatIcon({ format, ...rest }) {
  return format === TOURNAMENT_FORMAT.KNOCKOUT ? <TrophyFilled {...rest} /> : <OrderedListOutlined {...rest} />;
}

const STATUS_CHIP = {
  [TOURNAMENT_STATUS.REGISTRATION]: { labelKey: 'tournaments:status.registration', className: 'is-open' },
  [TOURNAMENT_STATUS.ONGOING]: { labelKey: 'tournaments:status.ongoing', className: 'is-live' },
  [TOURNAMENT_STATUS.FINISHED]: { labelKey: 'tournaments:status.finished', className: 'is-done' },
};

export function TournamentStatusChip({ status }) {
  const { t } = useTranslation();
  const s = STATUS_CHIP[status] || STATUS_CHIP[TOURNAMENT_STATUS.FINISHED];
  return <span className={`mb-chip ${s.className}`}>{t(s.labelKey)}</span>;
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
  if (isLeague(tournament)) return i18n.t('tournaments:round.week', { round });
  const left = (tournament?.roundCount || round) - round;
  if (left === 0) return i18n.t('tournaments:round.final');
  if (left === 1) return i18n.t('tournaments:round.semiFinal');
  if (left === 2) return i18n.t('tournaments:round.quarterFinal');
  if (left === 3) return i18n.t('tournaments:round.last16');
  return i18n.t('tournaments:round.round', { round });
}

export const teamName = (ref) => ref?.teamName || i18n.t('tournaments:teamTbd');
