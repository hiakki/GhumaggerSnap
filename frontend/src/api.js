const API = '/api';

/* ── Token helpers ────────────────────────────────────────────── */
const getToken  = ()  => localStorage.getItem('fs_token');
const setToken  = (t) => localStorage.setItem('fs_token', t);
const clearAuth = ()  => { localStorage.removeItem('fs_token'); localStorage.removeItem('fs_user'); };
const getUser   = ()  => { try { return JSON.parse(localStorage.getItem('fs_user')); } catch { return null; } };
const setUser   = (u) => localStorage.setItem('fs_user', JSON.stringify(u));

/* ── Generic fetch wrapper ────────────────────────────────────── */
async function req(path, opts = {}) {
  const token = getToken();
  const headers = { ...opts.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, { ...opts, headers });

  if (res.status === 401) {
    clearAuth();
    window.location.reload();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res;
}

/* ── Public API ───────────────────────────────────────────────── */
export const api = {
  getToken, setToken, clearAuth, getUser, setUser,

  /* Auth */
  async login(username, password) {
    const res = await req('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    const data = await res.json();
    setToken(data.access_token);
    setUser(data.user);
    return data;
  },
  async getMe()    { return (await req('/auth/me')).json(); },
  async getUsers() { return (await req('/auth/users')).json(); },
  async createUser(username, password, role) {
    return (await req('/auth/users', { method: 'POST', body: JSON.stringify({ username, password, role }) })).json();
  },
  async deleteUser(id)  { return (await req(`/auth/users/${id}`, { method: 'DELETE' })).json(); },
  async changePassword(current_password, new_password) {
    return (await req('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) })).json();
  },

  /* Files */
  async getFiles(params = {}) {
    const q = new URLSearchParams();
    if (params.search)    q.set('search', params.search);
    if (params.file_type) q.set('file_type', params.file_type);
    if (params.sort)      q.set('sort', params.sort);
    return (await req(`/files?${q}`)).json();
  },
  async getStats() { return (await req('/stats')).json(); },

  uploadFiles(files, onProgress) {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    const token = getToken();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}/files/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100)); };
      xhr.onload  = () => xhr.status >= 200 && xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error('Upload failed'));
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(fd);
    });
  },

  async deleteFile(id)      { return (await req(`/files/${id}`, { method: 'DELETE' })).json(); },
  async bulkDelete(ids)     { return (await req('/files/bulk-delete', { method: 'POST', body: JSON.stringify(ids) })).json(); },

  /* URL builders (token in query for <img>/<video>) */
  previewUrl(id)   { return `${API}/files/${id}/preview?token=${getToken()}`; },
  thumbnailUrl(id) { return `${API}/files/${id}/thumbnail?token=${getToken()}`; },
  downloadUrl(id)  { return `${API}/files/${id}/download?token=${getToken()}`; },

  /* Downloads */
  downloadFile(id, name) {
    const a = document.createElement('a');
    a.href = this.downloadUrl(id); a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  },

  async bulkDownload(ids) {
    const res = await fetch(`${API}/files/bulk-download`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(ids),
    });
    if (!res.ok) throw new Error('Bulk download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `files-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  logout() { clearAuth(); },
};
