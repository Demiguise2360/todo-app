const API_BASE = '/api';

const api = {
  token: localStorage.getItem('tf_token'),

  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem('tf_token', t);
    else localStorage.removeItem('tf_token');
  },

  async request(method, path, body) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
      }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Fehler');
    return data;
  },

  // Auth
  login: (email, password) => api.request('POST', '/auth/login', { email, password }),
  register: (username, email, password) => api.request('POST', '/auth/register', { username, email, password }),
  me: () => api.request('GET', '/auth/me'),

  // Todos
  getTodos: () => api.request('GET', '/todos'),
  getCompleted: () => api.request('GET', '/todos/completed'),
  getCalendar: () => api.request('GET', '/todos/calendar'),
  createTodo: (data) => api.request('POST', '/todos', data),
  updateTodo: (id, data) => api.request('PUT', `/todos/${id}`, data),
  completeTodo: (id) => api.request('PATCH', `/todos/${id}/complete`),
  restoreTodo: (id) => api.request('PATCH', `/todos/${id}/restore`),
  deleteTodo: (id) => api.request('DELETE', `/todos/${id}`),

  // PDF export
  exportPdf(type = 'active') {
    const url = `${API_BASE}/todos/export/pdf?type=${type}`;
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '');
    // pass token via header isn't possible for direct download, so use temporary approach
    fetch(url, { headers: { Authorization: `Bearer ${api.token}` } })
      .then(r => r.blob())
      .then(blob => {
        const u = URL.createObjectURL(blob);
        a.href = u;
        a.click();
        URL.revokeObjectURL(u);
      });
  }
};
