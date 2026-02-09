import React, { useEffect, useCallback, useState, useRef } from 'react';
import { api } from '../api';
import { X, ChevronLeft, ChevronRight, Download, FileIcon, Loader2, AlertCircle } from 'lucide-react';
import { fmtSize } from './FileCard';

/* ── VideoPlayer ────────────────────────────────────────────────────────────
   1. Tries native playback (range-streamed, shows first frame, buffers).
   2. On error → probes codec via /video-info.
   3. If HEVC/unsupported → switches to ?compat=1 (ffmpeg H.264 transcode).
   4. Shows buffering progress and loading states throughout.
──────────────────────────────────────────────────────────────────────────── */
function VideoPlayer({ file }) {
  const videoRef = useRef(null);

  // State machine: 'loading' → 'playing' | 'transcoding' | 'error'
  const [status, setStatus] = useState('loading');
  const [bufferPct, setBufferPct] = useState(0);
  const [useCompat, setUseCompat] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const triedCompat = useRef(false);

  const src = useCompat
    ? api.previewCompatUrl(file.path)
    : api.previewUrl(file.path);

  /* ── Buffer progress tracking ─────────────── */
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const onProgress = () => {
      if (vid.buffered.length > 0 && vid.duration) {
        const end = vid.buffered.end(vid.buffered.length - 1);
        setBufferPct(Math.round((end / vid.duration) * 100));
      }
    };
    const onCanPlay    = () => setStatus('playing');
    const onPlaying    = () => setStatus('playing');
    const onWaiting    = () => { if (status !== 'transcoding') setStatus('loading'); };
    const onLoadedData = () => setStatus('playing');

    vid.addEventListener('progress', onProgress);
    vid.addEventListener('canplay', onCanPlay);
    vid.addEventListener('playing', onPlaying);
    vid.addEventListener('waiting', onWaiting);
    vid.addEventListener('loadeddata', onLoadedData);

    return () => {
      vid.removeEventListener('progress', onProgress);
      vid.removeEventListener('canplay', onCanPlay);
      vid.removeEventListener('playing', onPlaying);
      vid.removeEventListener('waiting', onWaiting);
      vid.removeEventListener('loadeddata', onLoadedData);
    };
  }, [src, status]);

  /* ── Handle playback error → try compat ───── */
  const handleError = async () => {
    if (triedCompat.current) {
      setStatus('error');
      setErrorMsg('Video could not be played. Try downloading it instead.');
      return;
    }
    triedCompat.current = true;

    // Probe codec to give user a clear message
    try {
      const info = await api.getVideoInfo(file.path);
      if (info.needs_transcode && info.ffmpeg_available) {
        setStatus('transcoding');
        setBufferPct(0);
        setUseCompat(true);
        return;
      }
      if (info.needs_transcode && !info.ffmpeg_available) {
        setStatus('error');
        setErrorMsg(`Codec "${info.codec}" not supported by browser. Install ffmpeg to enable transcoding.`);
        return;
      }
    } catch {
      // probe failed, try compat anyway
    }

    setStatus('transcoding');
    setBufferPct(0);
    setUseCompat(true);
  };

  /* ── Reset when file changes ──────────────── */
  useEffect(() => {
    triedCompat.current = false;
    setUseCompat(false);
    setStatus('loading');
    setBufferPct(0);
    setErrorMsg('');
  }, [file.path]);

  return (
    <div className="relative flex items-center justify-center" style={{ minWidth: '60vw', minHeight: '50vh' }}>
      {/* Overlay: loading / transcoding / error */}
      {(status === 'loading' || status === 'transcoding') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/50 rounded-lg pointer-events-none">
          <Loader2 className="w-10 h-10 text-white animate-spin mb-3" />
          <p className="text-white text-sm font-medium">
            {status === 'transcoding' ? 'Converting video for playback...' : 'Loading video...'}
          </p>
          {bufferPct > 0 && status !== 'transcoding' && (
            <div className="mt-3 w-48">
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${bufferPct}%` }}
                />
              </div>
              <p className="text-white/60 text-xs text-center mt-1">{bufferPct}% buffered</p>
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/70 rounded-lg">
          <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
          <p className="text-white text-sm font-medium mb-1">Playback failed</p>
          <p className="text-white/60 text-xs text-center max-w-xs mb-4">{errorMsg}</p>
          <button
            onClick={() => api.downloadFile(file.path, file.name)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> Download File
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        key={src}
        src={src}
        controls
        autoPlay
        className="max-w-full max-h-[85vh] rounded-lg shadow-2xl bg-black"
        style={{ minWidth: '60vw', minHeight: '50vh' }}
        onError={handleError}
      />
    </div>
  );
}


/* ── FilePreview (main overlay) ──────────────────────────────────────────── */
export default function FilePreview({ file, onClose, onPrev, onNext, hasPrev, hasNext }) {
  const isImg = file.file_type === 'image';
  const isVid = file.file_type === 'video';
  const previewUrl = api.previewUrl(file.path);

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape')     onClose();
    if (e.key === 'ArrowLeft')  onPrev?.();
    if (e.key === 'ArrowRight') onNext?.();
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleKey]);

  return (
    <div className="preview-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm">
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="text-white font-medium text-sm truncate max-w-xs sm:max-w-md">{file.name}</p>
            <p className="text-white/60 text-xs">{fmtSize(file.size)}</p>
          </div>
        </div>
        <button
          onClick={() => api.downloadFile(file.path, file.name)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors backdrop-blur-sm"
        >
          <Download className="w-4 h-4" /> Download
        </button>
      </div>

      {/* Prev / Next */}
      {hasPrev && (
        <button onClick={onPrev} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm">
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {hasNext && (
        <button onClick={onNext} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm">
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Content */}
      <div className="preview-content max-w-[90vw] max-h-[85vh] flex items-center justify-center">
        {isImg ? (
          <img
            key={file.path}
            src={previewUrl}
            alt={file.name}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            draggable={false}
          />
        ) : isVid ? (
          <VideoPlayer file={file} />
        ) : (
          <div className="flex flex-col items-center gap-4 text-white/80 p-8">
            <FileIcon className="w-20 h-20" />
            <p className="text-lg font-medium">{file.name}</p>
            <p className="text-sm text-white/50">Preview not available for this file type</p>
            <button
              onClick={() => api.downloadFile(file.path, file.name)}
              className="mt-2 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> Download File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
