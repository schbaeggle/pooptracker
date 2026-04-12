<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { api } from './api';
import { bristolOptions } from './constants';
import Button from '@/components/ui/button/Button.vue';
import Card from '@/components/ui/card/Card.vue';
import CardHeader from '@/components/ui/card/CardHeader.vue';
import CardTitle from '@/components/ui/card/CardTitle.vue';
import CardDescription from '@/components/ui/card/CardDescription.vue';
import CardContent from '@/components/ui/card/CardContent.vue';
import Input from '@/components/ui/input/Input.vue';
import Textarea from '@/components/ui/textarea/Textarea.vue';
import Select from '@/components/ui/select/Select.vue';
import DateTimePicker from '@/components/ui/datetime/DateTimePicker.vue';

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
  latest: [],
  activityDays: []
});

const form = ref({
  personId: '',
  happenedAt: new Date().toISOString(),
  bristolType: '4',
  note: ''
});

const newPersonName = ref('');
const adminError = ref('');
const adminPinInput = ref('');
const adminUnlocked = ref(false);
const adminUnlockError = ref('');
const adminUnlocking = ref(false);
let adminUnlockDebounce = null;

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
    form.value.happenedAt = new Date().toISOString();

    await Promise.all([loadEntries(), loadDashboard()]);
  } catch (e) {
    error.value = e.message;
  }
}

async function addPerson(event) {
  if (event) {
    event.preventDefault();
  }
  
  adminError.value = '';
  success.value = '';

  const nameValue = newPersonName.value.trim();
  console.log('DEBUG: nameValue =', nameValue, 'length:', nameValue.length);

  try {
    if (!nameValue) {
      throw new Error('Name darf nicht leer sein.');
    }

    await api.addPerson(nameValue, adminPinInput.value);
    newPersonName.value = '';
    success.value = 'Name hinzugefuegt.';
    await loadPeople();
  } catch (e) {
    adminError.value = e.message;
    if (String(e.message).toLowerCase().includes('pin')) {
      adminUnlocked.value = false;
    }
  }
}

async function removePerson(id) {
  adminError.value = '';
  success.value = '';

  try {
    await api.deletePerson(id, adminPinInput.value);
    success.value = 'Name entfernt.';
    await Promise.all([loadPeople(), loadDashboard()]);
  } catch (e) {
    adminError.value = e.message;
    if (String(e.message).toLowerCase().includes('pin')) {
      adminUnlocked.value = false;
    }
  }
}

async function unlockAdmin() {
  adminUnlockError.value = '';
  adminError.value = '';
  success.value = '';

  try {
    adminUnlocking.value = true;

    if (!/^\d{4}$/.test(adminPinInput.value.trim())) {
      throw new Error('PIN muss 4-stellig sein.');
    }

    await api.verifyAdminPin(adminPinInput.value.trim());
    adminUnlocked.value = true;
    success.value = 'Admin-Bereich entsperrt.';
  } catch (e) {
    adminUnlocked.value = false;
    adminUnlockError.value = e.message;
  } finally {
    adminUnlocking.value = false;
  }
}

watch(adminPinInput, (value) => {
  const pin = value.trim();

  if (adminUnlockDebounce) {
    clearTimeout(adminUnlockDebounce);
    adminUnlockDebounce = null;
  }

  if (pin.length === 0) {
    adminUnlockError.value = '';
    adminUnlocked.value = false;
    return;
  }

  if (!/^\d{0,4}$/.test(pin)) {
    adminUnlocked.value = false;
    adminUnlockError.value = 'PIN darf nur Ziffern enthalten.';
    return;
  }

  if (pin.length < 4) {
    adminUnlocked.value = false;
    adminUnlockError.value = '';
    return;
  }

  if (adminUnlocked.value || adminUnlocking.value) {
    return;
  }

  adminUnlockDebounce = setTimeout(() => {
    unlockAdmin();
  }, 120);
});

onBeforeUnmount(() => {
  if (adminUnlockDebounce) {
    clearTimeout(adminUnlockDebounce);
  }
});

const bristolDistribution = computed(() => {
  const total = dashboard.value.byBristolType.reduce((sum, item) => sum + item.count, 0) || 1;

  return dashboard.value.byBristolType.map((item) => ({
    ...item,
    percent: Math.round((item.count / total) * 100)
  }));
});

const topPeople = computed(() => dashboard.value.perPerson.filter((row) => row.count > 0).slice(0, 3));

function activityLevelClass(level) {
  if (level <= 0) return 'bg-slate-200';
  if (level === 1) return 'bg-emerald-200';
  if (level === 2) return 'bg-emerald-300';
  if (level === 3) return 'bg-emerald-500';
  return 'bg-emerald-700';
}

function activityTextClass(level) {
  return level >= 3 ? 'text-white/95' : 'text-slate-700';
}

