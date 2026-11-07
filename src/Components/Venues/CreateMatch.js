import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, App, Button, Card, Col, Grid, Input, InputNumber, Radio, Result, Row, Segmented, Select, Skeleton, Spin, Steps, Switch } from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FireOutlined,
  GlobalOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  SunOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/config';
import { matchesApi } from '../../api/matches';
import { formatPrice, SURFACE, venuesApi } from '../../api/venues';
import { PageHeader } from '../../ui';
import { apiErrorMessage, errorCode, fieldErrorsOf, getCurrentUser, mediaUrl } from '../../utils/format';
import { bookingUserCountRange, usePublicParams } from '../../api/parameters';
import SlotPicker, { DateStrip } from './SlotPicker';
import { AMENITY_ICONS, VenueRating } from './Venues';
import './CreateMatch.css';

// Sunucu hata kodları → sihirbazda dönülecek adım
// Seçilen saat artık kullanılamıyor: saat seçimi sıfırlanır
const SLOT_GONE_CODES = ['VENUE_SLOT_TAKEN', 'MATCH_TIME_CONFLICT', 'VENUE_PAST_SLOT', 'VENUE_CLOSED_AT_TIME', 'RESERVATION_PITCH_UNAVAILABLE', 'OWNER_BLOCK_CLOSED_CONFLICT'];
// Saat / süre / tesis kuralı hataları: 1. adıma dönülür (seçim korunur)
const SLOT_STEP_CODES = [
  'VENUE_BOOKING_TOO_SOON',
  'VENUE_BOOKING_TOO_FAR_AHEAD',
  'VENUE_INVALID_START_MINUTE',
  'VENUE_INVALID_DURATION',
  'VENUE_DURATION_OUT_OF_RANGE',
  'VENUE_CHOOSE_SLOT',
  'VENUE_PITCH_REQUIRED',
  'RESERVATION_VENUE_CLOSED',
];
// Kadro adımındaki alanlar (errors sözlüğü anahtarları, küçük harf)
const SQUAD_FIELDS = ['matchname', 'description', 'usercount', 'hometeamid', 'awayteamid', 'lookingforopponent'];

const toApiDate = (d) => dayjs(d).format('YYYY-MM-DDTHH:mm:ss');
const numParam = (v) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined);

