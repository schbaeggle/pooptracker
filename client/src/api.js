async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let message = 'Unbekannter Fehler';
    try {
      const data = await response.json();
      message = data.error || message;
    } catch {
      // no-op
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  getPeople: () => request('/api/people'),
  verifyAdminPin: (pin) =>
    request('/api/admin/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
  addPerson: (name, pin) =>
    request('/api/people', {
      method: 'POST',
      headers: { 'x-admin-pin': String(pin) },
      body: JSON.stringify({ name })
    }),
  deletePerson: (id, pin) =>
    request(`/api/people/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-pin': String(pin) }
    }),
  getEntries: () => request('/api/entries'),
  addEntry: (payload) => request('/api/entries', { method: 'POST', body: JSON.stringify(payload) }),
  getDashboard: () => request('/api/dashboard')
};
