import React, { useCallback, useEffect, useState } from 'react';
import { App, Badge, Button, Card, Popconfirm, Segmented, Space, Table, Tooltip, Typography } from 'antd';
import { CheckOutlined, FlagOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { adminSocialApi, REPORT_REASONS } from '../api/social';
import i18n from '../i18n';
import { EmptyState, PageHeader, PlayerAvatar } from '../ui';
import { apiErrorMessage, formatDateTime, fromNow, fullName } from '../utils/format';

const { Text } = Typography;

const reasonLabel = (value) => REPORT_REASONS.find((r) => r.value === value)?.label || value || '-';

function PlayerCell({ player, count }) {
  const { t } = useTranslation();
  return (
    <Space size={10}>
      <Badge
        count={count}
        size="small"
        offset={[-4, 4]}
        title={count ? t('admin:reports.totalCount', { count }) : undefined}
      >
        <PlayerAvatar player={player} size={36} />
      </Badge>
      <Space direction="vertical" size={0}>
        <Text strong>{fullName(player)}</Text>
        {player?.userName && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            @{player.userName}
          </Text>
        )}
      </Space>
    </Space>
  );
}

/** Oyuncu şikayetleri */
export default function Reports() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [status, setStatus] = useState(0);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminSocialApi
      .reports(status)
      .then((list) => setReports(list || []))
      .catch((e) => message.error(apiErrorMessage(e, i18n.t('admin:reports.loadFailed'))))
      .finally(() => setLoading(false));
  }, [status, message]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (reportId) => {
    setBusy(reportId);
    try {
      await adminSocialApi.resolve(reportId);
      message.success(t('admin:reports.resolved'));
      setReports((list) => list.filter((r) => r.reportId !== reportId));
    } catch (e) {
      message.error(apiErrorMessage(e, t('admin:reports.updateFailed')));
    } finally {
      setBusy(null);
    }
  };

  const columns = [
    {
      title: t('admin:reports.columns.reported'),
      key: 'reported',
      render: (_, r) => <PlayerCell player={r.reported} count={r.reportedCount} />,
    },
    {
      title: t('admin:reports.columns.reporter'),
      key: 'reporter',
      render: (_, r) => <PlayerCell player={r.reporter} />,
    },
    {
      title: t('admin:reports.columns.reason'),
      dataIndex: 'reason',
      filters: REPORT_REASONS.map((x) => ({ text: x.label, value: x.value })),
      onFilter: (value, r) => r.reason === value,
      render: (v) => <span className="mb-chip is-rejected">{reasonLabel(v)}</span>,
    },
    {
      title: t('admin:reports.columns.details'),
      dataIndex: 'details',
      render: (d) =>
        d ? (
          <Text type="secondary" ellipsis={{ tooltip: d }} style={{ maxWidth: 260 }}>
            {d}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: t('admin:reports.columns.date'),
      dataIndex: 'createdAt',
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      defaultSortOrder: 'descend',
      render: (d) => (
        <Tooltip title={formatDateTime(d)}>
          <Text>{fromNow(d)}</Text>
        </Tooltip>
      ),
    },
    ...(status === 0
      ? [
          {
            title: t('admin:reports.columns.action'),
            key: 'actions',
            align: 'right',
            render: (_, r) => (
              <Popconfirm
                title={t('admin:reports.resolveConfirm')}
                okText={t('admin:reports.mark')}
                cancelText={t('common:actions.cancel')}
                onConfirm={() => resolve(r.reportId)}
              >
                <Button size="small" type="primary" icon={<CheckOutlined />} loading={busy === r.reportId}>
                  {t('admin:reports.markResolved')}
                </Button>
              </Popconfirm>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={t('admin:reports.title')}
        subtitle={t('admin:reports.subtitle')}
        icon={<FlagOutlined />}
        extra={
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            {t('common:actions.refresh')}
          </Button>
        }
      />
      <Card bordered={false}>
        <Space wrap size={12} style={{ marginBottom: 16 }}>
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              {
                label:
                  status === 0 && !loading
                    ? t('admin:reports.tabs.newWithCount', { count: reports.length })
                    : t('admin:reports.tabs.new'),
                value: 0,
              },
              { label: t('admin:reports.tabs.resolved'), value: 1 },
            ]}
          />
        </Space>
        <Table
          rowKey="reportId"
          columns={columns}
          dataSource={reports}
          loading={loading}
          scroll={{ x: 960 }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{
            emptyText: (
              <EmptyState
                description={status === 0 ? t('admin:reports.emptyNew') : t('admin:reports.emptyResolved')}
              />
            ),
          }}
        />
      </Card>
    </>
  );
}
