import { renderSocialLinks } from '../src/tiles/social-links.js';
import { readConfig } from '../src/github/config.js';
import * as simpleIcons from 'simple-icons';

/**
 * Known social platforms → how to label, find a brand icon, and build a profile
 * URL from a bare handle. `slug` is the simple-icons export name; a missing or
 * unknown slug degrades to the renderer's generic link glyph. `url` receives the
 * raw handle and returns a full URL (handles already-absolute URLs upstream).
 */
const PLATFORMS = {
    github:        { label: 'GitHub',        slug: 'siGithub',        url: h => `https://github.com/${h}` },
    twitter:       { label: 'X',             slug: 'siX',             url: h => `https://x.com/${h}` },
    x:             { label: 'X',             slug: 'siX',             url: h => `https://x.com/${h}` },
    linkedin:      { label: 'LinkedIn',      slug: 'siLinkedin',      url: h => `https://www.linkedin.com/in/${h}` },
    devto:         { label: 'DEV',           slug: 'siDevdotto',      url: h => `https://dev.to/${h}` },
    dev:           { label: 'DEV',           slug: 'siDevdotto',      url: h => `https://dev.to/${h}` },
    mastodon:      { label: 'Mastodon',      slug: 'siMastodon',      url: h => mastodonUrl(h) },
    youtube:       { label: 'YouTube',       slug: 'siYoutube',       url: h => `https://youtube.com/@${h}` },
    instagram:     { label: 'Instagram',     slug: 'siInstagram',     url: h => `https://instagram.com/${h}` },
    twitch:        { label: 'Twitch',        slug: 'siTwitch',        url: h => `https://twitch.tv/${h}` },
    discord:       { label: 'Discord',       slug: 'siDiscord',       url: h => `https://discord.com/users/${h}` },
    stackoverflow: { label: 'Stack Overflow', slug: 'siStackoverflow', url: h => `https://stackoverflow.com/users/${h}` },
    medium:        { label: 'Medium',        slug: 'siMedium',        url: h => `https://medium.com/@${h}` },
    reddit:        { label: 'Reddit',        slug: 'siReddit',        url: h => `https://reddit.com/user/${h}` },
    gitlab:        { label: 'GitLab',        slug: 'siGitlab',        url: h => `https://gitlab.com/${h}` },
    bluesky:       { label: 'Bluesky',       slug: 'siBluesky',       url: h => `https://bsky.app/profile/${h}` },
    telegram:      { label: 'Telegram',      slug: 'siTelegram',      url: h => `https://t.me/${h}` },
    facebook:      { label: 'Facebook',      slug: 'siFacebook',      url: h => `https://facebook.com/${h}` },
    dribbble:      { label: 'Dribbble',      slug: 'siDribbble',      url: h => `https://dribbble.com/${h}` },
    behance:       { label: 'Behance',       slug: 'siBehance',       url: h => `https://behance.net/${h}` },
    email:         { label: 'Email',         slug: null,              url: h => `mailto:${h}` },
    mail:          { label: 'Email',         slug: null,              url: h => `mailto:${h}` },
    website:       { label: 'Website',       slug: null,              url: h => h },
    web:           { label: 'Website',       slug: null,              url: h => h },
    blog:          { label: 'Blog',          slug: null,              url: h => h },
};

/** Mastodon handles look like `@user@instance.tld`; turn them into a profile URL. */
const mastodonUrl = (handle) => {
    const m = handle.replace(/^@/, '').match(/^([^@]+)@(.+)$/);
    return m ? `https://${m[2]}/@${m[1]}` : `https://mastodon.social/@${handle.replace(/^@/, '')}`;
};

const isAbsoluteUrl = (s) => /^https?:\/\//i.test(s) || /^mailto:/i.test(s);

/**
 * Turns one `platform → handle` pair into a renderable badge. Falls back to a
 * generic link badge (no brand icon) when the platform is unknown.
 */
const toBadge = (platformKey, rawHandle) => {
    const key = String(platformKey).trim().toLowerCase();
    const handle = String(rawHandle).trim();
    if (!handle) return null;

    const def = PLATFORMS[key];
    const icon = def?.slug ? (simpleIcons[def.slug] ?? null) : null;
    const url = isAbsoluteUrl(handle) ? handle : (def ? def.url(handle) : handle);
    const label = def?.label ?? key.charAt(0).toUpperCase() + key.slice(1);

    return { key, label, url, icon, hex: icon ? icon.hex : null };
};

/**
 * Parses the `?links=` query value: a comma-separated list of `platform:handle`
 * pairs, e.g. `github:octocat,twitter:foo,email:me@example.com`. The handle may
 * itself contain colons (full URLs) — only the first colon is treated as the
 * separator.
 */
const parseLinksParam = (value) =>
    value
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(pair => {
            const i = pair.indexOf(':');
            if (i === -1) return null;
            return toBadge(pair.slice(0, i), pair.slice(i + 1));
        })
        .filter(Boolean);

/** Converts a `.pretty-readme.json` `social` object into badges. */
const badgesFromConfig = (social) =>
    Object.entries(social ?? {})
        .map(([platform, handle]) => toBadge(platform, handle))
        .filter(Boolean);

/**
 * GET /social-links
 *
 * Renders a row of brand badges linking to the user's social profiles. Links are
 * sourced (in order) from the `?links=` query param, or the `social` map in the
 * user's `.pretty-readme.json` when the request is authenticated. Unknown
 * platforms degrade to a generic link badge.
 *
 * Query: ?links=github:octocat,twitter:foo  (overrides config when present)
 */
export default async (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');

    try {
        let badges = [];

        if (req.query.links) {
            badges = parseLinksParam(req.query.links);
        } else {
            const token    = req.session?.github_token ?? process.env.GITHUB_TOKEN;
            const username = req.session?.github_username ?? req.query.username;
            if (token && username) {
                const result = await readConfig(token, username);
                badges = badgesFromConfig(result?.config?.social);
            }
        }

        return res.send(renderSocialLinks(badges));
    } catch (err) {
        return res.status(500).send(err.message);
    }
};

/**
 * Route descriptor consumed by the auto-registration layer (#52). Public route —
 * the handler reads the session when present but does not require auth.
 */
export const route = { method: 'get', path: '/social-links', auth: false };