const activityHeatmap = computed(() => {
  const totalDays = 14;
  const sourceDays = Array.isArray(dashboard.value.activityDays) ? dashboard.value.activityDays : [];
  const countByDate = new Map(sourceDays.map((item) => [item.date, item.count]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - (totalDays - 1));

  const days = [];
  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dateKey = date.toISOString().slice(0, 10);
    const count = countByDate.get(dateKey) ?? 0;

    days.push({
      dateKey,
      count,
      weekdayIndex: date.getDay(),
      weekdayShort: new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(date),
      label: new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(date)
    });
  }

  const maxCount = days.reduce((max, day) => Math.max(max, day.count), 0);
  const thresholds = [
    Math.max(1, Math.ceil(maxCount * 0.25)),
    Math.max(1, Math.ceil(maxCount * 0.5)),
    Math.max(1, Math.ceil(maxCount * 0.75))
  ];

  const daysWithLevel = days.map((day) => {
    let level = 0;
    if (day.count > 0) {
      if (day.count <= thresholds[0]) {
        level = 1;
      } else if (day.count <= thresholds[1]) {
        level = 2;
      } else if (day.count <= thresholds[2]) {
        level = 3;
      } else {
        level = 4;
      }
    }

    return {
      ...day,
      level
    };
  });

  const totalEvents = days.reduce((sum, day) => sum + day.count, 0);

  return {
    days: daysWithLevel,
    maxCount,
    totalEvents,
    startLabel: days[0]?.label ?? '',
    endLabel: days[days.length - 1]?.label ?? ''
  };
});

onMounted(() => {
  refreshAll();
});
</script>

