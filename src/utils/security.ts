export const hashPassword = async (password: string): Promise<string> => {
  if (typeof password !== 'string') {
    throw new Error('Некорректный пароль');
  }

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  return btoa(unescape(encodeURIComponent(password)));
};
