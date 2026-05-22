import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/tests/**/*.test.js'],
        environment: 'node',
        coverage: {
            provider: 'v8',
            include: ['src/**/*.js', 'api/**/*.js'],
            exclude: ['src/tests/**'],
            reporter: ['text', 'lcov'],
        },
    },
});
