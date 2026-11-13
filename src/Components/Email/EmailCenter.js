import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Skeleton,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { EditOutlined, EyeOutlined, MailOutlined, PlusOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { AUDIENCE, CAMPAIGN_STATUS, EMAIL_FIELDS, emailApi } from '../../api/email';
import { PageHeader } from '../../ui';
import { SwipeTabs } from '../../ui/Swipe';
import { apiErrorMessage } from '../../utils/format';
import './EmailCenter.css';

const { Text, Paragraph } = Typography;

const STATUS_COLOR = { 0: 'blue', 1: 'gold', 2: 'green', 3: 'default' };

/** Konu / gövde / düğme alanları + yardımcılar (önizleme, kendine test) — şablon ve gönderim formu ortak */
function ContentFields({ area, form }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const values = () => form.getFieldsValue(['subject', 'body', 'buttonText', 'buttonUrl']);
  const showPreview = async () => {
    setBusy(true);
    try {
      setPreview(await emailApi.preview(area, values()));
    } catch (e) {
      message.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const sendTest = async () => {
    try {
      await form.validateFields(['subject', 'body']);
    } catch {
      return;
    }
    setBusy(true);
    try {
      const r = await emailApi.sendTest(area, values());
      message.success(r?.message || t('email:test.sent'));
    } catch (e) {
      message.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const insert = (field) => {
    const body = form.getFieldValue('body') || '';
    form.setFieldsValue({ body: `${body}{{${field}}}` });
  };

  return (
    <>
      <Form.Item name="subject" label={t('email:form.subject')} rules={[{ required: true, whitespace: true, message: t('validation:required') }, { max: 200 }]}>
        <Input maxLength={200} placeholder={t('email:form.subjectPlaceholder')} />
      </Form.Item>
      <Form.Item
        name="body"
        label={t('email:form.body')}
        extra={t('email:form.bodyHint')}
        rules={[{ required: true, whitespace: true, message: t('validation:required') }, { max: 5000 }]}
      >
        <Input.TextArea rows={8} maxLength={5000} showCount />
      </Form.Item>
      <div className="mb-email-fields">
        <Text type="secondary">{t('email:form.fields')}</Text>
        {EMAIL_FIELDS.map((f) => (
          <Tag key={f} className="mb-email-field" onClick={() => insert(f)}>
            {`{{${f}}}`}
          </Tag>
        ))}
      </div>
      <div className="mb-email-button-row">
        <Form.Item name="buttonText" label={t('email:form.buttonText')} rules={[{ max: 60 }]}>
          <Input maxLength={60} placeholder={t('email:form.buttonTextPlaceholder')} />
        </Form.Item>
        <Form.Item name="buttonUrl" label={t('email:form.buttonUrl')} rules={[{ max: 500 }]}>
          <Input maxLength={500} placeholder="https://matcbuddy.com/home" inputMode="url" autoCapitalize="none" />
        </Form.Item>
      </div>
      <Space wrap>
        <Button icon={<EyeOutlined />} onClick={showPreview} loading={busy}>
          {t('email:form.preview')}
        </Button>
        <Button icon={<MailOutlined />} onClick={sendTest} loading={busy}>
          {t('email:form.sendTest')}
        </Button>
      </Space>
      <Modal open={!!preview} onCancel={() => setPreview(null)} footer={null} title={preview?.subject} width={640} destroyOnClose>
        {preview && <iframe title="preview" className="mb-email-preview" sandbox="" srcDoc={preview.html} />}
      </Modal>
    </>
  );
}

/** Toplu / düzenli gönderim oluşturma */
function CampaignModal({ area, open, onClose, onSaved, templates }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState(null);
  const isOwner = area === 'Owner';
  const audience = Form.useWatch('audience', form);
  const when = Form.useWatch('when', form);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ audience: isOwner ? AUDIENCE.VENUE_CUSTOMERS : AUDIENCE.CONSENTED, when: 'now', repeat: 'once' });
  }, [open, form, isOwner]);

  useEffect(() => {
    if (!open || audience === undefined) return;
    setCount(null);
    emailApi
      .audienceCount(area, audience)
      .then(setCount)
      .catch(() => setCount(null));
  }, [open, area, audience]);

  const fromTemplate = (id) => {
    const tpl = templates.find((x) => x.emailTemplateId === id);
    if (tpl) form.setFieldsValue({ subject: tpl.subject, body: tpl.body, buttonText: tpl.buttonText, buttonUrl: tpl.buttonUrl });
  };

  const save = async (v) => {
    setSaving(true);
    try {
      const r = await emailApi.saveCampaign(area, {
        subject: v.subject,
        body: v.body,
        buttonText: v.buttonText || null,
        buttonUrl: v.buttonUrl || null,
        audience: v.audience,
        scheduledAt: v.when === 'later' && v.at ? v.at.format('YYYY-MM-DDTHH:mm:ss') : null,
        repeatDays: v.repeat === 'weekly' ? 7 : v.repeat === 'monthly' ? 30 : null,
      });
      message.success(r?.message || t('email:campaign.saved'));
      onSaved();
      onClose();
    } catch (e) {
      message.error(apiErrorMessage(e, t('email:campaign.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const audiences = isOwner
    ? [{ value: AUDIENCE.VENUE_CUSTOMERS, label: t('email:audience.venueCustomers') }]
    : [
        { value: AUDIENCE.CONSENTED, label: t('email:audience.consented') },
        { value: AUDIENCE.OWNERS, label: t('email:audience.owners') },
        { value: AUDIENCE.ALL_SERVICE, label: t('email:audience.allService') },
      ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('email:campaign.new')}
      okText={when === 'later' ? t('email:campaign.schedule') : t('email:campaign.sendNow')}
      okButtonProps={{ icon: <SendOutlined /> }}
      onOk={() => form.submit()}
      confirmLoading={saving}
      width={720}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={save} requiredMark={false}>
        {templates.length > 0 && (
          <Form.Item label={t('email:campaign.fromTemplate')}>
            <Select
              allowClear
              placeholder={t('email:campaign.fromTemplatePlaceholder')}
              onChange={fromTemplate}
              options={templates.map((x) => ({ value: x.emailTemplateId, label: x.name }))}
            />
          </Form.Item>
        )}
        <Form.Item name="audience" label={t('email:campaign.audience')} extra={count !== null && t('email:campaign.recipients', { count })}>
          <Select options={audiences} />
        </Form.Item>
        {audience === AUDIENCE.ALL_SERVICE && <Alert type="warning" showIcon message={t('email:audience.allServiceWarning')} style={{ marginBottom: 16 }} />}
        {isOwner && <Alert type="info" showIcon message={t('email:audience.ownerRules')} style={{ marginBottom: 16 }} />}
        <ContentFields area={area} form={form} />
        <div className="mb-email-schedule">
          <Form.Item name="when" label={t('email:campaign.when')}>
            <Radio.Group
              optionType="button"
              options={[
                { value: 'now', label: t('email:campaign.now') },
                { value: 'later', label: t('email:campaign.later') },
              ]}
            />
          </Form.Item>
          {when === 'later' && (
            <Form.Item name="at" label={t('email:campaign.at')} rules={[{ required: true, message: t('validation:required') }]}>
              <DatePicker
                showTime={{ format: 'HH:mm', minuteStep: 5 }}
                format="DD.MM.YYYY HH:mm"
                disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
                inputReadOnly
              />
            </Form.Item>
          )}
          <Form.Item name="repeat" label={t('email:campaign.repeat')}>
            <Select
              style={{ minWidth: 160 }}
              options={[
                { value: 'once', label: t('email:campaign.repeatOnce') },
                { value: 'weekly', label: t('email:campaign.repeatWeekly') },
                { value: 'monthly', label: t('email:campaign.repeatMonthly') },
              ]}
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}

/** Şablon düzenleme */
function TemplateModal({ area, template, open, onClose, onSaved }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(template ? { ...template } : { isActive: true });
  }, [open, template, form]);

  const save = async (v) => {
    setSaving(true);
    try {
      await emailApi.saveTemplate(area, { ...v, emailTemplateId: template?.emailTemplateId });
      message.success(t('common:status.saved'));
      onSaved();
      onClose();
    } catch (e) {
      message.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={template ? template.name : t('email:template.new')}
      okText={t('common:actions.save')}
      onOk={() => form.submit()}
      confirmLoading={saving}
      width={720}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={save} requiredMark={false}>
        {template?.isSystem && <Alert type="info" showIcon message={t(`email:template.system.${template.key}`, t('email:template.systemHint'))} style={{ marginBottom: 16 }} />}
        <Form.Item name="name" label={t('email:template.name')} rules={[{ required: true, whitespace: true, message: t('validation:required') }, { max: 100 }]}>
          <Input maxLength={100} />
        </Form.Item>
        <ContentFields area={area} form={form} />
        <Form.Item name="isActive" label={t('email:template.active')} valuePropName="checked" style={{ marginTop: 16 }}>
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/**
 * E-posta merkezi: toplu / düzenli gönderimler ve şablonlar.
 * area="Admin": yönetim paneli (tüm oyuncular / işletmeler), area="Owner": işletme paneli (tesis müşterileri).
 */
export default function EmailCenter({ area = 'Admin' }) {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [tab, setTab] = useState('campaigns');
  const [campaigns, setCampaigns] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState(null);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [editing, setEditing] = useState(undefined); // undefined: kapalı, null: yeni, obje: düzenle

  const load = useCallback(() => {
    setError(null);
    Promise.all([emailApi.campaigns(area), emailApi.templates(area)])
      .then(([c, tp]) => {
        setCampaigns(c);
        setTemplates(tp);
      })
      .catch((e) => setError(apiErrorMessage(e, t('email:loadError'))));
  }, [area, t]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = (c) =>
    modal.confirm({
      title: t('email:campaign.cancelConfirm'),
      okText: t('email:campaign.cancel'),
      okButtonProps: { danger: true },
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        try {
          await emailApi.cancelCampaign(area, c.emailCampaignId);
          load();
        } catch (e) {
          message.error(apiErrorMessage(e));
        }
      },
    });

  const removeTemplate = (tp) =>
    modal.confirm({
      title: t('email:template.deleteConfirm', { name: tp.name }),
      okText: t('common:actions.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common:actions.cancel'),
      onOk: async () => {
        try {
          await emailApi.deleteTemplate(area, tp.emailTemplateId);
          load();
        } catch (e) {
          message.error(apiErrorMessage(e));
        }
      },
    });

  const audienceLabel = useMemo(
    () => ({
      [AUDIENCE.CONSENTED]: t('email:audience.consented'),
      [AUDIENCE.OWNERS]: t('email:audience.owners'),
      [AUDIENCE.ALL_SERVICE]: t('email:audience.allService'),
      [AUDIENCE.VENUE_CUSTOMERS]: t('email:audience.venueCustomers'),
    }),
    [t]
  );

  const campaignList =
    campaigns === null ? (
      <Skeleton active />
    ) : campaigns.length === 0 ? (
      <Empty description={t('email:campaign.empty')}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCampaignOpen(true)}>
          {t('email:campaign.new')}
        </Button>
      </Empty>
    ) : (
      <div className="mb-email-list">
        {campaigns.map((c) => (
          <Card key={c.emailCampaignId} size="small" bordered={false} className="mb-email-card">
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                <Text strong>{c.subject}</Text>
                <Tag color={STATUS_COLOR[c.status]}>{t(`email:status.${c.status}`)}</Tag>
              </Space>
              <Text type="secondary">
                {audienceLabel[c.audience]} ·{' '}
                {c.status === CAMPAIGN_STATUS.SCHEDULED
                  ? t('email:campaign.nextAt', { date: dayjs(c.scheduledAt).format('DD.MM.YYYY HH:mm') })
                  : c.lastSentAt
                    ? t('email:campaign.lastAt', { date: dayjs(c.lastSentAt).format('DD.MM.YYYY HH:mm') })
                    : ''}
                {c.repeatDays ? ` · ${t(c.repeatDays === 7 ? 'email:campaign.repeatWeekly' : 'email:campaign.repeatMonthly')}` : ''}
              </Text>
              <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                {c.body}
              </Paragraph>
              <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                <Text>{t('email:campaign.sentCount', { count: c.sentCount })}</Text>
                {c.status === CAMPAIGN_STATUS.SCHEDULED && (
                  <Button size="small" danger icon={<StopOutlined />} onClick={() => cancel(c)}>
                    {t('email:campaign.cancel')}
                  </Button>
                )}
              </Space>
            </Space>
          </Card>
        ))}
      </div>
    );

  const templateList = (
    <div className="mb-email-list">
      {templates.map((tp) => (
        <Card key={tp.emailTemplateId} size="small" bordered={false} className="mb-email-card">
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
              <Text strong>{tp.name}</Text>
              <Space size={4}>
                {tp.isSystem && <Tag color="purple">{t('email:template.systemTag')}</Tag>}
                <Tag color={tp.isActive ? 'green' : 'default'}>{tp.isActive ? t('email:template.on') : t('email:template.off')}</Tag>
              </Space>
            </Space>
            <Text type="secondary">{tp.subject}</Text>
            <Space wrap>
              <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(tp)}>
                {t('common:actions.edit')}
              </Button>
              {!tp.isSystem && (
                <Button size="small" danger onClick={() => removeTemplate(tp)}>
                  {t('common:actions.delete')}
                </Button>
              )}
            </Space>
          </Space>
        </Card>
      ))}
      {templates.length === 0 && <Empty description={t('email:template.empty')} />}
    </div>
  );

  return (
    <SwipeTabs>
      <PageHeader
        eyebrow={t(area === 'Owner' ? 'email:eyebrowOwner' : 'email:eyebrow')}
        title={t('email:title')}
        subtitle={t(area === 'Owner' ? 'email:subtitleOwner' : 'email:subtitle')}
        icon={<MailOutlined />}
        extra={[
          <Button key="tpl" icon={<PlusOutlined />} onClick={() => setEditing(null)}>
            {t('email:template.new')}
          </Button>,
          <Button key="new" type="primary" icon={<SendOutlined />} onClick={() => setCampaignOpen(true)}>
            {t('email:campaign.new')}
          </Button>,
        ]}
      />
      {error ? (
        <Card bordered={false}>
          <Empty description={error}>
            <Button onClick={load}>{t('common:actions.retry')}</Button>
          </Empty>
        </Card>
      ) : (
        <Card bordered={false}>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              { key: 'campaigns', label: t('email:tabs.campaigns'), children: campaignList },
              { key: 'templates', label: t('email:tabs.templates', { count: templates.length }), children: templateList },
            ]}
          />
        </Card>
      )}
      <CampaignModal area={area} open={campaignOpen} onClose={() => setCampaignOpen(false)} onSaved={load} templates={templates} />
      <TemplateModal area={area} template={editing} open={editing !== undefined} onClose={() => setEditing(undefined)} onSaved={load} />
    </SwipeTabs>
  );
}
