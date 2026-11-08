import React, { useMemo } from 'react';
import { CrownFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { FIXTURE_STATUS } from '../../api/tournaments';
import { roundName } from './tournamentUtils';

function BracketTeam({ team, score, isWinner, isLoser, isMine, bye }) {
  const { t } = useTranslation();
  return (
    <div className={`mb-bk-team ${isWinner ? 'is-winner' : ''} ${isLoser ? 'is-loser' : ''} ${isMine ? 'is-mine' : ''} ${team ? '' : 'is-empty'}`}>
      <span className="mb-bk-team__name">{team ? team.teamName : bye ? t('tournaments:bracket.bye') : t('tournaments:teamTbd')}</span>
      <span className="mb-bk-team__score">{score ?? ''}</span>
    </div>
  );
}

function BracketMatch({ fixture, myTeamIds, isFinal }) {
  const { t } = useTranslation();
  if (!fixture) {
    return (
      <div className="mb-bk-match is-placeholder">
        <BracketTeam />
        <BracketTeam />
      </div>
    );
  }
  const played = fixture.status === FIXTURE_STATUS.PLAYED;
  const bye = fixture.status === FIXTURE_STATUS.BYE;
  const w = fixture.winnerTeamId;
  const side = (team, score) => (
    <BracketTeam
      team={team}
      score={played ? score : null}
      bye={bye}
      isWinner={!!team && !!w && team.teamId === w}
      isLoser={!!team && !!w && team.teamId !== w}
      isMine={!!team && myTeamIds.has(team.teamId)}
    />
  );
  return (
    <div className={`mb-bk-match ${isFinal && w ? 'is-champion' : ''}`}>
      {isFinal && w && <CrownFilled className="mb-bk-match__crown" />}
      {side(fixture.homeTeam, fixture.homeScore)}
      {side(fixture.awayTeam, fixture.awayScore)}
      {bye && <span className="mb-bk-match__tag">{t('tournaments:bracket.byePassed')}</span>}
    </div>
  );
}

/** Eleme ağacı: her tur bir sütun, kazanan (r, p) → (r+1, p/2) */
export default function Bracket({ tournament }) {
  useTranslation(); // dil değişince tur adları yeniden çizilsin
  const myTeamIds = useMemo(
    () => new Set((tournament.teams || []).filter((t) => t.isMine).map((t) => t.teamId).concat(tournament.myTeamIds || [])),
    [tournament]
  );

  const rounds = useMemo(() => {
    const fixtures = tournament.fixtures || [];
    const maxRound = fixtures.reduce((m, f) => Math.max(m, f.round), 0);
    const count = Math.max(tournament.roundCount || 0, maxRound);
    const list = [];
    for (let r = 1; r <= count; r += 1) {
      const size = 2 ** (count - r);
      const slots = new Array(size).fill(null);
      fixtures
        .filter((f) => f.round === r)
        .forEach((f) => {
          if (f.position >= 0 && f.position < size) slots[f.position] = f;
        });
      list.push({ round: r, slots });
    }
    return list;
  }, [tournament]);

  if (!rounds.length) return null;

  return (
    <div className="mb-bracket-scroll">
      <div className="mb-bracket">
        {rounds.map(({ round, slots }, idx) => {
          const isLast = idx === rounds.length - 1;
          const pairs = [];
          if (isLast) pairs.push(slots);
          else for (let i = 0; i < slots.length; i += 2) pairs.push(slots.slice(i, i + 2));
          return (
            <div key={round} className={`mb-bracket__col ${idx === 0 ? 'is-first' : ''} ${isLast ? 'is-last' : ''}`}>
              <div className="mb-bracket__title">{roundName(tournament, round)}</div>
              <div className="mb-bracket__body">
                {pairs.map((pair, pi) => (
                  <div key={pi} className="mb-bracket__pair">
                    {pair.map((f, si) => (
                      <div key={f?.fixtureId ?? `e-${pi}-${si}`} className="mb-bracket__slot">
                        <BracketMatch fixture={f} myTeamIds={myTeamIds} isFinal={isLast} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
