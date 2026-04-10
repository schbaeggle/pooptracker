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
  addPerson: (name) => request('/api/people', { method: 'POST', body: JSON.stringify({ name }) }),
  deletePerson: (id) => request(`/api/people/${id}`, { method: 'DELETE' }),
  getEntries: () => request('/api/entries'),
  addEntry: (payload) => request('/api/entries', { method: 'POST', body: JSON.stringify(payload) }),
  getDashboard: () => request('/api/dashboard')
};
