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
            // Conservative FLOOR (not an aspirational bar): set just below current
            // coverage and rounded down so a single in-flight refactor PR can't
            // stall the fleet. Ratchet these up once all streams have landed.
            // `npm run test:coverage` exits non-zero below any of these, failing CI.
            thresholds: {
                lines: 55,
                branches: 75,
                functions: 60,
                statements: 55,
            },
        },
    },
});
