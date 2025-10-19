export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface TelegramWebApp {
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  ready?: () => void;
  expand?: () => void;
  colorScheme?: 'light' | 'dark';
  openTelegramLink?: (url: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export const getTelegramUser = (): TelegramWebAppUser | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const webApp = window.Telegram?.WebApp;

  if (webApp?.ready) {
    webApp.ready();
  }

  if (webApp?.expand) {
    webApp.expand();
  }

  const user = webApp?.initDataUnsafe?.user;
  return user ?? null;
};

export const launchedFromStartCommand = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  return typeof startParam !== 'undefined';
};

export const openTelegramLink = (url: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  const webApp = window.Telegram?.WebApp;
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
