import React, { useEffect, useCallback } from 'react';
import { api } from '../api';
import { X, ChevronLeft, ChevronRight, Download, FileIcon } from 'lucide-react';
import { fmtSize } from './FileCard';

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
          <video
            key={file.path}
            src={previewUrl}
            controls
            autoPlay
            preload="metadata"
            playsInline
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl bg-black"
            style={{ minWidth: '320px' }}
          />
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
