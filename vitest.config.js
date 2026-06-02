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
            //
            // NOTE on `branches`: vitest 4 / @vitest/coverage-v8 4 replaced v8's
            // inflated native branch counting with accurate AST-aware remapping, so
            // measured branch coverage dropped (~75% under v3 → ~48% under v4) with
            // no change to the code. The floor below is recalibrated to the v4
            // measurement, not a relaxation of the actual bar.
            thresholds: {
                lines: 55,
                branches: 45,
                functions: 60,
                statements: 55,
            },
        },
    },
});
