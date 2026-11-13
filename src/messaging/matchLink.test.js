// Anlık bağlantı (SignalR/axios) ve i18n bu saf fonksiyonlar için gerekmez
jest.mock('../api/realtime', () => ({ invokeRealtime: jest.fn(), onRealtime: jest.fn(() => () => {}) }));
jest.mock('../i18n', () => ({ __esModule: true, default: { t: (k) => k } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }));

import { matchLinkOf } from './MessageExtras';
import { notificationLink } from '../layout/notificationTypes';

describe('matchLinkOf (sohbetteki maç kartı)', () => {
  it('davet linkini uygulama içi davet sayfasına çevirir', () => {
    const text = '⚽ Çarşamba maçı\n📅 13 Kasım\n2 kişi eksik 👉 https://matcbuddy.com/m/AB12CD34';
    expect(matchLinkOf(text)).toBe('/davet/AB12CD34');
  });

  it('API alan adındaki paylaşım linkini de tanır', () => {
    expect(matchLinkOf('bak: https://api.matcbuddy.com/m/XYZ987?x=1')).toBe('/davet/XYZ987');
  });

  it('maç detay linkini tanır', () => {
    expect(matchLinkOf('https://matcbuddy.com/match-details/42')).toBe('/match-details/42');
  });

  it('başka linklerde ve düz metinde null döner', () => {
    expect(matchLinkOf('https://example.com/mobile')).toBeNull();
    expect(matchLinkOf('selam, maç var mı?')).toBeNull();
    expect(matchLinkOf('')).toBeNull();
  });
});

describe('notificationLink (bildirime dokununca)', () => {
  it('sunucunun verdiği adresi kullanır', () => {
    expect(notificationLink({ url: '/invites', notification: { type: 10, matchId: 3 } })).toBe('/invites');
  });

  it('adres yoksa türüne göre yedek kural uygular', () => {
    expect(notificationLink({ notification: { type: 1, matchId: 7 } })).toBe('/match-details/7');
    expect(notificationLink({ notification: { type: 15, stadiumId: 4 } })).toBe('/venues/4');
    expect(notificationLink({ notification: { type: 9 } })).toBe('/friends');
    expect(notificationLink({ notification: { type: 0 } })).toBe('/home?messages=1');
  });

  it('gidilecek yer yoksa null döner', () => {
    expect(notificationLink({ url: '/NotificationList', notification: { type: 3 } })).toBeNull();
  });
});
