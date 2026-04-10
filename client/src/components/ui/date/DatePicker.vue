<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { Calendar } from 'lucide-vue-next';
import Button from '@/components/ui/button/Button.vue';
import Card from '@/components/ui/card/Card.vue';
import CardContent from '@/components/ui/card/CardContent.vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const rootEl = ref(null);
const monthCursor = ref(startOfMonth(parseDate(partsOrToday(props.modelValue))));

watch(
  () => props.modelValue,
  (value) => {
    const parsed = parseDate(partsOrToday(value));
    monthCursor.value = startOfMonth(parsed);
  }
);

const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const monthLabel = computed(() => {
  return new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric'
  }).format(monthCursor.value);
});

const selectedDate = computed(() => parseDate(partsOrToday(props.modelValue)));

const displayValue = computed(() => {
  if (!props.modelValue) {
    return 'Datum waehlen';
  }

  const date = parseDate(props.modelValue);
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(date);
});

const calendarCells = computed(() => {
  const first = startOfMonth(monthCursor.value);
  const firstWeekday = toMondayFirstIndex(first.getDay());
  const dayCount = daysInMonth(first.getFullYear(), first.getMonth() + 1);

  const cells = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= dayCount; day += 1) {
    cells.push(new Date(first.getFullYear(), first.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
});

function partsOrToday(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function toMondayFirstIndex(day) {
  return (day + 6) % 7;
}

function toYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function prevMonth() {
  monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() - 1, 1);
}

function nextMonth() {
  monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() + 1, 1);
}

function isSelected(date) {
  return toYmd(date) === props.modelValue;
}

function chooseDate(date) {
  emit('update:modelValue', toYmd(date));
  isOpen.value = false;
}

function onDocumentClick(event) {
  if (!isOpen.value) {
    return;
  }

  const root = rootEl.value;
  if (!root) {
    return;
  }

  if (!root.contains(event.target)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
});
</script>

<template>
  <div ref="rootEl" class="relative">
    <Button variant="outline" class-name="w-full justify-between" @click="isOpen = !isOpen">
      <span>{{ displayValue }}</span>
      <Calendar class="h-4 w-4 text-slate-500" />
    </Button>

    <Card v-if="isOpen" class-name="absolute z-40 mt-2 w-full shadow-xl">
      <CardContent class-name="p-3 pt-3">
        <div class="mb-2 flex items-center justify-between">
          <Button variant="outline" size="sm" @click="prevMonth">&lt;</Button>
          <p class="text-sm font-semibold capitalize text-slate-700">{{ monthLabel }}</p>
          <Button variant="outline" size="sm" @click="nextMonth">&gt;</Button>
        </div>

        <div class="mb-1 grid grid-cols-7 gap-1">
          <div v-for="label in dayLabels" :key="label" class="text-center text-xs font-medium text-slate-500">
            {{ label }}
          </div>
        </div>

        <div class="grid grid-cols-7 gap-1">
          <template v-for="(cell, index) in calendarCells" :key="index">
            <button
              v-if="cell"
              type="button"
              class="h-9 rounded-md text-sm transition-colors"
              :class="
                isSelected(cell)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-slate-700 hover:bg-slate-100'
              "
              @click="chooseDate(cell)"
            >
              {{ cell.getDate() }}
            </button>
            <span v-else class="h-9" />
          </template>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
