export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface TelegramWebAppInitDataUnsafe {
  user?: TelegramWebAppUser;
  start_param?: string;
}

export interface TelegramWebApp {
  initDataUnsafe?: TelegramWebAppInitDataUnsafe;
  ready?: () => void;
  expand?: () => void;
  colorScheme?: 'light' | 'dark';
  openTelegramLink?: (url: string) => void;
}

export interface TelegramWindow {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}
