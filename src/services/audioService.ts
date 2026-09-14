// Web Audio Engine with Voice Ducking, Background Music Looping, and Chimes
class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private voiceSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private streamDestination: MediaStreamAudioDestinationNode | null = null;
  private musicBufferMap: Map<string, AudioBuffer> = new Map();
  private voiceBufferMap: Map<string, AudioBuffer> = new Map();
  private isMuted: boolean = false;
  private musicBaseVolume: number = 0.9;
  private voiceBaseVolume: number = 0.95;
  private introSequenceActive: boolean = false;
  private initContext() {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.voiceGain = this.ctx.createGain();
      this.streamDestination = this.ctx.createMediaStreamDestination();
      this.musicGain.gain.value = this.musicBaseVolume;
      this.voiceGain.gain.value = this.voiceBaseVolume;
      // Connect channels to master and to recording stream
      this.musicGain.connect(this.masterGain);
      this.voiceGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.connect(this.streamDestination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  public getAudioStreamDestination(): MediaStreamAudioDestinationNode {
    this.initContext();
    return this.streamDestination!;
  }

  public setVolumes(musicVol: number, voiceVol: number) {
    this.musicBaseVolume = musicVol;
    this.voiceBaseVolume = voiceVol;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicBaseVolume, this.ctx.currentTime);
    }
    if (this.voiceGain && this.ctx) {
      this.voiceGain.gain.setValueAtTime(this.voiceBaseVolume, this.ctx.currentTime);
    }
  }
  public async preloadAudio(url: string, isVoice: boolean): Promise<AudioBuffer | null> {
    try {
      this.initContext();
      const map = isVoice ? this.voiceBufferMap : this.musicBufferMap;
      if (map.has(url)) return map.get(url)!;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
      map.set(url, audioBuffer);
      return audioBuffer;
    } catch (err) {
      console.warn(`Could not preload audio ${url}:`, err);
      return null;
    }
  }
  public async playMusic(url: string) {
    this.initContext();
    if (!this.ctx) return;
    this.stopMusic();
    let buffer = this.musicBufferMap.get(url);
    if (!buffer) {
      buffer = (await this.preloadAudio(url, false)) || undefined;
    }
    if (!buffer || !this.ctx) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicGain!);
    source.start(0);
    this.musicSource = source;
  }

  public stopMusic() {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
        this.musicSource.disconnect();
      } catch {
        // ignore already stopped
      }
      this.musicSource = null;
    }
  }
  private getFallbackVoiceText(url: string, fallbackText?: string) {
    const fromText = (fallbackText || '').trim();
    if (fromText) return fromText;

    const fileName = url.split('/').pop() || 'exercise';
    const withoutExt = fileName.replace(/\.mp3$/i, '').replace(/[-_]+/g, ' ');
    return withoutExt || 'daily eye training exercise';
  }

  public isIntroSequencePlaying(): boolean {
    return this.introSequenceActive;
  }

  public async playVoice(url: string, onEnded?: () => void, fallbackText?: string) {
    this.initContext();
    if (!this.ctx) return;
    this.stopVoice();

    let buffer = this.voiceBufferMap.get(url);
    if (!buffer) {
      buffer = (await this.preloadAudio(url, true)) || undefined;
    }

    if (!buffer) {
      const fallbackVoiceText = this.getFallbackVoiceText(url, fallbackText);
      const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const ttsUrl = `${apiBaseUrl}/api/tts?text=${encodeURIComponent(fallbackVoiceText)}`;
      const ttsBuffer = this.voiceBufferMap.get(ttsUrl) || (await this.preloadAudio(ttsUrl, true));

      if (ttsBuffer) {
        this.playVoice(ttsUrl, onEnded);
        return;
      }

      const fallbackVoiceUrl = '/audio/voice/intro_hi.mp3';
      const fallbackBuffer = this.voiceBufferMap.get(fallbackVoiceUrl) || (await this.preloadAudio(fallbackVoiceUrl, true));
      if (fallbackBuffer) {
        this.playVoice(fallbackVoiceUrl, onEnded);
        return;
      }

      if (onEnded) onEnded();
      return;
    }

    // Duck music volume gently
    this.duckMusic(true);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.voiceGain!);
    source.onended = () => {
      this.duckMusic(false);
      if (onEnded) onEnded();
    };
    source.start(0);
    this.voiceSource = source;
  }
  public async playIntro(customCaption?: string, onEnded?: () => void) {
    const rawText = (customCaption || '').trim();
    const hiText = 'hi';

    const cleanIntroCaption = (text: string) => {
      if (!text) return '';

      const normalized = text
        .replace(/^\s*hi\b\s*[:.\-]?\s*/i, '')
        .replace(/^\s*hello\b\s*[:.\-]?\s*/i, '')
        .replace(/^\s*welcome\b\s*to\s*your\s*daily\s*eye\s*training\s*session\b\s*[:.\-]?\s*/i, '')
        .replace(/^\s*welcome\b\s*to\s*your\s*eye\s*training\s*session\b\s*[:.\-]?\s*/i, '')
        .replace(/^\s*get\s*comfortable\b.*$/i, '')
        .replace(/^\s*relax\s*your\s*shoulders\b.*$/i, '')
        .replace(/^\s*keep\s*your\s*head\s*still\b.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      return normalized;
    };

    const playIntroCaption = async () => {
      const cleaned = cleanIntroCaption(rawText);
      if (!cleaned) {
        this.introSequenceActive = false;
        if (onEnded) onEnded();
        return;
      }

      try {
        const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
        const ttsUrl = `${apiBaseUrl}/api/tts?text=${encodeURIComponent(cleaned)}`;
        const buffer = await this.preloadAudio(ttsUrl, true);
        if (buffer) {
          this.playVoice(ttsUrl, () => {
            this.introSequenceActive = false;
            if (onEnded) onEnded();
          });
          return;
        }
      } catch {
        // fall through silently
      }

      this.introSequenceActive = false;
      if (onEnded) onEnded();
    };

    this.introSequenceActive = true;
    this.playVoice('/audio/voice/intro_hi.mp3', async () => {
      await playIntroCaption();
    }, hiText);
  }
  public playMovementCue() {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }
  public stopVoice() {
    if (this.voiceSource) {
      try {
        this.voiceSource.stop();
        this.voiceSource.disconnect();
      } catch {
        // ignore
      }
      this.voiceSource = null;
      this.duckMusic(false);
    }
  }
  private duckMusic(duck: boolean) {
    if (!this.musicGain || !this.ctx) return;
    const targetVol = duck ? this.musicBaseVolume * 0.25 : this.musicBaseVolume;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.linearRampToValueAtTime(targetVol, now + 0.35);
  }
  public playChime() {
    this.initContext();
    if (!this.ctx) return;
        const now = this.ctx.currentTime;
    // Pleasant Tibetan Singing Bowl harmonic chime (528Hz + 1056Hz)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(528, now); // Love frequency chime
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1056, now);
    chimeGain.gain.setValueAtTime(0.001, now);
    chimeGain.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
    osc1.connect(chimeGain);
    osc2.connect(chimeGain);
    chimeGain.connect(this.masterGain!);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.8);
    osc2.stop(now + 1.8);
  }
  public stopAll() {
    this.stopVoice();
    this.stopMusic();
  }
}
export const audioEngine = new AudioEngine();
