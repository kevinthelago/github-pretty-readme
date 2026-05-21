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
import monkeytype             from './api/monkeytype.js';
import applyReadme            from './api/apply-readme.js';
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

// Auth
app.get('/auth/github',   authGithub);
app.get('/auth/callback', authCallback);
app.get('/auth/logout',   authLogout);
app.get('/auth/me',       authMe);

// Profile update
app.get('/apply-readme', requireAuth, applyReadme);

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
app.get('/monkeytype',               monkeytype);

app.listen(process.env.PORT || process.env.port || 8080);
