export const INITIAL_BALANCE = 100;

export const ORDER_PRICING = {
  channel: 1.8,
  group: 1.3
} as const;

export const TASK_REWARD = {
  channel: 1.2,
  group: 0.8
} as const;

export const TOPUP_TIERS = [
  {
    min: 1000,
    max: 2000,
    rate: 68.3
  },
  {
    min: 2000,
    max: 4000,
    rate: 59.2
  },
  {
    min: 4000,
    max: 8000,
    rate: 44.6
  },
  {
    min: 8000,
    max: Infinity,
    rate: 38.4
  }
];

export const REFERRAL_PERCENTAGE = 0.1;

export type OrderType = 'channel' | 'group';