<template>
  <main class="min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 px-4 py-6 text-slate-900">
    <div class="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Card class-name="border-white/60 bg-white/80 shadow-xl backdrop-blur">
        <CardHeader>
          <CardTitle class-name="text-3xl font-semibold tracking-tight">Pooptracker</CardTitle>
          <CardDescription>ANALytische reevaluation des Speiseplans, FTH 2026</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent class-name="pt-6">
          <div class="grid grid-cols-3 gap-2">
            <Button :variant="activeTab === 'track' ? 'default' : 'outline'" @click="activeTab = 'track'">
              Track
            </Button>
            <Button
              :variant="activeTab === 'dashboard' ? 'default' : 'outline'"
              @click="activeTab = 'dashboard'"
            >
              Dashboard
            </Button>
            <Button :variant="activeTab === 'admin' ? 'default' : 'outline'" @click="activeTab = 'admin'">
              Admin
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card v-if="loading" class-name="border-slate-300 bg-slate-100">
        <CardContent class-name="pt-6 text-sm text-slate-700">Lade Daten...</CardContent>
      </Card>

      <Card v-if="error" class-name="border-red-200 bg-red-50">
        <CardContent class-name="pt-6 text-sm text-red-700">{{ error }}</CardContent>
      </Card>

      <Card v-if="success" class-name="border-blue-200 bg-blue-50">
        <CardContent class-name="pt-6 text-sm text-blue-800">{{ success }}</CardContent>
      </Card>

      <Card v-if="activeTab === 'track'">
        <CardHeader>
          <CardTitle>Neuer Eintrag</CardTitle>
        </CardHeader>
        <CardContent class-name="space-y-4">
          <label class="grid gap-2 text-sm font-medium text-slate-700">
            <span>Name</span>
            <Select v-model="form.personId">
              <option disabled value="">Bitte waehlen</option>
              <option v-for="person in people" :key="person.id" :value="String(person.id)">
                {{ person.name }}
              </option>
            </Select>
          </label>

          <label class="grid gap-2 text-sm font-medium text-slate-700">
            <span>Datum und Uhrzeit</span>
            <DateTimePicker v-model="form.happenedAt" />
          </label>

          <label class="grid gap-2 text-sm font-medium text-slate-700">
            <span>Bristol Stool Scale</span>
            <Select v-model="form.bristolType">
              <option v-for="option in bristolOptions" :key="option.value" :value="String(option.value)">
                {{ option.label }}
              </option>
            </Select>
          </label>

          <label class="grid gap-2 text-sm font-medium text-slate-700">
            <span>Bemerkung (optional)</span>
            <Textarea v-model="form.note" rows="3" placeholder="Optionaler Hinweis" />
          </label>

          <Button class-name="w-full" @click="submitEntry">Speichern</Button>
        </CardContent>
      </Card>

      <div v-if="activeTab === 'dashboard'" class="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Übersicht</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="grid gap-3 md:grid-cols-2">
              <Card class-name="bg-slate-50">
                <CardContent class-name="pt-6">
                  <p class="text-sm text-slate-500">Gesamt</p>
                  <p class="text-4xl font-semibold tracking-tight text-slate-900">{{ dashboard.totalEntries }}</p>
                  <p class="text-sm text-slate-500">Eintraege</p>
                </CardContent>
              </Card>

              <Card class-name="bg-slate-50">
                <CardContent class-name="pt-6">
                  <p class="text-sm text-slate-500">Top 3</p>
                  <ul v-if="topPeople.length > 0" class="mt-2 space-y-1 text-sm text-slate-700">
                    <li v-for="(row, index) in topPeople" :key="row.id" class="flex items-center justify-between">
                      <span>{{ index + 1 }}. {{ row.name }}</span>
                      <span class="font-semibold">{{ row.count }}</span>
                    </li>
                  </ul>
                  <p v-else class="mt-2 text-sm text-slate-500">Noch keine Eintraege vorhanden.</p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zeitlicher Verlauf</CardTitle>
            <CardDescription>
              Letzte 2 Wochen als Heatmap. Dunkler bedeutet mehr Eintraege an einem Tag.
            </CardDescription>
          </CardHeader>
          <CardContent class-name="space-y-3">
            <div class="w-full rounded-xl bg-slate-100/80 p-3">
              <div class="grid w-full grid-cols-[repeat(14,minmax(0,1fr))] gap-2">
                <div
                  v-for="day in activityHeatmap.days"
                  :key="day.dateKey"
                  :class="[
                    activityLevelClass(day.level),
                    'flex h-10 w-full items-center justify-center rounded-md ring-1 ring-slate-300/40 transition-transform hover:scale-[1.04]'
                  ]"
                  :title="`${day.label}: ${day.count} Eintraege`"
                >
                  <span :class="[activityTextClass(day.level), 'text-xs font-semibold']">{{ day.weekdayShort }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between text-xs text-slate-500">
              <span>{{ activityHeatmap.startLabel }}</span>
              <span>{{ activityHeatmap.endLabel }}</span>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <p>{{ activityHeatmap.totalEvents }} Eintraege in den letzten 2 Wochen.</p>
              <div class="flex items-center gap-2">
                <span>Weniger</span>
                <div class="h-3 w-3 rounded-[3px] bg-slate-200" />
                <div class="h-3 w-3 rounded-[3px] bg-emerald-200" />
                <div class="h-3 w-3 rounded-[3px] bg-emerald-300" />
                <div class="h-3 w-3 rounded-[3px] bg-emerald-500" />
                <div class="h-3 w-3 rounded-[3px] bg-emerald-700" />
                <span>Mehr</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bristol-Verteilung</CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="space-y-3">
              <li v-for="item in bristolDistribution" :key="item.type" class="space-y-1.5">
                <div class="flex items-center justify-between gap-4 text-sm">
                  <span class="text-slate-700">{{ item.label }}</span>
                  <span class="font-semibold text-slate-800">{{ item.count }} ({{ item.percent }}%)</span>
                </div>
                <div class="h-2 rounded-full bg-slate-200">
                  <div
                    class="h-2 rounded-full bg-gradient-to-r from-blue-700 to-blue-400 transition-all"
                    :style="{ width: `${item.percent}%` }"
                  />
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Letzte Eintraege</CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="divide-y divide-slate-200">
              <li v-for="entry in dashboard.latest" :key="entry.id" class="flex items-center justify-between gap-3 py-3">
                <div>
                  <p class="font-semibold text-slate-800">{{ entry.personName }}</p>
                  <p class="text-sm text-slate-500">{{ entry.bristolLabel }}</p>
                </div>
                <span class="text-xs text-slate-500">{{ formatDateTime(entry.happenedAt) }}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eintraege je Person</CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="divide-y divide-slate-200">
              <li v-for="row in dashboard.perPerson" :key="row.id" class="flex items-center justify-between py-3">
                <span class="font-medium text-slate-800">{{ row.name }}</span>
                <span class="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700">{{ row.count }}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card v-if="activeTab === 'admin'">
        <CardHeader>
          <CardTitle>Namen verwalten</CardTitle>
        </CardHeader>
        <CardContent class-name="space-y-4">
          <div v-if="!adminUnlocked" class="space-y-3">
            <p class="text-sm text-slate-600">Admin-Bereich ist geschuetzt. Bitte 4-stellige PIN eingeben.</p>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                v-model="adminPinInput"
                type="password"
                inputmode="numeric"
                maxlength="4"
                autocomplete="off"
                placeholder="PIN"
              />
            </div>
            <p class="text-xs text-slate-500">Nach Eingabe der 4. Ziffer wird automatisch geprueft.</p>
            <p v-if="adminUnlockError" class="text-sm text-red-700">{{ adminUnlockError }}</p>
            <p v-else-if="adminUnlocking" class="text-sm text-slate-600">PIN wird geprueft...</p>
          </div>

          <template v-else>
            <form @submit.prevent="addPerson" class="space-y-3">
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                <input 
                  v-model="newPersonName" 
                  type="text" 
                  placeholder="Neuer Name" 
                  class="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" 
                />
                <button type="submit" class="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">Hinzufuegen</button>
              </div>
            </form>

            <p v-if="adminError" class="text-sm text-red-700">{{ adminError }}</p>

            <ul class="divide-y divide-slate-200">
              <li v-for="person in people" :key="person.id" class="flex items-center justify-between py-3">
                <span class="font-medium text-slate-800">{{ person.name }}</span>
                <Button variant="destructive" size="sm" @click="removePerson(person.id)">Entfernen</Button>
              </li>
            </ul>
          </template>
        </CardContent>
      </Card>
    </div>
  </main>
</template>
