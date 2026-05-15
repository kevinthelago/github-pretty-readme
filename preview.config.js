/**
 * Edit this file to control which tiles are generated during local preview.
 * Run:  npm run preview
 *
 * Each entry in `tiles` maps to one SVG saved to the preview/ directory.
 * Tweak the `url` query params freely — the script restarts the server fresh each time.
 */
export default {
    port: 8080,

    tiles: [
        {
            name: 'account-summary',
            url: '/account-summary?username=kevinthelago&background=cherry-blossom',
        },
        {
            name: 'tech-spider',
            url: '/tech-spider?type=spider&categories=languages,frameworks,cloud&limit=6',
        },
        {
            name: 'tech-treemap',
            url: '/tech-spider?type=treemap&categories=languages,frameworks,cloud&limit=8',
        },
        {
            name: 'tech-cards',
            url: '/tech-spider?type=cards&categories=languages,frameworks,cloud,ai,databases,devops&limit=12',
        },
    ],
};
