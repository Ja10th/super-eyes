export interface GoogleTokenExchangeResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

export interface YouTubeChannelProfileFromGoogle {
  title: string;
  handle: string;
  channelId: string;
  avatarUrl?: string;
  subscriberCount?: string;
}

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const GOOGLE_REDIRECT_URI = `${window.location.origin}/oauth/callback`;

function base64UrlEncode(value: Uint8Array): string {
  let binary = '';
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function generateGooglePkceVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function generateGooglePkceChallenge(verifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return base64UrlEncode(new Uint8Array(digest));
}

export function buildGoogleAuthUrl(codeChallenge: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', 'google-youtube-auth');
  return url.toString();
}

export async function exchangeGoogleCode(code: string, codeVerifier: string): Promise<GoogleTokenExchangeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/google/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      codeVerifier,
      redirectUri: GOOGLE_REDIRECT_URI,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Google OAuth exchange failed');
  }

  return data.tokens;
}

export async function fetchYouTubeChannelProfile(accessToken: string): Promise<YouTubeChannelProfileFromGoogle> {
  const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'YouTube channel lookup failed');
  }

  const item = data.items?.[0];
  if (!item) {
    throw new Error('No YouTube channel was returned for this Google account');
  }

  const customUrl = item.snippet?.customUrl || '';
  return {
    title: item.snippet?.title || 'Connected YouTube channel',
    handle: customUrl ? `@${customUrl.replace(/^@/, '')}` : '@channel',
    channelId: item.id || '',
    avatarUrl: item.snippet?.thumbnails?.default?.url || '',
    subscriberCount: item.statistics?.subscriberCount
      ? `${Number(item.statistics.subscriberCount).toLocaleString()} subscribers`
      : undefined,
  };
}
