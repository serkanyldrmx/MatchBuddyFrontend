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
import { api } from '../../api/config';
import { matchesApi } from '../../api/matches';
import { formatPrice, SURFACE, venuesApi } from '../../api/venues';
import { PageHeader } from '../../ui';
import { apiErrorMessage, getCurrentUser, mediaUrl } from '../../utils/format';
import SlotPicker, { DateStrip } from './SlotPicker';
import { AMENITY_ICONS, VenueRating } from './Venues';
import './CreateMatch.css';

const DURATIONS = [
  { value: 60, label: '60 dk' },
  { value: 90, label: '90 dk' },
  { value: 120, label: '120 dk' },
];

const toApiDate = (d) => dayjs(d).format('YYYY-MM-DDTHH:mm:ss');
const numParam = (v) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined);

/** Sağdaki rezervasyon fişi */
function Receipt({ venue, pitch, start, duration, quote, quoting, cleatCount, cameraRequested, userCount }) {
  if (!venue || !pitch || !start) {
    return (
      <div className="mb-receipt is-empty">
        <h3 className="mb-receipt__title">Rezervasyon özeti</h3>
        <p className="mb-hint">Tesis, saha ve saat seçince ücret burada hesaplanacak.</p>
      </div>
    );
  }
  const s = dayjs(start);
  const e = s.add(duration, 'minute');
  return (
    <Spin spinning={quoting}>
      <div className="mb-receipt">
        <h3 className="mb-receipt__title">Rezervasyon özeti</h3>
        <div className="mb-receipt__venue">
          {venue.coverPhotoUrl && <img src={mediaUrl(venue.coverPhotoUrl, 'sm')} alt="" loading="lazy" decoding="async" />}
          <div>
            <strong>{venue.name}</strong>
            <span>
              {pitch.name} · {SURFACE[pitch.surface] || 'Saha'} · {pitch.isIndoor ? 'Kapalı' : 'Açık'}
            </span>
          </div>
        </div>
        <div className="mb-receipt__when">
          <span>
            <CalendarOutlined /> {s.format('DD MMMM dddd')}
          </span>
          <span>
            <ClockCircleOutlined /> {s.format('HH:mm')}–{e.format('HH:mm')} · {duration} dk
          </span>
        </div>

        <div className="mb-receipt__lines">
          {(quote?.lines || []).map((l) => (
            <div key={l.label} className="mb-receipt__line">
              <span>
                Saha {l.label}
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
              <span>Krampon × {cleatCount}</span>
              <span>{formatPrice(cleatCount * venue.prices.cleatRentalPrice)}</span>
            </div>
          )}
          {cameraRequested && venue.prices?.cameraPrice != null && (
            <div className="mb-receipt__line">
              <span>Maç kaydı (kamera)</span>
              <span>{formatPrice(venue.prices.cameraPrice)}</span>
            </div>
          )}
        </div>

        {quote && quote.available !== false ? (
          <>
            <div className="mb-receipt__sub">
              <span>Saha</span>
              <span>{formatPrice(quote.pitchTotal)}</span>
            </div>
            {quote.extrasTotal > 0 && (
              <div className="mb-receipt__sub">
                <span>Ekstralar</span>
                <span>{formatPrice(quote.extrasTotal)}</span>
              </div>
            )}
            <div className="mb-receipt__total">
              <span>Toplam</span>
              <strong>{formatPrice(quote.total)}</strong>
            </div>
            <div className="mb-receipt__per">
              <span>Kişi başı</span>
              <strong>{formatPrice(quote.perPlayer)}</strong>
              <small>{userCount} oyuncuya bölünür</small>
            </div>
          </>
        ) : quote?.available === false ? (
          <Alert type="error" showIcon message={quote.reason || 'Bu saat müsait değil.'} />
        ) : null}

        {venue.cancellationPolicy && (
          <div className="mb-receipt__policy">
            <InfoCircleOutlined /> <span>{venue.cancellationPolicy}</span>
          </div>
        )}
        <p className="mb-receipt__note">Ödeme sahada yapılır. Rezervasyon işletme onayından sonra kesinleşir.</p>
      </div>
    </Spin>
  );
}

export default function CreateMatch() {
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
      .catch((e) => message.error(apiErrorMessage(e, 'Tesisler yüklenemedi.')))
      .finally(() => setVenuesLoading(false));
    api
      .get('/api/Team/GetTeamList')
      .then((r) => setTeams(r.data || []))
      .catch(() => {});
  }, [message]);

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
      .catch((e) => alive && message.error(apiErrorMessage(e, 'Tesis yüklenemedi.')))
      .finally(() => alive && setVenueLoading(false));
    return () => {
      alive = false;
    };
  }, [stadiumId, message]);

  const pitch = useMemo(() => venue?.pitches?.find((p) => p.pitchId === slot?.pitchId) || null, [venue, slot?.pitchId]);
  const perSide = pitch?.playersPerSide || 7;
  const maxPlayers = perSide * 2 + 4;
  const players = userCount || perSide * 2;

  // Saha değişince oyuncu sayısını sahaya göre ayarla
  useEffect(() => {
    if (pitch) setUserCount((c) => (c && c >= 8 && c <= pitch.playersPerSide * 2 + 4 ? c : pitch.playersPerSide * 2));
  }, [pitch]);

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
    const t = setTimeout(() => {
      venuesApi
        .quote({ pitchId: slot.pitchId, start: slot.start, durationMinutes: duration, userCount: players, cleatCount: cleatCount || 0, cameraRequested })
        .then((q) => alive && setQuote(q))
        .catch((e) => alive && setQuote({ available: false, reason: apiErrorMessage(e, 'Ücret hesaplanamadı.') }))
        .finally(() => alive && setQuoting(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [slot?.pitchId, slot?.start, duration, players, cleatCount, cameraRequested]);

  /* ---------- Takımlar ---------- */
  const myTeams = useMemo(() => teams.filter((t) => (t.playerId || []).includes(myId)), [teams, myId]);
  const otherTeams = useMemo(() => teams.filter((t) => !(t.playerId || []).includes(myId)), [teams, myId]);
  const teamOption = (t) => ({ value: t.teamId, label: `${t.teamName} · ${(t.playerId || []).length} oyuncu` });

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
    ? 'Maçına bir isim ver.'
    : matchType === 'team' && !homeTeamId
      ? 'Takımını seç.'
      : matchType === 'team' && opponentMode === 'invite' && !awayTeamId
        ? 'Davet edeceğin rakip takımı seç.'
        : null;

  const next = () => {
    if (step === 0) {
      if (!step1Ok) return;
      if (!matchName.trim() && slot) {
        const s = dayjs(slot.start);
        setMatchName(`${s.format('dddd')} ${s.hour() >= 17 ? 'akşam' : s.hour() >= 12 ? 'öğlen' : 'sabah'} maçı`);
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
      message.error(apiErrorMessage(e, 'Rezervasyon oluşturulamadı.'));
      if (e?.response?.status === 400 && /dolu/i.test(apiErrorMessage(e, ''))) {
        setStep(0);
        setSlot(null);
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
          title="Rezervasyon talebin gönderildi!"
          subTitle={
            <>
              {venue?.name} · {pitch?.name} · {s.format('DD MMMM dddd, HH:mm')}
              <br />
              İşletme onayladığında bildirim alacaksın. {matchType === 'team' && 'Takım arkadaşlarına davet gönderildi.'}
            </>
          }
          extra={[
            done.matchId ? (
              <Button key="go" type="primary" size="large" icon={<ArrowRightOutlined />} onClick={() => navigate(`/match-details/${done.matchId}`)}>
                Maç merkezine git
              </Button>
            ) : (
              <Button key="home" type="primary" size="large" onClick={() => navigate('/home')}>
                Fikstüre dön
              </Button>
            ),
            <Button key="cal" size="large" icon={<CalendarOutlined />} onClick={() => navigate('/calendar')}>
              Takvimim
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
        Tesisi incele
      </Button>
    </div>
  );

  const stepSlot = (
    <>
      <div className="mb-cm-field">
        <label>Tesis</label>
        <Select
          showSearch
          size="large"
          loading={venuesLoading}
          placeholder="Anlaşmalı bir tesis seç"
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
            <label>Gün</label>
            <DateStrip value={date} onChange={changeDate} />
          </div>
          <div className="mb-cm-field">
            <label>Saha ve saat</label>
            <SlotPicker stadiumId={venue.stadiumId} date={date} pitches={venue.pitches || []} selected={slot} onSelect={pickSlot} />
          </div>
          <div className="mb-cm-field">
            <label>Süre</label>
            <Segmented size="large" options={DURATIONS} value={duration} onChange={setDuration} />
            {duration > 60 && <p className="mb-hint">Uzun maçlarda sonraki saat(ler)in de boş olması gerekir; bunu senin için kontrol ediyoruz.</p>}
          </div>
          {slot && quote?.available === false && !quoting && (
            <Alert type="error" showIcon message={quote.reason || 'Seçtiğin süre için saha müsait değil.'} description="Süreyi kısalt ya da başka bir saat seç." />
          )}
        </>
      ) : (
        <div className="mb-cm-pick-hint">
          <EnvironmentOutlined />
          <p>Maç kurmak için önce anlaşmalı bir tesis seç.</p>
          <Button onClick={() => navigate('/venues')}>Tesislere göz at</Button>
        </div>
      )}
    </>
  );

  const stepSquad = (
    <>
      <Row gutter={16}>
        <Col xs={24} md={16}>
          <div className="mb-cm-field">
            <label>Maç adı</label>
            <Input size="large" maxLength={80} value={matchName} onChange={(e) => setMatchName(e.target.value)} placeholder="Örn. Perşembe akşam maçı" />
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className="mb-cm-field">
            <label>Oyuncu sayısı</label>
            <InputNumber size="large" min={8} max={maxPlayers} value={players} onChange={(v) => setUserCount(v)} style={{ width: '100%' }} addonAfter="kişi" />
            <p className="mb-hint">
              {perSide}+{perSide} saha · en fazla {maxPlayers}
            </p>
          </div>
        </Col>
      </Row>
      <div className="mb-cm-field">
        <label>Açıklama</label>
        <Input.TextArea rows={3} maxLength={500} showCount value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Seviye, forma rengi, buluşma noktası…" />
      </div>

      <div className="mb-cm-field">
        <label>Maç türü</label>
        <Radio.Group value={matchType} onChange={(e) => setMatchType(e.target.value)} className="mb-cm-types">
          <Radio.Button value="open" className="mb-cm-type">
            <GlobalOutlined />
            <strong>Açık maç</strong>
            <span>Herkes katılabilir, kadroyu birlikte tamamlarsınız.</span>
          </Radio.Button>
          <Radio.Button value="team" className="mb-cm-type">
            <TeamOutlined />
            <strong>Takımımla</strong>
            <span>Kendi takımınla sahaya çık, rakibini davet et ya da ara.</span>
          </Radio.Button>
        </Radio.Group>
      </div>

      {matchType === 'team' && (
        <div className="mb-cm-team">
          <div className="mb-cm-field">
            <label>Takımın</label>
            {myTeams.length ? (
              <Select size="large" placeholder="Takımını seç" value={homeTeamId} onChange={setHomeTeamId} options={myTeams.map(teamOption)} style={{ width: '100%' }} />
            ) : (
              <Alert
                type="warning"
                showIcon
                message="Henüz bir takımın yok."
                action={
                  <Button size="small" onClick={() => navigate('/create-team')}>
                    Takım kur
                  </Button>
                }
              />
            )}
            <p className="mb-hint">
              <InfoCircleOutlined /> Takımındaki herkese otomatik davet gider; kabul edenler ev sahibi tarafına yerleşir.
            </p>
          </div>
          <div className="mb-cm-field">
            <label>Rakip</label>
            <Segmented
              value={opponentMode}
              onChange={setOpponentMode}
              options={[
                { value: 'looking', label: 'Rakip aranıyor' },
                { value: 'invite', label: 'Rakip takım davet et' },
              ]}
            />
            {opponentMode === 'invite' ? (
              <>
                <Select
                  showSearch
                  optionFilterProp="label"
                  size="large"
                  placeholder="Rakip takımı seç"
                  value={awayTeamId}
                  onChange={setAwayTeamId}
                  options={otherTeams.filter((t) => t.teamId !== homeTeamId).map(teamOption)}
                  style={{ width: '100%', marginTop: 10 }}
                />
                <p className="mb-hint">Rakip takımın üyelerine de davet gider, deplasman tarafına yerleşirler.</p>
              </>
            ) : (
              <p className="mb-hint">Maçın "Rakip aranıyor" olarak listelenir; bir takım rakip olarak katılabilir.</p>
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
          <p>Bu tesiste ek hizmet yok. Özeti kontrol edip rezervasyonunu gönderebilirsin.</p>
        </div>
      ) : (
        <div className="mb-cm-extras">
          {hasCleat && (
            <div className="mb-cm-extra">
              <span className="mb-cm-extra__icon">{AMENITY_ICONS.cleatRental}</span>
              <div className="mb-cm-extra__text">
                <strong>Krampon kiralama</strong>
                <span>{formatPrice(venue.prices?.cleatRentalPrice)} / çift</span>
              </div>
              <InputNumber min={0} max={players} value={cleatCount} onChange={(v) => setCleatCount(v || 0)} addonAfter="çift" style={{ width: 140, maxWidth: '100%' }} />
            </div>
          )}
          {hasCamera && (
            <div className="mb-cm-extra">
              <span className="mb-cm-extra__icon">{AMENITY_ICONS.camera}</span>
              <div className="mb-cm-extra__text">
                <strong>Maç kaydı (kamera)</strong>
                <span>{formatPrice(venue.prices?.cameraPrice)} · maç sonrası videoyu al</span>
              </div>
              <Switch checked={cameraRequested} onChange={setCameraRequested} />
            </div>
          )}
        </div>
      )}
      <div className="mb-cm-review">
        <h4>Maç</h4>
        <div>
          <span>Ad</span>
          <strong>{matchName || '-'}</strong>
        </div>
        <div>
          <span>Kadro</span>
          <strong>{players} oyuncu</strong>
        </div>
        <div>
          <span>Tür</span>
          <strong>
            {matchType === 'open'
              ? 'Açık maç'
              : `${myTeams.find((t) => t.teamId === homeTeamId)?.teamName || 'Takımın'} vs ${
                  opponentMode === 'invite' ? otherTeams.find((t) => t.teamId === awayTeamId)?.teamName || '?' : 'Rakip aranıyor'
                }`}
          </strong>
        </div>
        {pitch && (
          <div>
            <span>Saha</span>
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
      <PageHeader eyebrow="Rezervasyon" title="Maç Kur" subtitle="Sahanı seç, kadronu kur, kişi başı ücreti anında gör." />

      <Steps
        current={step}
        className="mb-cm-steps"
        responsive={false}
        labelPlacement={isPhone ? 'vertical' : undefined}
        size={isPhone ? 'small' : undefined}
        onChange={(s) => (s < step || (s === 1 && step1Ok) || (s === 2 && step1Ok && !step2Error) ? setStep(s) : null)}
        items={[{ title: 'Saha & saat' }, { title: 'Kadro & takım' }, { title: 'Ekstralar & özet' }]}
      />

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={16}>
          <Card className="mb-cm-card">
            {contents[step]}
            <div className="mb-cm-nav">
              {step > 0 ? (
                <Button size="large" icon={<ArrowLeftOutlined />} onClick={() => setStep((s) => s - 1)}>
                  Geri
                </Button>
              ) : (
                <span />
              )}
              {step < 2 ? (
                <Button type="primary" size="large" onClick={next} disabled={step === 0 && !step1Ok}>
                  Devam <ArrowRightOutlined />
                </Button>
              ) : (
                <Button type="primary" size="large" icon={<CheckOutlined />} loading={submitting} disabled={!step1Ok} onClick={submit}>
                  Rezervasyon talebi gönder
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
