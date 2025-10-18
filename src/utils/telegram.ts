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

export const openTelegramLink = (url: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  const webApp = window.Telegram?.WebApp;
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
    return;
  }

  window.open(url, '_blank');
};
