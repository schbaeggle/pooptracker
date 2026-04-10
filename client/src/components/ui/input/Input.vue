<template>
  <input
    v-bind="$attrs"
    :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)"
    :class="cn('flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', className)"
  />
</template>

<script setup>
import { cn } from '@/lib/utils';

defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  className: {
    type: String,
    default: ''
  }
});

defineEmits(['update:modelValue']);
</script>
