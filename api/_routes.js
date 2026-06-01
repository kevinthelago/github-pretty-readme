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
 *     method:  'get' | 'put' | 'post',   // HTTP verb (lowercase Express method)
 *     path:    string,                    // mount path, e.g. '/account-summary'
 *     handler: (req, res) => any,         // the route handler
 *     auth?:   boolean,                   // when true, gate behind requireAuth
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
import applyReadme                from './apply-readme.js';
import previewReadme              from './preview-readme.js';
import contributionGraph          from './contribution-graph.js';
import statsCard                  from './stats-card.js';
import repositoryReadme           from './repository-readme.js';
import { getConfig, putConfig }                          from './config.js';
import { authGithub, authCallback, authLogout, authMe }  from './auth.js';
import { monkeytypeConnect, monkeytypeDisconnect }       from './monkeytype-connect.js';

/** @type {Array<{ method: 'get'|'put'|'post', path: string, handler: Function, auth?: boolean }>} */
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

    // Monkeytype session connect/disconnect
    { method: 'post', path: '/monkeytype/connect',    handler: monkeytypeConnect },
    { method: 'post', path: '/monkeytype/disconnect', handler: monkeytypeDisconnect },

    // SVG / data endpoints
    { method: 'get', path: '/account-summary',           handler: accountSummary },
    { method: 'get', path: '/account-summary-md',        handler: accountSummaryMd },
    { method: 'get', path: '/developer-rating',          handler: developerRating },
    { method: 'get', path: '/developer-rating-insights', handler: developerRatingInsights },
    { method: 'get', path: '/tech-summary',              handler: techSummary },
    { method: 'get', path: '/tech-list',                 handler: techList },
    { method: 'get', path: '/tech-chart',                handler: techChart },
    { method: 'get', path: '/tech-spider',               handler: techSpider },
    { method: 'get', path: '/tech-categories',           handler: techCategories },
    { method: 'get', path: '/improve-topics',            handler: improveTopics },
    { method: 'get', path: '/improve-descriptions',      handler: improveDescriptions },
    { method: 'get', path: '/repo-scan',  handler: repoScan,  auth: true },
    { method: 'get', path: '/repos',      handler: repos,     auth: true },
    { method: 'get', path: '/repo-apply', handler: repoApply, auth: true },
    { method: 'get', path: '/apply-all',  handler: applyAll,  auth: true },
    { method: 'get', path: '/monkeytype', handler: monkeytype },
    { method: 'get', path: '/repository-readme', handler: repositoryReadme, auth: true },

    // account-graph stream (#38, #39)
    { method: 'get', path: '/contribution-graph', handler: contributionGraph },
    { method: 'get', path: '/stats-card',         handler: statsCard },
];

export default routes;
