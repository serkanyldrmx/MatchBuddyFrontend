import React, { useEffect, useState } from 'react';
import { App, Button, Modal, Spin } from 'antd';
import { DownloadOutlined, PictureOutlined, ShareAltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { canvasToBlob, renderLineupImage } from './lineupImage';

const safeFileName = (s) =>
  (s || 'mac')
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'mac';

/**
 * Diziliş resmini oluşturur, önizler; telefonda paylaşım menüsüyle (WhatsApp, Instagram…) gönderir ya da indirir.
 * props: Pitch'teki taraflar + maç detayı (bkz. lineupImage.js)
 */
export default function LineupImageModal({ open, onClose, sides, detail, homeLabel, awayLabel, perSide }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [image, setImage] = useState(null); // { url, blob }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    let url = null;
    setImage(null);
    renderLineupImage({ sides, detail, homeLabel, awayLabel, perSide, t })
      .then(canvasToBlob)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setImage({ url, blob });
      })
      .catch(() => alive && message.error(t('match:lineupImage.failed')));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // Açıldığı andaki kadro çizilir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fileName = `matcbuddy-${safeFileName(detail.matchName)}.png`;
  const file = image ? new File([image.blob], fileName, { type: 'image/png' }) : null;
  const canShareFile = !!file && !!navigator.canShare && navigator.canShare({ files: [file] });

  const share = async () => {
    if (!file) return;
    setBusy(true);
    try {
      await navigator.share({ files: [file], title: detail.matchName, text: t('match:lineupImage.shareText', { name: detail.matchName }) });
    } catch (e) {
      if (e?.name !== 'AbortError') message.error(t('match:lineupImage.shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span>
          <PictureOutlined style={{ marginRight: 8 }} />
          {t('match:lineupImage.title')}
        </span>
      }
      footer={[
        <Button key="dl" icon={<DownloadOutlined />} disabled={!image} onClick={download}>
          {t('match:lineupImage.download')}
        </Button>,
        canShareFile && (
          <Button key="share" type="primary" icon={<ShareAltOutlined />} loading={busy} onClick={share}>
            {t('match:lineupImage.share')}
          </Button>
        ),
      ].filter(Boolean)}
      width={460}
      centered
      destroyOnClose
    >
      <div className="mb-lineup-image">
        {image ? (
          <img src={image.url} alt={t('match:lineupImage.alt', { name: detail.matchName })} />
        ) : (
          <div className="mb-lineup-image__loading">
            <Spin />
          </div>
        )}
      </div>
      <p className="mb-hint" style={{ marginBottom: 0 }}>
        {t('match:lineupImage.hint')}
      </p>
    </Modal>
  );
}
