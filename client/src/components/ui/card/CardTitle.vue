<template>
  <h3 :class="cn('text-lg font-semibold leading-none tracking-tight', className)">
    <slot />
  </h3>
</template>

<script setup>
import { cn } from '@/lib/utils';

defineProps({
  className: {
    type: String,
    default: ''
  }
});
</script>
