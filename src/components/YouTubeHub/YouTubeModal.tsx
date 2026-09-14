import React, { useState } from 'react';
import { getRandomIntroCaption, isLegacyIntroCaption } from '../../data/introCaptions';
import { YouTubeChannelProfile, BackgroundThemeId } from '../../types';
import { X, Save, Key, CheckCircle2, AlertCircle, Loader, ExternalLink, Wifi, WifiOff, Globe } from 'lucide-react';
import { YouTubeIcon } from '../YouTubeIcon';
import { BACKGROUND_THEMES, SOLID_BALL_COLORS } from '../../data/defaultChannels';

interface YouTubeModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: YouTubeChannelProfile | null;
  onSave: (channel: YouTubeChannelProfile) => void;
}

type VerifyState = 'idle' | 'checking' | 'success' | 'error';
type WebhookState = 'idle' | 'testing' | 'ok' | 'fail';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const GOOGLE_REDIRECT_URI = `${window.location.origin}/oauth/callback`;

export const YouTubeModal: React.FC<YouTubeModalProps> = ({
  isOpen,
  onClose,
  channel,
  onSave,
}) => {
  const [name, setName] = useState(channel?.name || '');
  const [handle, setHandle] = useState(channel?.channelHandle || '');
  const [channelId, setChannelId] = useState(channel?.youtubeChannelId || '');
  const [apiKey, setApiKey] = useState(channel?.apiKey || '');
  const [authProvider, setAuthProvider] = useState<'google' | 'manual'>(channel?.authProvider || 'manual');
  const [avatarUrl, setAvatarUrl] = useState(channel?.avatarUrl || '');
  const [subscriberCount, setSubscriberCount] = useState(channel?.subscriberCount || '');
  const [bgTheme, setBgTheme] = useState<BackgroundThemeId>(channel?.backgroundTheme || 'slate_zen');
  const [ballColor, setBallColor] = useState(channel?.ballColor || '#ffffff');
  const [ballSize, setBallSize] = useState(channel?.ballSize || 38);
  const [introCaption, setIntroCaption] = useState(
    channel?.introCaption && !isLegacyIntroCaption(channel.introCaption)
      ? channel.introCaption
      : getRandomIntroCaption()
  );
  const [postsPerDay, setPostsPerDay] = useState(channel?.postsPerDay || 2);
  const [postingHoursStr, setPostingHoursStr] = useState(
    channel?.postingHours.join(', ') || '08:00, 18:00'
  );
  const [webhookUrl, setWebhookUrl] = useState(channel?.autoUploadWebhook || '');

  const [verifyState, setVerifyState] = useState<VerifyState>(channel?.isConnected ? 'success' : 'idle');
  const [verifyError, setVerifyError] = useState('');
  const [webhookState, setWebhookState] = useState<WebhookState>('idle');
  const [webhookMsg, setWebhookMsg] = useState('');
  const [googleAuthStatus, setGoogleAuthStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');

  React.useEffect(() => {
    if (!isOpen) return;
    setName(channel?.name || '');
    setHandle(channel?.channelHandle || '');
    setHandleInput(channel?.channelHandle || '');
    setChannelId(channel?.youtubeChannelId || '');
    setApiKey(channel?.apiKey || '');
    setAuthProvider(channel?.authProvider || 'manual');
    setAvatarUrl(channel?.avatarUrl || '');
    setSubscriberCount(channel?.subscriberCount || '');
    setBgTheme(channel?.backgroundTheme || 'slate_zen');
    setBallColor(channel?.ballColor || '#ffffff');
    setBallSize(channel?.ballSize || 38);
    setIntroCaption(
      channel?.introCaption && !isLegacyIntroCaption(channel.introCaption)
        ? channel.introCaption
        : getRandomIntroCaption()
    );
    setPostsPerDay(channel?.postsPerDay || 2);
    setPostingHoursStr(channel?.postingHours.join(', ') || '08:00, 18:00');
    setWebhookUrl(channel?.autoUploadWebhook || '');
    setVerifyState(channel?.isConnected ? 'success' : 'idle');
    setVerifyError('');
    setGoogleAuthStatus(channel?.isConnected ? 'connected' : 'idle');
  }, [channel, isOpen]);

  const [handleInput, setHandleInput] = useState(channel?.channelHandle || '');

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || state !== 'google-youtube-auth') return;

    (async () => {
      try {
        const verifier = localStorage.getItem('google_youtube_pkce');
        if (!verifier) {
          throw new Error('missing PKCE verifier in browser storage');
        }

        const resp = await fetch(`${API_BASE_URL}/api/google/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            codeVerifier: verifier,
            redirectUri: GOOGLE_REDIRECT_URI,
          }),
        });

        const data = await resp.json();
        if (!resp.ok || !data.success) {
          throw new Error(data.error || 'google token exchange failed');
        }

        const accessToken = data.tokens?.access_token;
        if (!accessToken) {
          throw new Error('missing access token from google');
        }

        const channelResp = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        });

        const channelData = await channelResp.json();
        if (!channelResp.ok || !channelData.items?.[0]) {
          throw new Error(channelData.error?.message || 'youtube account lookup failed');
        }

        const item = channelData.items[0];
        const title = item.snippet?.title || 'Google connected channel';
        const customUrl = item.snippet?.customUrl || '';

        setName(title);
        setHandle(customUrl ? `@${customUrl.replace(/^@/, '')}` : '@channel');
        setChannelId(item.id || '');
        setAvatarUrl(item.snippet?.thumbnails?.default?.url || '');
        setSubscriberCount(item.statistics?.subscriberCount ? `${Number(item.statistics.subscriberCount).toLocaleString()} subscribers` : 'verified');
        setVerifyState('success');
        setGoogleAuthStatus('connected');
        setVerifyError('');
        setAuthProvider('google');
        window.history.replaceState({}, '', '/');
      } catch (err) {
        setVerifyState('error');
        setVerifyError(String(err instanceof Error ? err.message : err));
        setGoogleAuthStatus('idle');
      }
    })();
  }, []);

  if (!isOpen) return null;

  const handleVerify = async () => {
    const query = handleInput.trim() || channelId.trim();
    if (!query) {
      setVerifyError('enter a @handle or channel ID to verify.');
      setVerifyState('error');
      return;
    }

    setVerifyState('checking');
    setVerifyError('');

    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/youtube/verify?query=${encodeURIComponent(query)}&apiKey=${encodeURIComponent(apiKey)}`
      );
      const data = await resp.json();

      if (data.success) {
        setName(data.title || name);
        setHandle(data.handle || query);
        setChannelId(data.channelId || channelId);
        setAvatarUrl(data.avatarUrl || '');
        setSubscriberCount(data.subscriberCount || 'verified');
        setVerifyState('success');
      } else {
        setVerifyError(data.error || 'channel not found. check the handle or channel ID.');
        setVerifyState('error');
      }
    } catch {
      setVerifyError('could not connect to verification service. check if dev server is running.');
      setVerifyState('error');
    }
  };

  const handleGoogleConnect = async () => {
    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      setVerifyError('missing VITE_GOOGLE_CLIENT_ID. add it to .env.local before using Google OAuth.');
      setVerifyState('error');
      return;
    }

    setGoogleAuthStatus('connecting');
    setAuthProvider('google');
    setVerifyError('');

    try {
      const verifier = crypto.getRandomValues(new Uint8Array(32)).reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '');
      const challenge = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then((buf) => {
        let binary = '';
        Array.from(new Uint8Array(buf)).forEach((byte) => { binary += String.fromCharCode(byte); });
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      });

      localStorage.setItem('google_youtube_pkce', verifier);
      localStorage.setItem('google_youtube_challenge', challenge);

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', import.meta.env.VITE_GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('state', 'google-youtube-auth');

      window.location.href = authUrl.toString();
    } catch (err) {
      setGoogleAuthStatus('idle');
      setVerifyError(String(err instanceof Error ? err.message : err));
      setVerifyState('error');
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.startsWith('http')) {
      setWebhookMsg('enter a valid http/https URL to test.');
      setWebhookState('fail');
      return;
    }

    setWebhookState('testing');
    setWebhookMsg('');

    try {
      const resp = await fetch(`${API_BASE_URL}/api/webhook/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl, channelName: name }),
      });
      const data = await resp.json();
      setWebhookMsg(data.message || (data.success ? 'webhook live!' : 'webhook failed'));
      setWebhookState(data.success ? 'ok' : 'fail');
    } catch {
      setWebhookMsg('connection failed. check URL and CORS settings.');
      setWebhookState('fail');
    }

    setTimeout(() => {
      setWebhookState('idle');
      setWebhookMsg('');
    }, 5000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hours = postingHoursStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d{2}:\d{2}$/.test(s));

    const updated: YouTubeChannelProfile = {
      id: channel?.id || `yt_${Date.now()}`,
      name: name.toLowerCase() || handleInput.toLowerCase(),
      channelHandle: handle || handleInput,
      youtubeChannelId: channelId,
      apiKey,
      authProvider,
      avatarUrl,
      backgroundTheme: bgTheme,
      ballColor,
      ballSize,
      introCaption: introCaption.toLowerCase(),
      postsPerDay,
      postingHours: hours.length > 0 ? hours : ['08:00', '18:00'],
      musicTrackId: channel?.musicTrackId || 'calm_piano',
      voiceVolume: 0.95,
      musicVolume: 0.9,
      autoUploadWebhook: webhookUrl,
      isConnected: verifyState === 'success',
      subscriberCount: subscriberCount || undefined,
      isVerified: verifyState === 'success',
      createdAt: channel?.createdAt || new Date().toISOString(),
    };

    onSave(updated);
    onClose();
  };

  const POSTING_PRESETS: Record<number, string> = {
    1: '09:00',
    2: '08:00, 18:00',
    3: '08:00, 13:00, 19:00',
    4: '08:00, 12:00, 16:00, 20:00',
    6: '06:00, 09:00, 12:00, 15:00, 18:00, 21:00',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0e1017] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative my-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
            <YouTubeIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              {channel ? 'edit youtube channel' : 'connect youtube channel'}
            </h2>
            <p className="text-xs text-slate-400">
              verify your real channel and configure auto-upload schedule
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">

          {/* ── STEP 1: Channel Verification ── */}
          <div className="space-y-2 p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                step 1 · connect YouTube
              </p>

              <button
                type="button"
                onClick={handleGoogleConnect}
                className="px-2.5 py-1.5 rounded-lg border border-sky-500/50 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 text-[10px] font-semibold transition-colors cursor-pointer"
              >
                {googleAuthStatus === 'connecting'
                  ? 'connecting...'
                  : googleAuthStatus === 'connected'
                  ? 'connected'
                  : 'connect Google & YouTube'}
              </button>
            </div>

            <p className="text-[11px] leading-5 text-slate-500">
              Sign in once and grant upload permission. The automation worker stores the connection securely for scheduled publishing.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="@yourchannelhandle or UC… channel ID"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-white/25"
              />
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifyState === 'checking'}
                className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 shrink-0"
              >
                {verifyState === 'checking' ? (
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {verifyState === 'checking' ? 'checking...' : 'verify'}
              </button>
            </div>

            {verifyState === 'success' && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="w-9 h-9 rounded-full object-cover border border-white/10" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white">{name}</p>
                  <p className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    channel verified · {handle}
                    {subscriberCount && ` · ${subscriberCount}`}
                  </p>
                </div>
              </div>
            )}

            {verifyState === 'error' && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/20 text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{verifyError}</span>
              </div>
            )}
          </div>

          {/* ── STEP 2: Optional API Key ── */}
          <div className="space-y-1.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
            <p className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-400" />
              step 2 · youtube data api key (optional)
            </p>
            <p className="text-slate-500">
              if provided, enables real subscriber count + metadata sync via the YouTube Data API v3.{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline inline-flex items-center gap-0.5"
              >
                get a key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy… (optional)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 font-mono text-white placeholder:text-slate-600 focus:outline-none"
            />
          </div>

          {/* ── STEP 3: Channel Name + Intro Caption ── */}
          <div className="space-y-2 p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
            <p className="text-slate-300 font-semibold">step 3 · channel identity</p>
            <div className="space-y-1">
              <label className="text-slate-400">display name (lowercase)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. zenvision eye therapy"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400">intro caption (spoken at start of every video)</label>
              <input
                type="text"
                value={introCaption}
                onChange={(e) => setIntroCaption(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
              />
            </div>
          </div>

          {/* ── STEP 4: Video Style ── */}
          <div className="space-y-2 p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
            <p className="text-slate-300 font-semibold">step 4 · video style</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-400">background theme</label>
                <select
                  value={bgTheme}
                  onChange={(e) => setBgTheme(e.target.value as BackgroundThemeId)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none cursor-pointer"
                >
                  {Object.values(BACKGROUND_THEMES).map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#0e1017]">
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">ball color (solid, no glow)</label>
                <select
                  value={ballColor}
                  onChange={(e) => setBallColor(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none cursor-pointer"
                >
                  {SOLID_BALL_COLORS.map((c) => (
                    <option key={c.id} value={c.color} className="bg-[#0e1017]">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── STEP 5: Posting Schedule ── */}
          <div className="space-y-2 p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
            <p className="text-slate-300 font-semibold">step 5 · auto-upload schedule</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-400">posts per day</label>
                <select
                  value={postsPerDay}
                  onChange={(e) => {
                    const count = parseInt(e.target.value);
                    setPostsPerDay(count);
                    setPostingHoursStr(POSTING_PRESETS[count] || '08:00, 18:00');
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none cursor-pointer"
                >
                  <option value={1} className="bg-[#0e1017]">1 video / day</option>
                  <option value={2} className="bg-[#0e1017]">2 videos / day</option>
                  <option value={3} className="bg-[#0e1017]">3 videos / day</option>
                  <option value={4} className="bg-[#0e1017]">4 videos / day</option>
                  <option value={6} className="bg-[#0e1017]">6 videos / day</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">upload times (hh:mm, comma sep.)</label>
                <input
                  type="text"
                  value={postingHoursStr}
                  onChange={(e) => setPostingHoursStr(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* ── STEP 6: Webhook ── */}
          <div className="space-y-2 p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
            <p className="text-slate-300 font-semibold">step 6 · auto-upload webhook (optional)</p>
            <p className="text-slate-500">
              point to your upload automation endpoint (zapier, make.com, custom API). receives a JSON payload when a video slot fires.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.zapier.com/hooks/catch/…"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={webhookState === 'testing'}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  webhookState === 'ok'
                    ? 'bg-emerald-500 text-white'
                    : webhookState === 'fail'
                    ? 'bg-rose-500 text-white'
                    : 'bg-white/10 text-slate-300 hover:bg-white/15'
                }`}
              >
                {webhookState === 'testing' ? (
                  <Loader className="w-3 h-3 animate-spin" />
                ) : webhookState === 'ok' ? (
                  <Wifi className="w-3 h-3" />
                ) : webhookState === 'fail' ? (
                  <WifiOff className="w-3 h-3" />
                ) : (
                  <Wifi className="w-3 h-3" />
                )}
                {webhookState === 'testing' ? 'testing...' : 'test ping'}
              </button>
            </div>

            {webhookMsg && (
              <p className={`text-xs ${webhookState === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {webhookMsg}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer text-xs"
            >
              cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>save channel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
