<script setup>
import { computed } from 'vue';
import DatePicker from '@/components/ui/date/DatePicker.vue';
import Input from '@/components/ui/input/Input.vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue']);

function toDateParts(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: Math.floor(now.getMinutes() / 5) * 5
    };
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: Math.floor(date.getMinutes() / 5) * 5
  };
}

const parsed = computed(() => toDateParts(props.modelValue));

const selectedDateYmd = computed(() => {
  return `${parsed.value.year}-${String(parsed.value.month).padStart(2, '0')}-${String(parsed.value.day).padStart(2, '0')}`;
});

const selectedTime = computed(() => {
  return `${String(parsed.value.hour).padStart(2, '0')}:${String(parsed.value.minute).padStart(2, '0')}`;
});

function buildIso(parts) {
  const local = new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    0,
    0
  );
  emit('update:modelValue', local.toISOString());
}

function onDateChange(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return;
  }

  const [year, month, day] = value.split('-').map(Number);
  buildIso({
    year,
    month,
    day,
    hour: parsed.value.hour,
    minute: parsed.value.minute
  });
}

function onTimeChange(value) {
  const trimmed = String(value).trim();
  if (trimmed.length === 0) {
    return;
  }

  const normalized = /^\d{1,2}:\d{2}$/.test(trimmed)
    ? trimmed
        .split(':')
        .map((part, idx) => (idx === 0 ? part.padStart(2, '0') : part))
        .join(':')
    : trimmed;

  if (!/^\d{2}:\d{2}$/.test(normalized)) {
    return;
  }

  const [hour, minute] = normalized.split(':').map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return;
  }

  buildIso({
    year: parsed.value.year,
    month: parsed.value.month,
    day: parsed.value.day,
    hour,
    minute
  });
}
</script>

<template>
  <div class="grid gap-2 sm:grid-cols-[1fr_170px]">
    <DatePicker :model-value="selectedDateYmd" @update:model-value="onDateChange" />
    <Input
      type="text"
      inputmode="numeric"
      maxlength="5"
      placeholder="HH:MM"
      :model-value="selectedTime"
      @update:model-value="onTimeChange"
    />
  </div>
</template>
