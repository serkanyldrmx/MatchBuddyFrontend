import React from 'react';
import { Tooltip } from 'antd';
import { SafetyCertificateFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import './reliability.css';

/**
 * Güvenilirlik rozeti: seviye rengi + puan. Kurucu, oyuncuyu kabul ederken / kadroya bakarken görür.
 * reliability: { score, level, completedMatches } (sunucudan)
 */
export default function ReliabilityBadge({ reliability, compact = false }) {
  const { t } = useTranslation();
  if (!reliability) return null;
  const { score, level = 'new', completedMatches = 0 } = reliability;
  const label = t(`common:reliability.level.${level}`);
  const tip = level === 'new'
    ? t('common:reliability.tipNew', { count: completedMatches })
    : t('common:reliability.tip', { score, label, count: completedMatches });
  return (
    <Tooltip title={tip}>
      <span className={`mb-rel is-${level}${compact ? ' is-compact' : ''}`} aria-label={tip}>
        <SafetyCertificateFilled />
        {level === 'new' ? (compact ? null : <span>{label}</span>) : <span>{score}</span>}
      </span>
    </Tooltip>
  );
}
