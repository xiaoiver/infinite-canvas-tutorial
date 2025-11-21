<script lang="ts" setup>
import { motion } from "motion-v";
const { color, x, y } = defineProps<{
    color: string;
    x: number;
    y: number;
    name: string;
}>();
</script>

<template>
    <motion.div class="Cursor" aria-hidden="true" :initial="{ x: x, y: y }" :animate="{ x: x, y: y }" :transition="{
        type: 'spring',
        damping: 20,
        mass: 0.4,
        stiffness: 400,
    }">
        <svg :style="{ width: 'auto', height: '16px' }" fill="none" viewBox="0 0 23 22"
            xmlns="http://www.w3.org/2000/svg">
            <path :style="{ fill: color }"
                d="M1.24177 0.0522243L21.6392 7.0936H21.667C21.8429 7.15694 21.9944 7.26959 22.1012 7.41658C22.2081 7.56357 22.2653 7.73795 22.2653 7.91656C22.2653 8.09516 22.2081 8.26954 22.1012 8.41653C21.9944 8.56353 21.8429 8.67618 21.667 8.73952L12.7663 12.1194L9.20604 20.569C9.13733 20.7328 9.01841 20.8732 8.86467 20.9721C8.71094 21.0709 8.52947 21.1237 8.34378 21.1235C8.15324 21.1235 7.96735 21.0676 7.8114 20.9637C7.65546 20.8598 7.53704 20.7127 7.47225 20.5426L0.055012 1.17884C-0.00472376 1.02164 -0.016082 0.851545 0.0222651 0.688441C0.0606122 0.525336 0.14708 0.375966 0.271558 0.257796C0.396035 0.139626 0.553379 0.0575406 0.72519 0.0211368C0.897001 -0.0152671 1.07618 -0.00448438 1.24177 0.0522243Z" />
        </svg>
        <span :style="{
            backgroundColor: color,
        }">
            {{ name }}
        </span>
    </motion.div>
</template>

<style scoped>
.Cursor {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    user-select: none;
    pointer-events: none;
    z-index: 2;
}

.Cursor>svg {
    height: 16px;
    width: auto;
}

.Cursor>svg path {
    box-shadow: var(--shadow);
}

.Cursor>span {
    box-shadow: var(--shadow);
    margin-left: -2px;
    margin-top: 14px;
    border-radius: 4px;
    padding: 0 8px;
    font-size: 14px;
    font-weight: 500;
    height: 28px;
    display: inline-flex;
    align-items: center;
}
</style>