/** Sağdaki rezervasyon fişi */
function Receipt({ venue, pitch, start, duration, quote, quoting, cleatCount, cameraRequested, userCount }) {
  const { t } = useTranslation();
  if (!venue || !pitch || !start) {
    return (
      <div className="mb-receipt is-empty">
        <h3 className="mb-receipt__title">{t('venues:createMatch.receipt.title')}</h3>
        <p className="mb-hint">{t('venues:createMatch.receipt.emptyHint')}</p>
      </div>
    );
  }
  const s = dayjs(start);
  const e = s.add(duration, 'minute');
  return (
    <Spin spinning={quoting}>
      <div className="mb-receipt">
        <h3 className="mb-receipt__title">{t('venues:createMatch.receipt.title')}</h3>
        <div className="mb-receipt__venue">
          {venue.coverPhotoUrl && <img src={mediaUrl(venue.coverPhotoUrl, 'sm')} alt="" loading="lazy" decoding="async" />}
          <div>
            <strong>{venue.name}</strong>
            <span>
              {pitch.name} · {SURFACE[pitch.surface] || t('common:pitch')} · {pitch.isIndoor ? t('common:indoor') : t('common:outdoor')}
            </span>
          </div>
        </div>
        <div className="mb-receipt__when">
          <span>
            <CalendarOutlined /> {s.format('DD MMMM dddd')}
          </span>
          <span>
            <ClockCircleOutlined /> {s.format('HH:mm')}–{e.format('HH:mm')} · {t('venues:createMatch.minutes', { count: duration })}
          </span>
        </div>

        <div className="mb-receipt__lines">
          {(quote?.lines || []).map((l) => (
            <div key={l.label} className="mb-receipt__line">
              <span>
                {t('venues:createMatch.receipt.pitchLine', { label: l.label })}
                {l.campaignTitle && (
                  <em className="mb-receipt__deal">
                    <FireOutlined /> {l.campaignTitle}
                  </em>
                )}
              </span>
              <span>
                {l.originalPrice != null && l.originalPrice > l.price && <s>{formatPrice(l.originalPrice)}</s>} {formatPrice(l.price)}
              </span>
            </div>
          ))}
          {cleatCount > 0 && venue.prices?.cleatRentalPrice != null && (
            <div className="mb-receipt__line">
              <span>{t('venues:createMatch.receipt.cleats', { count: cleatCount })}</span>
              <span>{formatPrice(cleatCount * venue.prices.cleatRentalPrice)}</span>
            </div>
          )}
          {cameraRequested && venue.prices?.cameraPrice != null && (
            <div className="mb-receipt__line">
              <span>{t('venues:amenities.camera')}</span>
              <span>{formatPrice(venue.prices.cameraPrice)}</span>
            </div>
          )}
        </div>

        {quote && quote.available !== false ? (
          <>
            <div className="mb-receipt__sub">
              <span>{t('common:pitch')}</span>
              <span>{formatPrice(quote.pitchTotal)}</span>
            </div>
            {quote.extrasTotal > 0 && (
              <div className="mb-receipt__sub">
                <span>{t('venues:createMatch.receipt.extras')}</span>
                <span>{formatPrice(quote.extrasTotal)}</span>
              </div>
            )}
            <div className="mb-receipt__total">
              <span>{t('venues:createMatch.receipt.total')}</span>
              <strong>{formatPrice(quote.total)}</strong>
            </div>
            <div className="mb-receipt__per">
              <span>{t('venues:createMatch.receipt.perPlayer')}</span>
              <strong>{formatPrice(quote.perPlayer)}</strong>
              <small>{t('venues:createMatch.receipt.splitAmong', { count: userCount })}</small>
            </div>
          </>
        ) : quote?.available === false ? (
          <Alert type="error" showIcon message={quote.reason || t('venues:createMatch.receipt.unavailable')} />
        ) : null}

        {venue.cancellationPolicy && (
          <div className="mb-receipt__policy">
            <InfoCircleOutlined /> <span>{venue.cancellationPolicy}</span>
          </div>
        )}
        <p className="mb-receipt__note">{t('venues:createMatch.receipt.note')}</p>
      </div>
    </Spin>
  );
}

