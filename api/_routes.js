/**
 * Declarative route manifest.
 *
 * Every HTTP endpoint the service exposes is listed here as a plain descriptor;
 * `express.js` loops over this array and mounts each one. Adding, removing, or
 * re-pathing an endpoint is a single edit in this file — `express.js` never
 * changes per feature, which keeps it from being a shared merge hotspot.
 *
 * Descriptor shape:
 *   {
 *     method:     'get' | 'put' | 'post', // HTTP verb (lowercase Express method)
 *     path:       string,                  // mount path, e.g. '/account-summary'
 *     handler:    (req, res) => any,       // the route handler
 *     auth?:      boolean,                 // when true, gate behind requireAuth
 *     rateLimit?: boolean,                 // when true, throttle anonymous traffic
 *                                          // via the shared limiter (#64);
 *                                          // authenticated sessions self-exempt
 *   }
 *
 * Note: `api/tech-cards.js` and `api/tech-treemap.js` are intentionally absent —
 * they are sub-renderers reached through `/tech-spider?type=cards|treemap`, not
 * standalone routes.
 */
import accountSummary             from './account-summary.js';
import accountSummaryMd           from './account-summary-md.js';
import developerRating            from './developer-rating.js';
import developerRatingInsights    from './developer-rating-insights.js';
import techSummary                from './tech-summary.js';
import techList                   from './tech-list.js';
import techChart                  from './tech-chart.js';
import techSpider                 from './tech-spider.js';
import techCategories            from './tech-categories.js';
import improveTopics              from './improve-topics.js';
import improveDescriptions        from './improve-descriptions.js';
import repoScan                   from './repo-scan.js';
import repos                      from './repos.js';
import repoApply                  from './repo-apply.js';
import applyAll                   from './apply-all.js';
import monkeytype                 from './monkeytype.js';
import wakatime                   from './wakatime.js';
import applyReadme                from './apply-readme.js';
import previewReadme              from './preview-readme.js';
import contributionGraph          from './contribution-graph.js';
import statsCard                  from './stats-card.js';
import repositoryReadme           from './repository-readme.js';
import healthz                    from './healthz.js';
import { getConfig, putConfig }                          from './config.js';
import { authGithub, authCallback, authLogout, authMe }  from './auth.js';
import { monkeytypeConnect, monkeytypeDisconnect }       from './monkeytype-connect.js';
import { wakatimeConnect, wakatimeDisconnect }           from './wakatime-connect.js';
import { createToken, getTokens, deleteToken }           from './tokens.js';

/** @type {Array<{ method: 'get'|'put'|'post', path: string, handler: Function, auth?: boolean, rateLimit?: boolean }>} */
export const routes = [
    // Allowlist config (session-gated)
    { method: 'get', path: '/config', handler: getConfig, auth: true },
    { method: 'put', path: '/config', handler: putConfig, auth: true },

    // OAuth
    { method: 'get', path: '/auth/github',   handler: authGithub },
    { method: 'get', path: '/auth/callback', handler: authCallback },
    { method: 'get', path: '/auth/logout',   handler: authLogout },
    { method: 'get', path: '/auth/me',       handler: authMe },

    // Profile preview (generates + caches all assets) and apply
    { method: 'get', path: '/preview-readme', handler: previewReadme, auth: true },
    { method: 'get', path: '/apply-readme',   handler: applyReadme,   auth: true },

    // API tokens (auth) — mint/list/revoke long-lived tokens for headless automation (#58)
    { method: 'post',   path: '/tokens',     handler: createToken, auth: true },
    { method: 'get',    path: '/tokens',     handler: getTokens,   auth: true },
    { method: 'delete', path: '/tokens/:id', handler: deleteToken, auth: true },

    // Monkeytype session connect/disconnect
    { method: 'post', path: '/monkeytype/connect',    handler: monkeytypeConnect },
    { method: 'post', path: '/monkeytype/disconnect', handler: monkeytypeDisconnect },

    // WakaTime session connect/disconnect (#68)
    { method: 'post', path: '/wakatime/connect',    handler: wakatimeConnect },
    { method: 'post', path: '/wakatime/disconnect', handler: wakatimeDisconnect },

    // Public SVG / data endpoints — anonymous traffic is rate-limited (#64);
    // authenticated sessions self-exempt inside the limiter.
    { method: 'get', path: '/account-summary',           handler: accountSummary,         rateLimit: true },
    { method: 'get', path: '/account-summary-md',        handler: accountSummaryMd,       rateLimit: true },
    { method: 'get', path: '/developer-rating',          handler: developerRating,        rateLimit: true },
    { method: 'get', path: '/developer-rating-insights', handler: developerRatingInsights, rateLimit: true },
    { method: 'get', path: '/tech-summary',              handler: techSummary,            rateLimit: true },
    { method: 'get', path: '/tech-list',                 handler: techList,               rateLimit: true },
    { method: 'get', path: '/tech-chart',                handler: techChart,              rateLimit: true },
    { method: 'get', path: '/tech-spider',               handler: techSpider,             rateLimit: true },
    { method: 'get', path: '/tech-categories',           handler: techCategories,         rateLimit: true },
    { method: 'get', path: '/improve-topics',            handler: improveTopics,          rateLimit: true },
    { method: 'get', path: '/improve-descriptions',      handler: improveDescriptions,    rateLimit: true },
    { method: 'get', path: '/monkeytype', handler: monkeytype, rateLimit: true },
    { method: 'get', path: '/wakatime',   handler: wakatime,   rateLimit: true },

    // Auth-gated data endpoints (requireAuth runs first; authed sessions are
    // exempt from the limiter, so these need no rateLimit flag).
    { method: 'get', path: '/repo-scan',  handler: repoScan,  auth: true },
    { method: 'get', path: '/repos',      handler: repos,     auth: true },
    { method: 'get', path: '/repo-apply', handler: repoApply, auth: true },
    { method: 'get', path: '/apply-all',  handler: applyAll,  auth: true },
    { method: 'get', path: '/repository-readme', handler: repositoryReadme, auth: true },

    // account-graph stream (#38, #39)
    { method: 'get', path: '/contribution-graph', handler: contributionGraph, rateLimit: true },
    { method: 'get', path: '/stats-card',         handler: statsCard,         rateLimit: true },

    // Health probe (#63) — unauthenticated, dependency-free; the limiter exempts
    // /healthz by path, so it is never throttled.
    { method: 'get', path: '/healthz', handler: healthz },
];

export default routes;
