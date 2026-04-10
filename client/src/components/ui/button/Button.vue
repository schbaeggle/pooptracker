<template>
  <button v-bind="$attrs" :class="cn(buttonVariants({ variant, size }), className)">
    <slot />
  </button>
</template>

<script setup>
import { cn } from '@/lib/utils';
import { buttonVariants } from './buttonVariants';

defineProps({
  variant: {
    type: String,
    default: 'default'
  },
  size: {
    type: String,
    default: 'default'
  },
  className: {
    type: String,
    default: ''
  }
});
</script>
