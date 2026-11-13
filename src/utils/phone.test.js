import { formatPhone, phoneDigits, toStoredPhone } from './phone';

describe('telefon girişi (başta sabit 0)', () => {
  it('yazılan her biçimi 10 haneye indirger', () => {
    expect(phoneDigits('05321234567')).toBe('5321234567');
    expect(phoneDigits('+90 532 123 45 67')).toBe('5321234567');
    expect(phoneDigits('532-123-4567')).toBe('5321234567');
    expect(phoneDigits('')).toBe('');
  });

  it('boşsa boş, doluysa 0 ile saklar', () => {
    expect(toStoredPhone('')).toBe('');
    expect(toStoredPhone('5321234567')).toBe('05321234567');
  });

  it('okunur biçimde gösterir', () => {
    expect(formatPhone('05321234567')).toBe('0532 123 45 67');
  });
});
