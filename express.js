import { routes }             from './api/_routes.js';
import { requireAuth }         from './api/auth.js';
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

// Auto-mount every endpoint declared in api/_routes.js. New endpoints are added
// there as data — this loop, and the rest of express.js, never change per feature.
for (const { method, path, handler, auth } of routes) {
    const middleware = auth ? [requireAuth] : [];
    app[method](path, ...middleware, handler);
}

app.listen(process.env.PORT || process.env.port || 8088);
