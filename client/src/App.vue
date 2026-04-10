<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from './api';
import { bristolOptions } from './constants';

const activeTab = ref('track');
const loading = ref(false);
const error = ref('');
const success = ref('');

const people = ref([]);
const entries = ref([]);
const dashboard = ref({
  totalEntries: 0,
  perPerson: [],
  byBristolType: [],
  latest: []
});

const form = ref({
  personId: '',
  happenedAt: toDatetimeLocal(new Date()),
  bristolType: 4,
  note: ''
});

const newPersonName = ref('');
const adminError = ref('');

function toDatetimeLocal(date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function formatDateTime(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

async function loadPeople() {
  people.value = await api.getPeople();

  if (!form.value.personId && people.value.length > 0) {
    form.value.personId = String(people.value[0].id);
  }
}

async function loadEntries() {
  entries.value = await api.getEntries();
}

async function loadDashboard() {
  dashboard.value = await api.getDashboard();
}

async function refreshAll() {
  loading.value = true;
  error.value = '';

  try {
    await Promise.all([loadPeople(), loadEntries(), loadDashboard()]);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function submitEntry() {
  error.value = '';
  success.value = '';

  try {
    if (!form.value.personId) {
      throw new Error('Bitte eine Person auswaehlen.');
    }

    await api.addEntry({
      personId: Number(form.value.personId),
      happenedAt: new Date(form.value.happenedAt).toISOString(),
      bristolType: Number(form.value.bristolType),
      note: form.value.note
    });

    success.value = 'Eintrag gespeichert.';
    form.value.note = '';
    form.value.happenedAt = toDatetimeLocal(new Date());

    await Promise.all([loadEntries(), loadDashboard()]);
  } catch (e) {
    error.value = e.message;
  }
}

async function addPerson() {
  adminError.value = '';
  success.value = '';

  try {
    if (!newPersonName.value.trim()) {
      throw new Error('Name darf nicht leer sein.');
    }

    await api.addPerson(newPersonName.value.trim());
    newPersonName.value = '';
    success.value = 'Name hinzugefuegt.';
    await loadPeople();
  } catch (e) {
    adminError.value = e.message;
  }
}

async function removePerson(id) {
  adminError.value = '';
  success.value = '';

  try {
    await api.deletePerson(id);
    success.value = 'Name entfernt.';
    await Promise.all([loadPeople(), loadDashboard()]);
  } catch (e) {
    adminError.value = e.message;
  }
}

const bristolDistribution = computed(() => {
  const total = dashboard.value.byBristolType.reduce((sum, item) => sum + item.count, 0) || 1;

  return dashboard.value.byBristolType.map((item) => ({
    ...item,
    percent: Math.round((item.count / total) * 100)
  }));
});

onMounted(() => {
  refreshAll();
});
</script>

<template>
  <main class="app-shell">
    <header class="hero">
      <h1>Pooptracker</h1>
      <p>Gruppen-Tracking fuer Stuhlgang mit Bristol-Skala.</p>
    </header>

    <nav class="tabbar">
      <button :class="{ active: activeTab === 'track' }" @click="activeTab = 'track'">Track</button>
      <button :class="{ active: activeTab === 'dashboard' }" @click="activeTab = 'dashboard'">Dashboard</button>
      <button :class="{ active: activeTab === 'admin' }" @click="activeTab = 'admin'">Admin</button>
    </nav>

    <p v-if="loading" class="hint">Lade Daten...</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>

    <section v-if="activeTab === 'track'" class="panel">
      <h2>Neuer Eintrag</h2>

      <label class="field">
        <span>Name</span>
        <select v-model="form.personId">
          <option disabled value="">Bitte waehlen</option>
          <option v-for="person in people" :key="person.id" :value="String(person.id)">
            {{ person.name }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>Datum und Uhrzeit</span>
        <input v-model="form.happenedAt" type="datetime-local" />
      </label>

      <label class="field">
        <span>Bristol Stool Scale</span>
        <select v-model.number="form.bristolType">
          <option v-for="option in bristolOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>Bemerkung (optional)</span>
        <textarea v-model="form.note" rows="3" placeholder="Optionaler Hinweis"></textarea>
      </label>

      <button class="primary" @click="submitEntry">Speichern</button>
    </section>

    <section v-if="activeTab === 'dashboard'" class="panel">
      <h2>Uebersicht</h2>

      <div class="stats-grid">
        <article class="stat-card">
          <p class="muted">Gesamt</p>
          <strong>{{ dashboard.totalEntries }}</strong>
          <span>Eintraege</span>
        </article>
      </div>

      <article class="subpanel">
        <h3>Eintraege je Person</h3>
        <ul class="list">
          <li v-for="row in dashboard.perPerson" :key="row.id">
            <span>{{ row.name }}</span>
            <strong>{{ row.count }}</strong>
          </li>
        </ul>
      </article>

      <article class="subpanel">
        <h3>Bristol-Verteilung</h3>
        <ul class="chart-list">
          <li v-for="item in bristolDistribution" :key="item.type">
            <div class="label-row">
              <span>{{ item.label }}</span>
              <strong>{{ item.count }} ({{ item.percent }}%)</strong>
            </div>
            <div class="bar-bg">
              <div class="bar-fill" :style="{ width: `${item.percent}%` }"></div>
            </div>
          </li>
        </ul>
      </article>

      <article class="subpanel">
        <h3>Letzte Eintraege</h3>
        <ul class="list spaced">
          <li v-for="entry in dashboard.latest" :key="entry.id">
            <div>
              <strong>{{ entry.personName }}</strong>
              <p class="muted">{{ entry.bristolLabel }}</p>
            </div>
            <small>{{ formatDateTime(entry.happenedAt) }}</small>
          </li>
        </ul>
      </article>
    </section>

    <section v-if="activeTab === 'admin'" class="panel">
      <h2>Namen verwalten</h2>

      <div class="inline-form">
        <input v-model="newPersonName" type="text" placeholder="Neuer Name" />
        <button class="primary" @click="addPerson">Hinzufuegen</button>
      </div>
      <p v-if="adminError" class="error">{{ adminError }}</p>

      <ul class="list">
        <li v-for="person in people" :key="person.id">
          <span>{{ person.name }}</span>
          <button class="danger" @click="removePerson(person.id)">Entfernen</button>
        </li>
      </ul>
    </section>
  </main>
</template>
