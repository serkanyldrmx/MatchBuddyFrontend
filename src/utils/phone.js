// Telefon girişi: başta sabit "0", kullanıcı yalnızca 10 haneyi yazar (5xx xxx xx xx).
// Sunucu numarayı "05xxxxxxxxx" biçiminde saklar (MatcBuddy.Core PhoneNumbers.Normalize ile aynı kural).

/** Girilen değeri yalnızca 10 haneye indirger: +90 / 90 / baştaki 0 atılır */
export function phoneDigits(value) {
  let d = String(value ?? '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('90')) d = d.slice(2);
  d = d.replace(/^0+/, '');
  return d.slice(0, 10);
}

/** Kaydedilecek biçim: boşsa '' (telefon isteğe bağlı), değilse "0" + 10 hane */
export const toStoredPhone = (value) => {
  const d = phoneDigits(value);
  return d ? `0${d}` : '';
};

/** Form kuralı: boş olabilir; yazıldıysa tam 10 hane */
export const phoneRule = (t) => ({
  validator: (_, value) => {
    const d = phoneDigits(value);
    return !d || d.length === 10 ? Promise.resolve() : Promise.reject(new Error(t('validation:phone')));
  },
});

/** Ekranda gösterim: 0532 123 45 67 */
export function formatPhone(value) {
  const d = phoneDigits(value);
  if (d.length !== 10) return value || '';
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}
