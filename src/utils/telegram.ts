import type { TelegramWebApp, TelegramWebAppUser, TelegramWindow } from '../types/telegram';
import { resolveManualTelegramUser } from './environment';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Window extends TelegramWindow {}
}

const getWebApp = (): TelegramWebApp | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.Telegram?.WebApp;
};

export const getTelegramUser = (): TelegramWebAppUser | null => {
  if (typeof window === 'undefined') {
    return resolveManualTelegramUser();
  }

  const webApp = getWebApp();

  webApp?.ready?.();
  webApp?.expand?.();

  const user = webApp?.initDataUnsafe?.user;
  return user ?? resolveManualTelegramUser();
};

export const launchedFromStartCommand = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const webApp = getWebApp();
  if (typeof webApp?.initDataUnsafe?.start_param !== 'undefined') {
    return true;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.has('start_param')) {
    return true;
  }

  if (window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (hashParams.has('start_param')) {
      return true;
    }
  }

  return false;
};

export const openTelegramLink = (url: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  const webApp = getWebApp();
  const target = url.trim();

  const { webUrl, deepLink } = (() => {
    if (!target) {
      return { webUrl: 'https://t.me/', deepLink: undefined };
    }

    if (target.startsWith('tg://')) {
      const match = target.match(/domain=([^&]+)/i);
      const username = match?.[1];
      return {
        deepLink: target,
        webUrl: username ? `https://t.me/${username}` : 'https://t.me/'
      };
    }

    if (/^https?:\/\/t\.me\//i.test(target)) {
      const username = target.replace(/^https?:\/\/t\.me\//i, '').split(/[/?]/)[0];
      return {
        webUrl: target,
        deepLink: username ? `tg://resolve?domain=${username}` : target
      };
    }

    if (target.startsWith('@')) {
      const username = target.replace(/^@+/, '');
      return {
        webUrl: `https://t.me/${username}`,
        deepLink: `tg://resolve?domain=${username}`
      };
    }

    if (/^[a-zA-Z0-9_]+$/.test(target)) {
      return {
        webUrl: `https://t.me/${target}`,
        deepLink: `tg://resolve?domain=${target}`
      };
    }

    return { webUrl: target, deepLink: undefined };
  })();

  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(deepLink ?? webUrl);
    return;
  }

  window.open(webUrl, '_blank');
};
