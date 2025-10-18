export const formatNumber = (value: number, fractionDigits = 0): string =>
  new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value);

export const formatUZT = (value: number, fractionDigits = 1): string => `${formatNumber(value, fractionDigits)} UZT`;

export const formatCurrency = (value: number, currency: string): string =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
