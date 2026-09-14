import React, { useEffect, useState } from 'react';

interface GoogleOAuthBridgeProps {
  onConnected: (payload: {
    channelName: string;
    handle: string;
    youtubeChannelId: string;
    avatarUrl?: string;
    subscriberCount?: string;
  }) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

export const GoogleOAuthBridge: React.FC<GoogleOAuthBridgeProps> = ({
  onConnected,
  onError,
  onCancel,
}) => {
  const [status, setStatus] = useState('preparing google sign-in...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthCode = params.get('code');
    const error = params.get('error');

    if (error) {
      onError(`google auth was denied or canceled: ${error}`);
      onCancel();
      return;
    }

    if (!oauthCode) {
      setStatus('waiting for google account selection...');
      const verifier = window.localStorage.getItem('google_youtube_pkce');
      const challenge = window.localStorage.getItem('google_youtube_challenge');
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

      if (!clientId || !challenge || !verifier) {
        onError('google client id or OAuth challenge is missing. check your env values.');
        onCancel();
        return;
      }

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', 'http://localhost:5173/oauth/callback');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile https://www.googleapis.com/auth/youtube.readonly');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('state', 'google-youtube-auth');

      window.location.href = authUrl.toString();
      return;
    }

    (async () => {
      try {
        setStatus('exchanging google code...');
        const verifier = localStorage.getItem('google_youtube_pkce');
        if (!verifier) {
          throw new Error('Missing PKCE verifier');
        }

        const response = await fetch('/api/google/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: oauthCode,
            codeVerifier: verifier,
            redirectUri: 'http://localhost:5173/oauth/callback',
          }),
        });

        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Google token exchange failed');
        }

        const accessToken = payload.tokens?.access_token;
        if (!accessToken) {
          throw new Error('No access token returned from Google');
        }

        const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        });

        const channelData = await channelRes.json();
        if (!channelRes.ok || !channelData.items?.[0]) {
          throw new Error(channelData.error?.message || 'No YouTube channel found');
        }

        const item = channelData.items[0];
        const title = item.snippet?.title || 'Connected YouTube channel';
        const customUrl = item.snippet?.customUrl || '';

        onConnected({
          channelName: title,
          handle: customUrl ? `@${customUrl.replace(/^@/, '')}` : '@channel',
          youtubeChannelId: item.id || '',
          avatarUrl: item.snippet?.thumbnails?.default?.url || '',
          subscriberCount: item.statistics?.subscriberCount
            ? `${Number(item.statistics.subscriberCount).toLocaleString()} subscribers`
            : undefined,
        });

        window.history.replaceState({}, '', '/');
      } catch (err) {
        onError(String(err instanceof Error ? err.message : err));
      }
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e1017] p-5 text-center text-sm text-slate-200">
        <p className="text-base font-semibold text-white">connecting google account</p>
        <p className="mt-2 text-xs text-slate-400">{status}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-sky-500" />
        </div>
      </div>
    </div>
  );
};
