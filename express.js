import accountSummary        from './api/account-summary.js';
import accountSummaryMd      from './api/account-summary-md.js';
import developerRating        from './api/developer-rating.js';
import developerRatingInsights from './api/developer-rating-insights.js';
import techSummary            from './api/tech-summary.js';
import techList               from './api/tech-list.js';
import techChart              from './api/tech-chart.js';
import techSpider             from './api/tech-spider.js';
import techCategories         from './api/tech-categories.js';
import improveTopics          from './api/improve-topics.js';
import improveDescriptions    from './api/improve-descriptions.js';
import repoScan               from './api/repo-scan.js';
import repos                  from './api/repos.js';
import repoApply              from './api/repo-apply.js';
import applyAll               from './api/apply-all.js';
import monkeytype             from './api/monkeytype.js';
import applyReadme            from './api/apply-readme.js';
import previewReadme          from './api/preview-readme.js';
import contributionGraph       from './api/contribution-graph.js';
import statsCard               from './api/stats-card.js';
import repositoryReadme       from './api/repository-readme.js';
import { getConfig, putConfig }                                      from './api/config.js';
import { authGithub, authCallback, authLogout, authMe, requireAuth } from './api/auth.js';
import { monkeytypeConnect, monkeytypeDisconnect }                   from './api/monkeytype-connect.js';
import express                from 'express';
import cookieSession          from 'cookie-session';
import { fileURLToPath }      from 'url';
import { dirname, join }      from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieSession({
    name:    'session',
    keys:    [process.env.SESSION_SECRET ?? 'dev-secret-change-in-production'],
    maxAge:  7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure:  process.env.NODE_ENV === 'production',
    sameSite: 'lax',
}));

app.use(express.static(join(__dirname, 'public')));

// Allowlist config
app.get('/config',  requireAuth, getConfig);
app.put('/config',  requireAuth, putConfig);

// Auth
app.get('/auth/github',   authGithub);
app.get('/auth/callback', authCallback);
app.get('/auth/logout',   authLogout);
app.get('/auth/me',       authMe);

// Profile preview (generates + caches all assets) and apply
app.get('/preview-readme', requireAuth, previewReadme);
app.get('/apply-readme',   requireAuth, applyReadme);

// Monkeytype session connect/disconnect
app.post('/monkeytype/connect',    monkeytypeConnect);
app.post('/monkeytype/disconnect', monkeytypeDisconnect);

// SVG / data endpoints
app.get('/account-summary',          accountSummary);
app.get('/account-summary-md',       accountSummaryMd);
app.get('/developer-rating',         developerRating);
app.get('/developer-rating-insights', developerRatingInsights);
app.get('/tech-summary',             techSummary);
app.get('/tech-list',                techList);
app.get('/tech-chart',               techChart);
app.get('/tech-spider',              techSpider);
app.get('/tech-categories',          techCategories);
app.get('/improve-topics',           improveTopics);
app.get('/improve-descriptions',     improveDescriptions);
app.get('/repo-scan',                requireAuth, repoScan);
app.get('/repos',                    requireAuth, repos);
app.get('/repo-apply',               requireAuth, repoApply);
app.get('/apply-all',                requireAuth, applyAll);
app.get('/monkeytype',               monkeytype);
app.get('/repository-readme',        requireAuth, repositoryReadme);

// account-graph stream (#38, #39) — manual append pending #52 auto-registration
app.get('/contribution-graph',       contributionGraph);
app.get('/stats-card',               statsCard);

app.listen(process.env.PORT || process.env.port || 8088);
