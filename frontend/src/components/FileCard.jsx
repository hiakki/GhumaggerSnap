import React, { useState } from 'react';
import { api } from '../api';
import { Image, Film, FileIcon, Check, Play, Download, MoreVertical, Folder } from 'lucide-react';

/* ── Utilities ──────────────────────────────────────────────────── */
export function fmtSize(b) {
  if (!b) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
}

export function fmtDate(d) {
  if (!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60000)    return 'Just now';
  if (ms < 3600000)  return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  if (ms < 604800000) return `${Math.floor(ms / 86400000)}d ago`;
  return new Date(d).toLocaleDateString();
}

const typeIcon = {
  image: <Image className="w-10 h-10 text-blue-400" />,
  video: <Film  className="w-10 h-10 text-purple-400" />,
  other: <FileIcon className="w-10 h-10 text-gray-400" />,
};

/* ── Folder Card (Grid) ────────────────────────────────────────── */
export function FolderCard({ folder, onOpen }) {
  return (
    <div
      className="file-card group overflow-hidden flex flex-col cursor-pointer"
      onClick={onOpen}
    >
      <div className="relative aspect-[4/3] bg-amber-50 flex items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center gap-2">
          <Folder className="w-14 h-14 text-amber-400 fill-amber-100" />
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />
      </div>
      <div className="p-3 flex-1 flex flex-col min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate" title={folder.name}>
          {folder.name}
        </p>
        <span className="text-xs text-gray-400 mt-1">{folder.item_count} item{folder.item_count !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

/* ── Folder Row (List) ─────────────────────────────────────────── */
export function FolderRow({ folder, onOpen }) {
  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-amber-50/50 hover:border-amber-200 transition-all duration-150 cursor-pointer"
      onClick={onOpen}
    >
      <div className="shrink-0 w-5 h-5" /> {/* spacer for checkbox alignment */}
      <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
        <Folder className="w-5 h-5 text-amber-400 fill-amber-100" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{folder.name}</p>
      </div>
      <span className="hidden sm:block text-xs text-gray-400 w-20 text-right">{folder.item_count} items</span>
      <span className="hidden md:block text-xs text-gray-400 w-24 text-right">{fmtDate(folder.modified_at)}</span>
      <span className="hidden lg:block text-xs text-gray-400 w-24 text-right">Folder</span>
      <div className="w-8" />
    </div>
  );
}

/* ── File Card (Grid) ──────────────────────────────────────────── */
export default function FileCard({ file, selected, selecting, onSelect, onPreview, onDownload }) {
  const [thumbErr, setThumbErr] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isImg  = file.file_type === 'image';
  const isVid  = file.file_type === 'video';
  const showThumb = isImg && !thumbErr;

  return (
    <div
      className={`file-card group overflow-hidden flex flex-col ${selected ? 'selected' : ''}`}
      onClick={(e) => {
        if (e.target.closest('.card-action')) return;
        if (selecting || e.ctrlKey || e.metaKey || e.shiftKey) {
          onSelect(e);
        } else {
          onPreview();
        }
      }}
    >
      {/* Checkbox */}
      <div className="card-check card-action" onClick={(e) => { e.stopPropagation(); onSelect(e); }}>
        {selected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </div>

      {/* Thumbnail area */}
      <div className="relative aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden">
        {showThumb ? (
          <img
            src={api.thumbnailUrl(file.path)}
            alt={file.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setThumbErr(true)}
            loading="lazy"
          />
        ) : isVid ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center">
              <Play className="w-7 h-7 text-purple-500 ml-0.5" />
            </div>
            <span className="text-xs text-purple-400 font-medium uppercase tracking-wide">
              {file.name.split('.').pop()}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {typeIcon[file.file_type] || typeIcon.other}
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              {file.name.split('.').pop()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate" title={file.name}>
          {file.name}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-gray-400">{fmtSize(file.size)} &middot; {fmtDate(file.modified_at)}</span>

          <div className="relative">
            <button
              className="card-action p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 bottom-8 z-30 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[140px] animate-scale-in">
                  <button
                    className="card-action w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDownload(); }}
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── File Row (List) ───────────────────────────────────────────── */
export function FileRow({ file, selected, selecting, onSelect, onPreview, onDownload }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [thumbErr, setThumbErr] = useState(false);
  const isImg = file.file_type === 'image';

  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-150 cursor-pointer
        ${selected ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-100' : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'}`}
      onClick={(e) => {
        if (e.target.closest('.card-action')) return;
        if (selecting || e.ctrlKey || e.metaKey || e.shiftKey) onSelect(e);
        else onPreview();
      }}
    >
      {/* Checkbox */}
      <div
        className={`card-action shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer
          ${selected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 hover:border-blue-400'}`}
        onClick={(e) => { e.stopPropagation(); onSelect(e); }}
      >
        {selected && <Check className="w-3 h-3" strokeWidth={3} />}
      </div>

      {/* Icon / Thumb */}
      <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
        {isImg && !thumbErr ? (
          <img src={api.thumbnailUrl(file.path)} className="w-full h-full object-cover" onError={() => setThumbErr(true)} loading="lazy" />
        ) : file.file_type === 'video' ? (
          <Play className="w-5 h-5 text-purple-400" />
        ) : (
          <FileIcon className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
      </div>

      {/* Size */}
      <span className="hidden sm:block text-xs text-gray-400 w-20 text-right">{fmtSize(file.size)}</span>

      {/* Date */}
      <span className="hidden md:block text-xs text-gray-400 w-24 text-right">{fmtDate(file.modified_at)}</span>

      {/* Type */}
      <span className="hidden lg:block text-xs text-gray-400 w-24 text-right capitalize">{file.file_type}</span>

      {/* Actions */}
      <div className="relative shrink-0">
        <button
          className="card-action p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-8 z-30 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[140px] animate-scale-in">
              <button className="card-action w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDownload(); }}>
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
