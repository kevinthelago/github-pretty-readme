import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                process:   'readonly',
                console:   'readonly',
                Buffer:    'readonly',
                fetch:     'readonly',
                URL:       'readonly',
                URLSearchParams: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                atob: 'readonly',
                btoa: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-undef': 'error',
        },
    },
    {
        ignores: ['node_modules/', 'public/', 'preview/', 'design/', 'test-pipeline.mjs'],
    },
];
