import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../App';
import { api } from '../api';
import FileCard, { FileRow, FolderCard, FolderRow, fmtSize } from './FileCard';
import FilePreview from './FilePreview';
import {
  Search, LayoutGrid, List, SlidersHorizontal, Download,
  X, LogOut, Users, Share2, ChevronDown, Image, Film, FileIcon,
  FolderOpen, Check, Shield, UserPlus, Trash2, ChevronRight, Home,
  RefreshCw,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
   Dashboard – filesystem browser with folder navigation
   ═══════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user, logout } = useAuth();

  /* ── Navigation ─────────────────── */
  const [currentPath, setCurrentPath] = useState('/');

  /* ── Data ────────────────────────── */
  const [folders, setFolders]   = useState([]);
  const [files, setFiles]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [fileType, setFileType] = useState('all');
  const [sort, setSort]         = useState('name');
  const [view, setView]         = useState('grid'); // grid | list

  /* ── Selection (files only) ─────── */
  const [selected, setSelected]   = useState(new Set());
  const lastIdx = useRef(null);

  /* ── Preview ────────────────────── */
  const [previewFile, setPreviewFile] = useState(null);

  /* ── Modals ─────────────────────── */
  const [showUsers, setShowUsers]   = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [userMenu, setUserMenu]     = useState(false);

  /* ── Stats ──────────────────────── */
  const [stats, setStats] = useState(null);

  /* ── Load files ─────────────────── */
  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getFiles({ path: currentPath, search, file_type: fileType, sort });
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch { toast.error('Failed to load files'); }
    finally { setLoading(false); }
  }, [currentPath, search, fileType, sort]);

  useEffect(() => { loadFiles(); }, [loadFiles]);
  useEffect(() => { api.getStats(currentPath).then(setStats).catch(() => {}); }, [currentPath, files.length]);

  // Clear selection when navigating
  useEffect(() => { setSelected(new Set()); lastIdx.current = null; }, [currentPath]);

  /* ── Navigation ─────────────────── */
  const navigateTo = (path) => {
    setSearch('');
    setCurrentPath(path);
  };

  const breadcrumbs = currentPath === '/'
    ? [{ name: 'Home', path: '/' }]
    : [
        { name: 'Home', path: '/' },
        ...currentPath.split('/').filter(Boolean).map((part, i, arr) => ({
          name: part,
          path: '/' + arr.slice(0, i + 1).join('/'),
        })),
      ];

  /* ── Selection ──────────────────── */
  const selecting = selected.size > 0;

  const handleSelect = (filePath, index, e) => {
    const s = new Set(selected);
    if (e.shiftKey && lastIdx.current != null) {
      const [a, b] = [Math.min(lastIdx.current, index), Math.max(lastIdx.current, index)];
      for (let i = a; i <= b; i++) s.add(files[i].path);
    } else if (e.ctrlKey || e.metaKey) {
      s.has(filePath) ? s.delete(filePath) : s.add(filePath);
    } else {
      if (s.has(filePath) && s.size === 1) s.clear();
      else { s.clear(); s.add(filePath); }
    }
    lastIdx.current = index;
    setSelected(s);
  };

  const selectAll = () => {
    if (selected.size === files.length) setSelected(new Set());
    else setSelected(new Set(files.map(f => f.path)));
  };

  /* ── Bulk actions ───────────────── */
  const bulkDownload = async () => {
    try {
      toast.loading('Preparing ZIP...', { id: 'zip' });
      await api.bulkDownload(Array.from(selected));
      toast.success('Download started', { id: 'zip' });
    } catch { toast.error('Download failed', { id: 'zip' }); }
  };

  /* ── Preview nav ────────────────── */
  const previewIdx = previewFile ? files.findIndex(f => f.path === previewFile.path) : -1;
  const prevPreview = () => { if (previewIdx > 0) setPreviewFile(files[previewIdx - 1]); };
  const nextPreview = () => { if (previewIdx < files.length - 1) setPreviewFile(files[previewIdx + 1]); };

  /* ── Keyboard shortcuts ─────────── */
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); selectAll(); }
      if (e.key === 'Escape') setSelected(new Set());
      if (e.key === 'Backspace' && currentPath !== '/') {
        e.preventDefault();
        const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
        navigateTo(parent);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const isEmpty = folders.length === 0 && files.length === 0;

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mr-2 sm:mr-4 shrink-0 cursor-pointer" onClick={() => navigateTo('/')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <span className="hidden sm:block text-lg font-bold text-gray-900 tracking-tight">GhumaggerSnap</span>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search files in this folder..."
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-xl text-sm focus:bg-white focus:border-gray-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {/* Refresh */}
            <button onClick={loadFiles} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors" title="Refresh">
              <RefreshCw className="w-5 h-5" />
            </button>

            {/* Filter */}
            <div className="relative">
              <button onClick={() => setShowFilter(!showFilter)}
                className={`p-2 rounded-xl transition-colors ${showFilter || fileType !== 'all' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}>
                <SlidersHorizontal className="w-5 h-5" />
              </button>
              {showFilter && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowFilter(false)} />
                  <div className="absolute right-0 top-11 z-30 bg-white rounded-xl shadow-xl border border-gray-200 p-3 min-w-[200px] animate-scale-in">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">File Type</p>
                    {['all', 'image', 'video'].map(t => (
                      <button key={t} onClick={() => { setFileType(t); setShowFilter(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${fileType === t ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                        {t === 'all' ? <FolderOpen className="w-4 h-4" /> : t === 'image' ? <Image className="w-4 h-4" /> : <Film className="w-4 h-4" />}
                        {t === 'all' ? 'All files' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
                      </button>
                    ))}
                    <hr className="my-2" />
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sort</p>
                    {[['name', 'Name A-Z'], ['newest', 'Newest first'], ['oldest', 'Oldest first'], ['size', 'Largest first']].map(([k, l]) => (
                      <button key={k} onClick={() => { setSort(k); setShowFilter(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${sort === k ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* View toggle */}
            <div className="hidden sm:flex bg-gray-100 rounded-xl p-0.5">
              <button onClick={() => setView('grid')} className={`p-1.5 rounded-lg transition-colors ${view === 'grid' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setView('list')} className={`p-1.5 rounded-lg transition-colors ${view === 'list' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* User menu */}
            <div className="relative ml-1">
              <button onClick={() => setUserMenu(!userMenu)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                  {user.username[0].toUpperCase()}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
              </button>
              {userMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setUserMenu(false)} />
                  <div className="absolute right-0 top-12 z-30 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[200px] animate-scale-in">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-800">{user.username}</p>
                      <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                    </div>
                    {user.role === 'admin' && (
                      <button onClick={() => { setUserMenu(false); setShowUsers(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <Users className="w-4 h-4" /> Manage Users
                      </button>
                    )}
                    <button onClick={() => { setUserMenu(false); logout(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Breadcrumbs ── */}
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-2.5 flex items-center gap-1 text-sm overflow-x-auto">
        {breadcrumbs.map((bc, i) => (
          <React.Fragment key={bc.path}>
            {i > 0 && <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />}
            <button
              onClick={() => navigateTo(bc.path)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg shrink-0 transition-colors
                ${i === breadcrumbs.length - 1 ? 'text-gray-800 font-medium bg-gray-100' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              {i === 0 && <Home className="w-3.5 h-3.5" />}
              {bc.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* ── Stats bar ── */}
      {stats && (
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 pb-2 flex items-center gap-4 text-xs text-gray-400">
          {folders.length > 0 && <span>{folders.length} folder{folders.length !== 1 ? 's' : ''}</span>}
          {folders.length > 0 && files.length > 0 && <span>&middot;</span>}
          {files.length > 0 && <span>{stats.total_files} file{stats.total_files !== 1 ? 's' : ''}</span>}
          {stats.total_size > 0 && <><span>&middot;</span><span>{fmtSize(stats.total_size)}</span></>}
          {stats.by_type?.image > 0 && <><span>&middot;</span><span className="flex items-center gap-1"><Image className="w-3 h-3" /> {stats.by_type.image}</span></>}
          {stats.by_type?.video > 0 && <><span>&middot;</span><span className="flex items-center gap-1"><Film className="w-3 h-3" /> {stats.by_type.video}</span></>}
          {selecting && (
            <>
              <span>&middot;</span>
              <span className="text-blue-600 font-medium">{selected.size} selected</span>
              <button onClick={() => setSelected(new Set())} className="text-blue-600 hover:text-blue-700 font-medium">Clear</button>
              <button onClick={selectAll} className="text-blue-600 hover:text-blue-700 font-medium">
                {selected.size === files.length ? 'Deselect all' : 'Select all'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Content ── */}
      <main className={`flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 pb-24 ${selecting ? 'selecting' : ''}`}>
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400 animate-fade-in">
            <FolderOpen className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-500 mb-1">
              {search || fileType !== 'all' ? 'No files match your filters' : 'This folder is empty'}
            </p>
            <p className="text-sm">
              {search ? 'Try a different search term' : 'Navigate to a folder that contains images or videos'}
            </p>
          </div>
        ) : view === 'grid' ? (
          <div className="space-y-6">
            {/* Folders */}
            {folders.length > 0 && (
              <div>
                {files.length > 0 && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Folders</p>}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 stagger">
                  {folders.map(f => (
                    <FolderCard key={f.path} folder={f} onOpen={() => navigateTo(f.path)} />
                  ))}
                </div>
              </div>
            )}
            {/* Files */}
            {files.length > 0 && (
              <div>
                {folders.length > 0 && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Files</p>}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 stagger">
                  {files.map((f, i) => (
                    <FileCard
                      key={f.path} file={f}
                      selected={selected.has(f.path)} selecting={selecting}
                      onSelect={(e) => handleSelect(f.path, i, e)}
                      onPreview={() => setPreviewFile(f)}
                      onDownload={() => api.downloadFile(f.path, f.name)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 stagger">
            {/* List header */}
            <div className="flex items-center gap-4 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <div className="w-5" />
              <div className="w-10" />
              <div className="flex-1">Name</div>
              <div className="hidden sm:block w-20 text-right">Size</div>
              <div className="hidden md:block w-24 text-right">Date</div>
              <div className="hidden lg:block w-24 text-right">Type</div>
              <div className="w-8" />
            </div>
            {/* Folders */}
            {folders.map(f => (
              <FolderRow key={f.path} folder={f} onOpen={() => navigateTo(f.path)} />
            ))}
            {/* Files */}
            {files.map((f, i) => (
              <FileRow
                key={f.path} file={f}
                selected={selected.has(f.path)} selecting={selecting}
                onSelect={(e) => handleSelect(f.path, i, e)}
                onPreview={() => setPreviewFile(f)}
                onDownload={() => api.downloadFile(f.path, f.name)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Bulk Action Bar ── */}
      {selecting && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 animate-slide-up">
          <div className="flex items-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-2xl shadow-2xl">
            <span className="text-sm font-medium mr-2">{selected.size} selected</span>
            <button onClick={bulkDownload}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors">
              <Download className="w-4 h-4" /> Download
            </button>
            <button onClick={() => setSelected(new Set())}
              className="ml-1 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Preview ── */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onPrev={prevPreview} onNext={nextPreview}
          hasPrev={previewIdx > 0} hasNext={previewIdx < files.length - 1}
        />
      )}

      {/* ── User Management Modal ── */}
      {showUsers && <UserModal onClose={() => setShowUsers(false)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   User Management Modal (admin only)
   ═══════════════════════════════════════════════════════════════════ */
function UserModal({ onClose }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState('viewer');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try { setUsers(await api.getUsers()); }
    catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setCreating(true);
    try {
      await api.createUser(username, password, role);
      toast.success('User created');
      setUsername(''); setPassword('');
      load();
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const remove = async (id, name) => {
    if (!confirm(`Delete user "${name}"?`)) return;
    try { await api.deleteUser(id); toast.success('User deleted'); load(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg mx-4 animate-scale-in overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">User Management</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : users.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {u.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{u.username}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'editor' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                {u.role}
              </span>
              {u.role !== 'admin' && (
                <button onClick={() => remove(u.id, u.username)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={create} className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Create New User
          </p>
          <div className="flex flex-wrap gap-2">
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username"
              className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none" required />
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password"
              className="flex-1 min-w-[120px] px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none" required />
            <select value={role} onChange={e => setRole(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none">
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
              {creating ? '...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
