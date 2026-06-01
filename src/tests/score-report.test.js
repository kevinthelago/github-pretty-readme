import { describe, test, expect } from 'vitest';
import { scoreBadgeMd, generateScoreReport } from '../markdown/score-report.js';

const dim = (score, grade, over = {}) => ({ score, grade, evidence: ['ev'], missing: [], ...over });

const analysis = (over = {}) => ({
    meta: { owner: 'u', name: 'r', language: 'JavaScript', license: 'MIT' },
    codeQuality: {
        overall: 72,
        grade: 'B',
        testing: dim(60, 'C', { missing: ['No coverage'] }),
        documentation: dim(75, 'B'),
        tooling: dim(80, 'A'),
        ci: dim(85, 'A'),
        security: dim(60, 'C'),
        structure: dim(70, 'B'),
        ...over.codeQuality,
    },
    suggestions: ['Add coverage'],
    techStack: ['JavaScript', 'Node.js'],
    ...over,
});

describe('scoreBadgeMd', () => {
    test('builds a shields.io badge linking to SCORE.md', () => {
        const md = scoreBadgeMd(analysis());
        expect(md).toContain('img.shields.io/badge/code_quality-');
        expect(md).toContain('72%2F100'); // 72/100, slash encoded
        expect(md).toContain('](SCORE.md)');
        expect(md).toContain('-blue?'); // grade B → blue
    });

    test('encodes the "+" in an A+ grade as %2B', () => {
        const md = scoreBadgeMd(analysis({ codeQuality: { overall: 95, grade: 'A+' } }));
        expect(md).toContain('A%2B');
        expect(md).toContain('-brightgreen?');
        expect(md).not.toMatch(/badge\/code_quality-A\+/);
    });

    test('falls back to lightgrey for an unknown grade', () => {
        const md = scoreBadgeMd(analysis({ codeQuality: { overall: 0, grade: '?' } }));
        expect(md).toContain('-lightgrey?');
    });
});

describe('generateScoreReport edge cases', () => {
    test('renders an em dash for a missing dimension', () => {
        const a = analysis();
        a.codeQuality.security = undefined;
        const md = generateScoreReport('r', a);
        expect(md).toContain('| Security | —/100 | — |');
        // a null dimension contributes no section heading
        expect(md).not.toContain('## Security —');
    });

    test('renders notes as a blockquote when present', () => {
        const a = analysis();
        a.codeQuality.testing = dim(60, 'C', { notes: 'flaky suite' });
        const md = generateScoreReport('r', a);
        expect(md).toContain('> flaky suite');
    });

    test('draws a progress bar of ten cells for the overall score', () => {
        const md = generateScoreReport('r', analysis({ codeQuality: { overall: 50, grade: 'B' } }));
        expect(md).toContain('`█████░░░░░`'); // round(50/10)=5 filled, 5 empty
    });

    test('omits the suggestions section when there are none', () => {
        const md = generateScoreReport('r', analysis({ suggestions: [] }));
        expect(md).not.toContain('## Suggestions');
    });
});
