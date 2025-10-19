import type { TelegramWebAppUser } from '../types/telegram';

type EnvValue = string | boolean | undefined;

const parseBoolean = (value: EnvValue): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const normalizeTelegramUser = (raw: unknown): TelegramWebAppUser | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const id = Number(candidate.id);

  if (!Number.isFinite(id)) {
    return null;
  }

  const result: TelegramWebAppUser = {
    id,
    first_name: typeof candidate.first_name === 'string' ? candidate.first_name : undefined,
    last_name: typeof candidate.last_name === 'string' ? candidate.last_name : undefined,
    username: typeof candidate.username === 'string' ? candidate.username : undefined,
    photo_url: typeof candidate.photo_url === 'string' ? candidate.photo_url : undefined
  };

  return result.username ? result : null;
};

const parseTelegramUser = (value: string | null | undefined): TelegramWebAppUser | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return normalizeTelegramUser(parsed);
  } catch (error) {
    console.debug('[env] Failed to parse telegram user from JSON', error);
    return null;
  }
};

const candidatesFromEncoded = (value: string): string[] => {
  const candidates = new Set<string>();
  candidates.add(value);

  try {
    candidates.add(decodeURIComponent(value));
  } catch (error) {
    console.debug('[env] Failed to decodeURIComponent tg_user value', error);
  }

  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    try {
      candidates.add(window.atob(value));
    } catch (error) {
      console.debug('[env] Failed to decode base64 tg_user value', error);
    }
  }

  return [...candidates];
};

const parseTelegramUserFromEncoded = (value: string | null): TelegramWebAppUser | null => {
  if (!value) {
    return null;
  }

  for (const candidate of candidatesFromEncoded(value)) {
    const parsed = parseTelegramUser(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
};

const fallbackTelegramUser = parseTelegramUser(import.meta.env.VITE_DEFAULT_TELEGRAM_USER);

export const environment = {
  telegramBotToken: import.meta.env.VITE_TELEGRAM_BOT_TOKEN ?? '',
  databaseUrl: import.meta.env.VITE_DATABASE_URL ?? '',
  allowManualOnboarding: parseBoolean(import.meta.env.VITE_ALLOW_MANUAL_ONBOARDING),
  fallbackTelegramUser
};

const resolveFromLocation = (): TelegramWebAppUser | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const fromParam = parseTelegramUserFromEncoded(params.get('tg_user'));
  if (fromParam) {
    return fromParam;
  }

  const legacyParam = parseTelegramUserFromEncoded(params.get('user'));
  if (legacyParam) {
    return legacyParam;
  }

  if (window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const fromHash = parseTelegramUserFromEncoded(hashParams.get('tg_user'));
    if (fromHash) {
      return fromHash;
    }
  }

  return null;
};

export const resolveManualTelegramUser = (): TelegramWebAppUser | null => {
  const fromLocation = resolveFromLocation();
  if (fromLocation) {
    return fromLocation;
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('boost:mock-telegram-user');
      const parsed = parseTelegramUser(stored ?? undefined);
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      console.debug('[env] Unable to read mock telegram user from storage', error);
    }
  }

  return fallbackTelegramUser ?? null;
};

const maskSecret = (value: string) => {
  if (!value) {
    return 'не задан';
  }

  if (value.length <= 8) {
    return '*'.repeat(Math.max(4, value.length));
  }

  return `${value.slice(0, 4)}…${value.slice(-4)}`;
};

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.debug('[env] Telegram bot token подключен:', maskSecret(environment.telegramBotToken));
  console.debug('[env] Railway PostgreSQL URL подключен:', environment.databaseUrl ? 'установлен' : 'отсутствует');
}
