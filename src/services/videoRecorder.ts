// 4K UHD and 1080p Canvas + Web Audio MediaRecorder Pipeline
export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording: boolean = false;
  public static getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
    ];
    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  }
  public startRecording(
    canvasStream: MediaStream,
    audioStream: MediaStream,
    is4K: boolean = false,
    fps: number = 60
  ): boolean {
    try {
      this.recordedChunks = [];
      const combinedStream = new MediaStream();
      const videoTrack = canvasStream.getVideoTracks()[0];
      if (videoTrack) combinedStream.addTrack(videoTrack);
      const audioTrack = audioStream.getAudioTracks()[0];
      if (audioTrack) combinedStream.addTrack(audioTrack);
      const mimeType = VideoRecorder.getSupportedMimeType();
      // 40 Mbps for 4K UHD, 12 Mbps for 1080p Full HD
      const videoBitsPerSecond = is4K ? 40_000_000 : 12_000_000;
      const options: MediaRecorderOptions = {
        videoBitsPerSecond,
      };
      if (mimeType) {
        options.mimeType = mimeType;
      }

      this.mediaRecorder = new MediaRecorder(combinedStream, options);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };
      this.mediaRecorder.start(1000);
      this.isRecording = true;
      return true;
    } catch (err) {
      console.error('failed to start media recorder:', err);
      return false;
    }
  }
  public stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('recorder is not active'));
        return;
      }
      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
        const finalBlob = new Blob(this.recordedChunks, { type: mimeType });
        this.isRecording = false;
        this.recordedChunks = [];
        resolve(finalBlob);
      };
      this.mediaRecorder.stop();
    });
  }
  public downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  }
  public getIsRecording(): boolean {
    return this.isRecording;
  }
}
export const videoRecorder = new VideoRecorder();