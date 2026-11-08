import React, { useMemo, useState } from 'react';
import { Alert, App, Button, Card, Col, Input, Row, Segmented, Skeleton, Space, Typography } from 'antd';
import { EditOutlined, MessageOutlined, StarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ownerApi } from '../api/venues';
import { useOwnerVenue } from '../layout/VenueLayout';
import { EmptyState, PageHeader, PlayerAvatar } from '../ui';
import { apiErrorMessage, formatDate, fromNow, fullName } from '../utils/format';
import { Stars, WriteButton, asList, notifyOwnerChanged, useOwnerData } from './shared';

const { Text } = Typography;

function ReviewItem({ review, onSaved }) {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const { membershipActive } = useOwnerVenue();
  const [editing, setEditing] = useState(!review.ownerReply);
  const [text, setText] = useState(review.ownerReply || '');
  const [saving, setSaving] = useState(false);
  const match = review.match || {};
  const matchName = match.matchName || review.matchName;
  const matchDate = match.matchDate || match.start || review.matchDate;

  const save = async () => {
    setSaving(true);
    try {
      await ownerApi.reply(review.reviewId, text.trim());
      message.success(t('owner:reviews.replyPublished'));
      onSaved(review.reviewId, text.trim());
      setEditing(false);
      notifyOwnerChanged();
    } catch (e) {
      message.error(apiErrorMessage(e, t('owner:reviews.replyFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-owner-review">
      <div className="mb-owner-review__head">
        <PlayerAvatar player={review.player} size={42} />
        <div className="mb-owner-review__who">
          <Text strong>{fullName(review.player)}</Text>
          <span>
            {matchName ? `${matchName}${matchDate ? ` · ${formatDate(matchDate)}` : ''}` : t('owner:reviews.noMatchInfo')}
          </span>
        </div>
        <div className="mb-owner-review__rating">
          <Stars value={review.rating} size={15} />
          <span>{fromNow(review.createdAt)}</span>
        </div>
      </div>
      {review.comment ? <p className="mb-owner-review__comment">{review.comment}</p> : <Text type="secondary">{t('owner:reviews.ratingOnly')}</Text>}

      {!editing && review.ownerReply ? (
        <div className="mb-owner-review__reply">
          <div className="mb-owner-review__reply-head">
            <span>
              <MessageOutlined /> {t('owner:reviews.ownerReply')}
              {review.repliedAt ? ` · ${fromNow(review.repliedAt)}` : ''}
            </span>
            <WriteButton size="small" type="text" icon={<EditOutlined />} onClick={() => setEditing(true)}>
              {t('common:actions.edit')}
            </WriteButton>
          </div>
          <p>{review.ownerReply}</p>
        </div>
      ) : (
        <div className="mb-owner-review__form">
          <Input.TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={500}
            showCount
            disabled={!membershipActive}
            placeholder={t('owner:reviews.replyPlaceholder')}
          />
          <Space style={{ marginTop: 8 }}>
            {review.ownerReply && (
              <Button
                size="small"
                onClick={() => {
                  setText(review.ownerReply);
                  setEditing(false);
                }}
              >
                {t('common:actions.cancel')}
              </Button>
            )}
            <WriteButton size="small" type="primary" onClick={save} loading={saving} disabled={!text.trim()}>
              {review.ownerReply ? t('owner:reviews.updateReply') : t('owner:reviews.reply')}
            </WriteButton>
          </Space>
        </div>
      )}
    </div>
  );
}

/** Oyuncu yorumları ve puan özeti */
export default function OwnerReviews() {
  const { t } = useTranslation();
  const { venue } = useOwnerVenue();
  const { data, loading, error, setData } = useOwnerData((id) => ownerApi.reviews(id));
  const [filter, setFilter] = useState('all');

  const reviews = useMemo(() => asList(data, 'reviews'), [data]);
  const summary = useMemo(() => {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      if (dist[r.rating] != null) dist[r.rating] += 1;
    });
    const breakdown = data && !Array.isArray(data) && data.ratingBreakdown ? data.ratingBreakdown : dist;
    const count = Object.values(breakdown).reduce((a, b) => a + Number(b || 0), 0);
    const avg =
      data && !Array.isArray(data) && data.rating != null
        ? Number(data.rating)
        : count
          ? Object.entries(breakdown).reduce((a, [k, v]) => a + Number(k) * Number(v || 0), 0) / count
          : 0;
    return { breakdown, count, avg, unanswered: reviews.filter((r) => !r.ownerReply).length };
  }, [data, reviews]);

  const shown = useMemo(() => {
    const list = [...reviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (filter === 'unanswered') return list.filter((r) => !r.ownerReply);
    if (filter === 'low') return list.filter((r) => r.rating <= 3);
    return list;
  }, [reviews, filter]);

  const onSaved = (reviewId, reply) =>
    setData((d) => {
      const patch = (list) => list.map((r) => (r.reviewId === reviewId ? { ...r, ownerReply: reply, repliedAt: new Date().toISOString() } : r));
      return Array.isArray(d) ? patch(d) : { ...d, reviews: patch(asList(d, 'reviews')) };
    });

  return (
    <>
      <PageHeader
        eyebrow={venue?.name}
        title={t('owner:reviews.title')}
        icon={<StarOutlined />}
        subtitle={t('owner:reviews.subtitle')}
      />
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card bordered={false} className="mb-owner-rating">
            {loading && !data ? (
              <Skeleton active />
            ) : (
              <>
                <div className="mb-owner-rating__big">{summary.count ? summary.avg.toFixed(1) : '-'}</div>
                <Stars value={summary.avg} size={20} />
                <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                  {t('owner:reviews.ratingCount', { count: summary.count })}
                </Text>
                <div className="mb-owner-rating__bars">
                  {[5, 4, 3, 2, 1].map((s) => {
                    const n = Number(summary.breakdown[s] || summary.breakdown[String(s)] || 0);
                    const pct = summary.count ? Math.round((n / summary.count) * 100) : 0;
                    return (
                      <div key={s} className="mb-owner-rating__bar">
                        <span>{s} ★</span>
                        <div>
                          <i style={{ width: `${pct}%` }} />
                        </div>
                        <span>{n}</span>
                      </div>
                    );
                  })}
                </div>
                {summary.unanswered > 0 && (
                  <div className="mb-owner-note" style={{ marginTop: 16 }}>
                    {t('owner:reviews.unansweredNote', { count: summary.unanswered })}
                  </div>
                )}
              </>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card
            bordered={false}
            title={t('owner:reviews.listTitle')}
            extra={
              <Segmented
                size="small"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: t('common:all') },
                  { value: 'unanswered', label: t('owner:reviews.filters.unanswered', { count: summary.unanswered }) },
                  { value: 'low', label: t('owner:reviews.filters.low') },
                ]}
              />
            }
          >
            {loading && !data ? (
              <Skeleton active avatar paragraph={{ rows: 4 }} />
            ) : shown.length === 0 ? (
              <EmptyState description={reviews.length ? t('owner:reviews.emptyFilter') : t('owner:reviews.empty')} />
            ) : (
              <div className="mb-owner-reviews">
                {shown.map((r) => (
                  <ReviewItem key={r.reviewId} review={r} onSaved={onSaved} />
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}
