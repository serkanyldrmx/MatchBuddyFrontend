import React from 'react';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useMatchWeather, weatherKind, weatherRelevant } from '../api/weather';
import './weather.css';

const round = (v) => (v == null ? null : Math.round(v));

/**
 * Maç saatindeki hava durumu (açık saha). compact: maç kartı rozeti; değilse maç sayfası paneli.
 * Kapalı sahada, tahmin ufku dışında ya da veri yoksa hiçbir şey göstermez.
 */
export default function WeatherBadge({ matchId, matchDate, closed, compact = true }) {
  const { t } = useTranslation();
  const relevant = weatherRelevant(matchDate, closed);
  const w = useMatchWeather(matchId, relevant);
  if (!relevant || !w || !w.available || w.indoor) return null;

  const hour = w.time ? dayjs(w.time).hour() : null;
  const kind = weatherKind(w.weatherCode, hour);
  const temp = round(w.temperature);
  const feels = round(w.apparentTemperature);
  const rain = w.precipitationProbability ?? 0;
  const wind = round(w.windSpeed);
  const wet = rain >= 50 || kind.key === 'rain' || kind.key === 'storm';
  const label = t(`weather:kind.${kind.key}`);

  const details = (
    <div className="mb-weather-tip">
      <strong>
        {kind.icon} {label} · {temp}°
      </strong>
      <span>{t('weather:feelsLike', { value: feels })}</span>
      <span>{t('weather:rainChance', { value: rain })}</span>
      {wind != null && <span>{t('weather:wind', { value: wind })}</span>}
      {w.approximate && <em>{t('weather:approximate')}</em>}
      <small>{t('weather:source')}</small>
    </div>
  );

  if (compact) {
    return (
      <Tooltip title={details}>
        <span className={`mb-weather-chip${wet ? ' is-wet' : ''}`} aria-label={`${label}, ${temp}°, ${t('weather:rainChance', { value: rain })}`}>
          <span className="mb-weather-chip__icon">{kind.icon}</span>
          <b>{temp}°</b>
          {rain >= 20 && <span className="mb-weather-chip__rain">💧{rain}%</span>}
        </span>
      </Tooltip>
    );
  }

  return (
    <div className={`mb-weather-panel${wet ? ' is-wet' : ''}`}>
      <span className="mb-weather-panel__icon">{kind.icon}</span>
      <div className="mb-weather-panel__main">
        <div className="mb-weather-panel__temp">
          <b>{temp}°</b>
          <span>{label}</span>
        </div>
        <div className="mb-weather-panel__meta">
          <span>{t('weather:feelsLike', { value: feels })}</span>
          <span>💧 {t('weather:rainChance', { value: rain })}</span>
          {wind != null && <span>💨 {t('weather:wind', { value: wind })}</span>}
        </div>
        {wet && <div className="mb-weather-panel__hint">{t('weather:wetHint')}</div>}
        {!wet && temp != null && temp >= 30 && <div className="mb-weather-panel__hint">{t('weather:hotHint')}</div>}
        {!wet && temp != null && temp <= 5 && <div className="mb-weather-panel__hint">{t('weather:coldHint')}</div>}
        <small>
          {t('weather:atKickoff', { time: dayjs(w.time).format('HH:mm') })}
          {w.approximate ? ` · ${t('weather:approximate')}` : ''}
        </small>
      </div>
    </div>
  );
}