export default function CreateMatch() {
  const { t } = useTranslation();
  // Telefonda adımlar yatay ve başlıklar ikonların altında kalsın (antd varsayılanı dikeye geçer)
  const isPhone = Grid.useBreakpoint().md === false;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const me = getCurrentUser();
  const myId = me?.playerId;

  const initialStart = params.get('start') && dayjs(params.get('start')).isValid() ? dayjs(params.get('start')) : null;

  const [step, setStep] = useState(0);
  const [venues, setVenues] = useState([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [stadiumId, setStadiumId] = useState(numParam(params.get('stadiumId')));
  const [venue, setVenue] = useState(null);
  const [venueLoading, setVenueLoading] = useState(false);
  const [date, setDate] = useState(() => (initialStart ? initialStart.startOf('day') : dayjs().startOf('day')));
  const [slot, setSlot] = useState(() =>
    initialStart && numParam(params.get('pitchId')) ? { pitchId: numParam(params.get('pitchId')), start: toApiDate(initialStart) } : null
  );
  const [duration, setDuration] = useState(60);

  // Kadro
  const [matchName, setMatchName] = useState('');
  const [description, setDescription] = useState('');
  const [userCount, setUserCount] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matchType, setMatchType] = useState(numParam(params.get('homeTeamId')) ? 'team' : 'open');
  const [homeTeamId, setHomeTeamId] = useState(numParam(params.get('homeTeamId')));
  const [opponentMode, setOpponentMode] = useState('looking');
  const [awayTeamId, setAwayTeamId] = useState();

  // Ekstralar
  const [cleatCount, setCleatCount] = useState(0);
  const [cameraRequested, setCameraRequested] = useState(false);

  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  /* ---------- Veri ---------- */
  useEffect(() => {
    venuesApi
      .list()
      .then((r) => setVenues(r || []))
      .catch((e) => message.error(apiErrorMessage(e, t('venues:shared.venuesLoadError'))))
      .finally(() => setVenuesLoading(false));
    api
      .get('/api/Team/GetTeamList')
      .then((r) => setTeams(r.data || []))
      .catch(() => {});
  }, [message, t]);

  useEffect(() => {
    if (!stadiumId) {
      setVenue(null);
      return undefined;
    }
    let alive = true;
    setVenueLoading(true);
    venuesApi
      .detail(stadiumId)
      .then((d) => alive && setVenue(d))
      .catch((e) => alive && message.error(apiErrorMessage(e, t('venues:shared.venueLoadError'))))
      .finally(() => alive && setVenueLoading(false));
    return () => {
      alive = false;
    };
  }, [stadiumId, message, t]);

  const pitch = useMemo(() => venue?.pitches?.find((p) => p.pitchId === slot?.pitchId) || null, [venue, slot?.pitchId]);
  // Kişi sayısı aralığı ve süreler sunucu parametrelerinden (GET /api/Parameters/Public) gelir
  const publicParams = usePublicParams();
  const perSide = pitch?.playersPerSide || 7;
  const { min: minPlayers, max: maxPlayers } = bookingUserCountRange(perSide, publicParams.get);
  const players = userCount || perSide * 2;
  const durations = publicParams.get('venue.allowedDurations');

  // Saha değişince oyuncu sayısını sahaya göre ayarla
  useEffect(() => {
    if (pitch) setUserCount((c) => (c && c >= minPlayers && c <= maxPlayers ? c : pitch.playersPerSide * 2));
  }, [pitch, minPlayers, maxPlayers]);

  // İzin verilen süreler değişirse (parametreler yüklendi) geçersiz seçimi ilk seçeneğe çek
  useEffect(() => {
    if (durations.length && !durations.includes(duration)) setDuration(durations[0]);
  }, [durations, duration]);

  // Tesiste olmayan ekstraları sıfırla
  useEffect(() => {
    if (!venue) return;
    if (!venue.amenities?.cleatRental) setCleatCount(0);
    if (!venue.amenities?.camera) setCameraRequested(false);
  }, [venue]);

  /* ---------- Fiyat teklifi (debounce) ---------- */
  useEffect(() => {
    if (!slot?.pitchId || !slot?.start) {
      setQuote(null);
      setQuoting(false);
      return undefined;
    }
    let alive = true;
    setQuoting(true);
    const timer = setTimeout(() => {
      venuesApi
        .quote({ pitchId: slot.pitchId, start: slot.start, durationMinutes: duration, userCount: players, cleatCount: cleatCount || 0, cameraRequested })
        .then((q) => alive && setQuote(q))
        .catch((e) => alive && setQuote({ available: false, reason: apiErrorMessage(e, t('venues:createMatch.quoteError')) }))
        .finally(() => alive && setQuoting(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [slot?.pitchId, slot?.start, duration, players, cleatCount, cameraRequested, t]);

  /* ---------- Takımlar ---------- */
  const myTeams = useMemo(() => teams.filter((tm) => (tm.playerId || []).includes(myId)), [teams, myId]);
  const otherTeams = useMemo(() => teams.filter((tm) => !(tm.playerId || []).includes(myId)), [teams, myId]);
  const teamOption = (tm) => ({
    value: tm.teamId,
    label: t('venues:createMatch.teamOption', { name: tm.teamName, count: (tm.playerId || []).length }),
  });
  const durationOptions = durations.map((d) => ({ value: d, label: t('venues:createMatch.minutes', { count: d }) }));

  /* ---------- Aksiyonlar ---------- */
  const changeVenue = (id) => {
    setStadiumId(id);
    setSlot(null);
    setQuote(null);
  };
  const changeDate = (d) => {
    setDate(d);
    setSlot(null);
  };
  const pickSlot = (s, p) => setSlot({ pitchId: p.pitchId, start: toApiDate(s.start) });

  const step1Ok = !!(venue && pitch && slot && quote && quote.available !== false && !quoting);
  const step2Error = !matchName.trim()
    ? t('venues:createMatch.errors.nameRequired')
    : matchType === 'team' && !homeTeamId
      ? t('venues:createMatch.errors.teamRequired')
      : matchType === 'team' && opponentMode === 'invite' && !awayTeamId
        ? t('venues:createMatch.errors.opponentRequired')
        : null;

  const next = () => {
    if (step === 0) {
      if (!step1Ok) return;
      if (!matchName.trim() && slot) {
        const s = dayjs(slot.start);
        const part = s.hour() >= 17 ? 'evening' : s.hour() >= 12 ? 'noon' : 'morning';
        setMatchName(t(`venues:createMatch.autoName.${part}`, { day: s.format('dddd') }));
      }
    }
    if (step === 1 && step2Error) {
      message.warning(step2Error);
      return;
    }
    setStep((s) => s + 1);
  };

  const submit = async () => {
    if (step2Error) {
      setStep(1);
      message.warning(step2Error);
      return;
    }
    setSubmitting(true);
    const body = {
      matchName: matchName.trim(),
      description: description.trim(),
      userCount: players,
      pitchId: slot.pitchId,
      matchDate: slot.start,
      durationMinutes: duration,
      cleatCount: cleatCount || 0,
      cameraRequested: !!cameraRequested,
      homeTeamId: matchType === 'team' ? homeTeamId : null,
      awayTeamId: matchType === 'team' && opponentMode === 'invite' ? awayTeamId : null,
      lookingForOpponent: matchType === 'team' && opponentMode === 'looking',
    };
    try {
      const res = await venuesApi.createMatch(body);
      let matchId = res?.matchId ?? res?.data?.matchId ?? null;
      if (!matchId) {
        try {
          const feed = await matchesApi.feed();
          const mine = feed
            .filter((m) => (m.createdBy?.playerId === myId || m.createdByPlayerId === myId) && dayjs(m.matchDate).isSame(dayjs(slot.start), 'minute'))
            .sort((a, b) => b.matchId - a.matchId)[0];
          matchId = mine?.matchId ?? null;
        } catch {
          /* maç kimliği bulunamazsa sonuç ekranı yine gösterilir */
        }
      }
      setDone({ matchId, message: res?.message });
    } catch (e) {
      message.error(apiErrorMessage(e, t('venues:createMatch.errors.createFailed')));
      // Mesaj metnine değil, hata koduna göre ilgili adıma dön
      const code = errorCode(e);
      if (SLOT_GONE_CODES.includes(code)) {
        setStep(0);
        setSlot(null);
      } else if (SLOT_STEP_CODES.includes(code)) {
        setStep(0);
      } else if (
        /^(MATCH_NAME_|TEAM_|RESERVATION_(HOME|AWAY|SAME|OPPONENT|NOT_HOME))/.test(code || '') ||
        Object.keys(fieldErrorsOf(e) || {}).some((k) => SQUAD_FIELDS.includes(k.toLowerCase()))
      ) {
        setStep(1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- Başarı ekranı ---------- */
  if (done) {
    const s = dayjs(slot.start);
    return (
      <Card className="mb-cm-done">
        <Result
          status="success"
          title={t('venues:createMatch.done.title')}
          subTitle={
            <>
              {venue?.name} · {pitch?.name} · {s.format('DD MMMM dddd, HH:mm')}
              <br />
              {t('venues:createMatch.done.notify')} {matchType === 'team' && t('venues:createMatch.done.teamInvited')}
            </>
          }
          extra={[
            done.matchId ? (
              <Button key="go" type="primary" size="large" icon={<ArrowRightOutlined />} onClick={() => navigate(`/match-details/${done.matchId}`)}>
                {t('venues:createMatch.done.goToMatch')}
              </Button>
            ) : (
              <Button key="home" type="primary" size="large" onClick={() => navigate('/home')}>
                {t('venues:createMatch.done.backHome')}
              </Button>
            ),
            <Button key="cal" size="large" icon={<CalendarOutlined />} onClick={() => navigate('/calendar')}>
              {t('venues:createMatch.done.myCalendar')}
            </Button>,
          ]}
        />
      </Card>
    );
  }

  /* ---------- Adımlar ---------- */
  const venueSummary = venue && (
    <div className="mb-cm-venue">
      {venue.coverPhotoUrl && <img src={mediaUrl(venue.coverPhotoUrl, 'sm')} alt="" loading="lazy" decoding="async" />}
      <div className="mb-cm-venue__text">
        <strong>{venue.name}</strong>
        <span>
          <EnvironmentOutlined /> {[venue.district, venue.city].filter(Boolean).join(', ')}
        </span>
        <VenueRating rating={venue.rating} count={venue.reviewCount} compact />
      </div>
      <Button type="link" onClick={() => navigate(`/venues/${venue.stadiumId}`)}>
        {t('venues:createMatch.viewVenue')}
      </Button>
    </div>
  );

  const stepSlot = (
    <>
      <div className="mb-cm-field">
        <label>{t('venues:createMatch.slot.venue')}</label>
        <Select
          showSearch
          size="large"
          loading={venuesLoading}
          placeholder={t('venues:createMatch.slot.venuePlaceholder')}
          value={stadiumId}
          onChange={changeVenue}
          optionFilterProp="label"
          suffixIcon={<SearchOutlined />}
          options={venues.map((v) => ({ value: v.stadiumId, label: `${v.name} — ${[v.district, v.city].filter(Boolean).join(', ')}` }))}
          style={{ width: '100%' }}
        />
      </div>
      {venueLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : venue ? (
        <>
          {venueSummary}
          <div className="mb-cm-field">
            <label>{t('venues:createMatch.slot.day')}</label>
            <DateStrip value={date} onChange={changeDate} />
          </div>
          <div className="mb-cm-field">
            <label>{t('venues:createMatch.slot.pitchAndTime')}</label>
            <SlotPicker stadiumId={venue.stadiumId} date={date} pitches={venue.pitches || []} selected={slot} onSelect={pickSlot} />
          </div>
          <div className="mb-cm-field">
            <label>{t('venues:createMatch.slot.duration')}</label>
            <Segmented size="large" options={durationOptions} value={duration} onChange={setDuration} />
            {duration > 60 && <p className="mb-hint">{t('venues:createMatch.slot.longMatchHint')}</p>}
          </div>
          {slot && quote?.available === false && !quoting && (
            <Alert
              type="error"
              showIcon
              message={quote.reason || t('venues:createMatch.slot.unavailable')}
              description={t('venues:createMatch.slot.unavailableHint')}
            />
          )}
        </>
      ) : (
        <div className="mb-cm-pick-hint">
          <EnvironmentOutlined />
          <p>{t('venues:createMatch.slot.pickVenueHint')}</p>
          <Button onClick={() => navigate('/venues')}>{t('venues:createMatch.slot.browseVenues')}</Button>
        </div>
      )}
    </>
  );

  const stepSquad = (
    <>
      <Row gutter={16}>
        <Col xs={24} md={16}>
          <div className="mb-cm-field">
            <label>{t('venues:createMatch.squad.matchName')}</label>
            <Input
              size="large"
              maxLength={80}
              value={matchName}
              onChange={(e) => setMatchName(e.target.value)}
              placeholder={t('venues:createMatch.squad.matchNamePlaceholder')}
            />
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className="mb-cm-field">
            <label>{t('venues:createMatch.squad.playerCount')}</label>
            <InputNumber
              size="large"
              min={minPlayers}
              max={maxPlayers}
              value={players}
              onChange={(v) => setUserCount(v)}
              style={{ width: '100%' }}
              addonAfter={t('venues:createMatch.squad.personUnit')}
            />
            <p className="mb-hint">{t('venues:createMatch.squad.pitchSizeHint', { perSide, max: maxPlayers })}</p>
          </div>
        </Col>
      </Row>
      <div className="mb-cm-field">
        <label>{t('venues:createMatch.squad.description')}</label>
        <Input.TextArea
          rows={3}
          maxLength={500}
          showCount
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('venues:createMatch.squad.descriptionPlaceholder')}
        />
      </div>

      <div className="mb-cm-field">
        <label>{t('venues:createMatch.squad.matchType')}</label>
        <Radio.Group value={matchType} onChange={(e) => setMatchType(e.target.value)} className="mb-cm-types">
          <Radio.Button value="open" className="mb-cm-type">
            <GlobalOutlined />
            <strong>{t('venues:createMatch.squad.openMatch')}</strong>
            <span>{t('venues:createMatch.squad.openMatchDesc')}</span>
          </Radio.Button>
          <Radio.Button value="team" className="mb-cm-type">
            <TeamOutlined />
            <strong>{t('venues:createMatch.squad.withTeam')}</strong>
            <span>{t('venues:createMatch.squad.withTeamDesc')}</span>
          </Radio.Button>
        </Radio.Group>
      </div>

      {matchType === 'team' && (
        <div className="mb-cm-team">
          <div className="mb-cm-field">
            <label>{t('venues:createMatch.squad.yourTeam')}</label>
            {myTeams.length ? (
              <Select size="large" placeholder={t('venues:createMatch.squad.yourTeamPlaceholder')} value={homeTeamId} onChange={setHomeTeamId} options={myTeams.map(teamOption)} style={{ width: '100%' }} />
            ) : (
              <Alert
                type="warning"
                showIcon
                message={t('venues:createMatch.squad.noTeam')}
                action={
                  <Button size="small" onClick={() => navigate('/create-team')}>
                    {t('venues:createMatch.squad.createTeam')}
                  </Button>
                }
              />
            )}
            <p className="mb-hint">
              <InfoCircleOutlined /> {t('venues:createMatch.squad.teamInviteHint')}
            </p>
          </div>
          <div className="mb-cm-field">
            <label>{t('venues:createMatch.squad.opponent')}</label>
            <Segmented
              value={opponentMode}
              onChange={setOpponentMode}
              options={[
                { value: 'looking', label: t('venues:createMatch.squad.lookingForOpponent') },
                { value: 'invite', label: t('venues:createMatch.squad.inviteOpponent') },
              ]}
            />
            {opponentMode === 'invite' ? (
              <>
                <Select
                  showSearch
                  optionFilterProp="label"
                  size="large"
                  placeholder={t('venues:createMatch.squad.opponentPlaceholder')}
                  value={awayTeamId}
                  onChange={setAwayTeamId}
                  options={otherTeams.filter((tm) => tm.teamId !== homeTeamId).map(teamOption)}
                  style={{ width: '100%', marginTop: 10 }}
                />
                <p className="mb-hint">{t('venues:createMatch.squad.inviteOpponentHint')}</p>
              </>
            ) : (
              <p className="mb-hint">{t('venues:createMatch.squad.lookingHint')}</p>
            )}
          </div>
        </div>
      )}
    </>
  );

  const hasCleat = venue?.amenities?.cleatRental;
  const hasCamera = venue?.amenities?.camera;
  const stepExtras = (
    <>
      {!hasCleat && !hasCamera ? (
        <div className="mb-cm-pick-hint">
          <CheckOutlined />
          <p>{t('venues:createMatch.extras.none')}</p>
        </div>
      ) : (
        <div className="mb-cm-extras">
          {hasCleat && (
            <div className="mb-cm-extra">
              <span className="mb-cm-extra__icon">{AMENITY_ICONS.cleatRental}</span>
              <div className="mb-cm-extra__text">
                <strong>{t('venues:amenities.cleatRental')}</strong>
                <span>{t('venues:createMatch.extras.perPair', { price: formatPrice(venue.prices?.cleatRentalPrice) })}</span>
              </div>
              <InputNumber
                min={0}
                max={players}
                value={cleatCount}
                onChange={(v) => setCleatCount(v || 0)}
                addonAfter={t('venues:createMatch.extras.pairUnit')}
                style={{ width: 140, maxWidth: '100%' }}
              />
            </div>
          )}
          {hasCamera && (
            <div className="mb-cm-extra">
              <span className="mb-cm-extra__icon">{AMENITY_ICONS.camera}</span>
              <div className="mb-cm-extra__text">
                <strong>{t('venues:amenities.camera')}</strong>
                <span>{t('venues:createMatch.extras.cameraDesc', { price: formatPrice(venue.prices?.cameraPrice) })}</span>
              </div>
              <Switch checked={cameraRequested} onChange={setCameraRequested} />
            </div>
          )}
        </div>
      )}
      <div className="mb-cm-review">
        <h4>{t('venues:createMatch.review.title')}</h4>
        <div>
          <span>{t('venues:createMatch.review.name')}</span>
          <strong>{matchName || '-'}</strong>
        </div>
        <div>
          <span>{t('venues:createMatch.review.squad')}</span>
          <strong>{t('venues:createMatch.review.players', { count: players })}</strong>
        </div>
        <div>
          <span>{t('venues:createMatch.review.type')}</span>
          <strong>
            {matchType === 'open'
              ? t('venues:createMatch.squad.openMatch')
              : t('venues:createMatch.review.versus', {
                  home: myTeams.find((tm) => tm.teamId === homeTeamId)?.teamName || t('venues:createMatch.squad.yourTeam'),
                  away:
                    opponentMode === 'invite'
                      ? otherTeams.find((tm) => tm.teamId === awayTeamId)?.teamName || '?'
                      : t('venues:createMatch.squad.lookingForOpponent'),
                })}
          </strong>
        </div>
        {pitch && (
          <div>
            <span>{t('common:pitch')}</span>
            <strong>
              {pitch.isIndoor ? <HomeOutlined /> : <SunOutlined />} {pitch.name} · {SURFACE[pitch.surface] || ''}
            </strong>
          </div>
        )}
      </div>
    </>
  );

  const contents = [stepSlot, stepSquad, stepExtras];

  return (
    <>
      <PageHeader
        eyebrow={t('venues:createMatch.header.eyebrow')}
        title={t('venues:createMatch.header.title')}
        subtitle={t('venues:createMatch.header.subtitle')}
      />

      <Steps
        current={step}
        className="mb-cm-steps"
        responsive={false}
        labelPlacement={isPhone ? 'vertical' : undefined}
        size={isPhone ? 'small' : undefined}
        onChange={(s) => (s < step || (s === 1 && step1Ok) || (s === 2 && step1Ok && !step2Error) ? setStep(s) : null)}
        items={[
          { title: t('venues:createMatch.steps.slot') },
          { title: t('venues:createMatch.steps.squad') },
          { title: t('venues:createMatch.steps.extras') },
        ]}
      />

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={16}>
          <Card className="mb-cm-card">
            {contents[step]}
            <div className="mb-cm-nav">
              {step > 0 ? (
                <Button size="large" icon={<ArrowLeftOutlined />} onClick={() => setStep((s) => s - 1)}>
                  {t('common:actions.back')}
                </Button>
              ) : (
                <span />
              )}
              {step < 2 ? (
                <Button type="primary" size="large" onClick={next} disabled={step === 0 && !step1Ok}>
                  {t('common:actions.continue')} <ArrowRightOutlined />
                </Button>
              ) : (
                <Button type="primary" size="large" icon={<CheckOutlined />} loading={submitting} disabled={!step1Ok} onClick={submit}>
                  {t('venues:createMatch.submit')}
                </Button>
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <div className="mb-cm-sticky">
            <Receipt
              venue={venue}
              pitch={pitch}
              start={slot?.start}
              duration={duration}
              quote={quote}
              quoting={quoting}
              cleatCount={cleatCount}
              cameraRequested={cameraRequested}
              userCount={players}
            />
          </div>
        </Col>
      </Row>
    </>
  );
}
