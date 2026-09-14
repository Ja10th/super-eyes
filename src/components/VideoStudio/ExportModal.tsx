import React, { useState, useEffect } from "react";
import { VideoSessionConfig, VideoResolution } from "../../types";
import { videoRecorder } from "../../services/videoRecorder";
import { audioEngine } from "../../services/audioService";
import confetti from "canvas-confetti";
import {
  X,
  Download,
  Film,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  Sparkles,
} from "lucide-react";
interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionConfig: VideoSessionConfig;
  totalDurationSeconds: number;
  onResolutionChange: (res: VideoResolution) => void;
}
export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  sessionConfig,
  totalDurationSeconds,
  onResolutionChange,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [progressSecs, setProgressSecs] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const is4K = sessionConfig.resolution === "4k";
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (isRecording) {
      timer = setInterval(() => {
        setProgressSecs((prev) => {
          if (prev >= totalDurationSeconds) {
            handleStopRecording();
            return totalDurationSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, totalDurationSeconds]);

  if (!isOpen) return null;
  const handleStartRecording = () => {
    setErrorMsg(null);
    setRecordedBlob(null);
    setProgressSecs(0);
    const canvas =
      document.querySelector('[data-video-canvas="studio"]') as HTMLCanvasElement | null ||
      document.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) {
      setErrorMsg("could not locate video canvas element.");
      return;
    }
    try {
      const canvasStream = canvas.captureStream(60);
      const audioDestination = audioEngine.getAudioStreamDestination();
      const audioStream = audioDestination.stream;
      const started = videoRecorder.startRecording(
        canvasStream,
        audioStream,
        is4K,
        60,
      );
      if (!started) {
        setErrorMsg(
          "browser media recorder failed to initialize. webm/mp4 required.",
        );
        return;
      }
      setIsRecording(true);
    } catch (err) {
      setErrorMsg(`recording error: ${String(err)}`);
    }
  };
  const handleStopRecording = async () => {
    setIsRecording(false);
    try {
      const blob = await videoRecorder.stopRecording();
      setRecordedBlob(blob);
      automationService.setLatestStudioRenderBlob(blob);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err) {
      setErrorMsg(`error stopping recording: ${String(err)}`);
    }
  };
  const handleDownload = () => {
    if (!recordedBlob) return;
    const safeTitle = (sessionConfig.title || "eye_training_routine")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase();
    const ext = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
    videoRecorder.downloadBlob(
      recordedBlob,
      `${safeTitle}_${sessionConfig.resolution}.${ext}`,
    );
  };
  const minutes = Math.floor(totalDurationSeconds / 60);
  const seconds = Math.floor(totalDurationSeconds % 60);
  const percent = Math.min(
    100,
    Math.round((progressSecs / totalDurationSeconds) * 100),
  );
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0e1017] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-white tracking-tight">
            export video
          </h2>
          <p className="text-xs text-slate-400">
            broadcast quality • brand voice & calm ambient audio synchronized
          </p>
        </div>
        {/* Resolution Selector: 4K vs 1080p */}
        <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => onResolutionChange("4k")}
            disabled={isRecording}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              is4K
                ? "bg-sky-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>4k ultra hd (3840×2160)</span>
          </button>
          <button
            onClick={() => onResolutionChange("1080p")}
            disabled={isRecording}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              !is4K
                ? "bg-sky-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>1080p full hd (1920×1080)</span>
          </button>
        </div>
        {/* Technical Specs Summary */}
        <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 space-y-2 text-xs text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-500">resolution</span>
            <span className="font-mono text-white">
              {is4K ? "3840 × 2160 (4k 60fps)" : "1920 × 1080 (1080p 60fps)"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">video bitrate</span>
            <span className="font-mono text-sky-400">
              {is4K ? "40 mbps" : "12 mbps"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">total length</span>
            <span className="font-mono text-white">
              {minutes}m {seconds}s ({sessionConfig.items.length} exercises)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">audio</span>
            <span className="text-slate-300">
              stereo 48khz (voice + calm pad)
            </span>
          </div>
        </div>
        {/* Recording in progress */}
        {isRecording && (
          <div className="space-y-2 bg-sky-950/30 p-3.5 rounded-xl border border-sky-500/20">
            <div className="flex justify-between text-xs">
              <span className="text-sky-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                recording {is4K ? "4k" : "1080p"} stream...
              </span>
              <span className="font-mono font-semibold text-white">
                {percent}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-400 rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
        {/* Completed State */}
        {recordedBlob && (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="font-semibold text-white">
                video rendering complete
              </p>
              <p className="text-[11px] text-emerald-300/80">
                {(recordedBlob.size / (1024 * 1024)).toFixed(1)} mb ready to
                save.
              </p>
            </div>
          </div>
        )}
        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {!isRecording && !recordedBlob && (
            <button
              onClick={handleStartRecording}
              className="flex-1 h-11 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>start {is4K ? "4k" : "1080p"} recording</span>
            </button>
          )}
          {isRecording && (
            <button
              onClick={handleStopRecording}
              className="flex-1 h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>finish recording</span>
            </button>
          )}
          {recordedBlob && (
            <button
              onClick={handleDownload}
              className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>download {is4K ? "4k" : "1080p"} video</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 h-11 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/5 transition-colors cursor-pointer"
          >
            close
          </button>
        </div>
      </div>
    </div>
  );
};
