import { generateProfile } from './apply-readme.js';
import { previewCache }    from '../src/preview-cache.js';
import { requireCredentials, sendJsonError, boolParam } from './_shared.js';

/**
 * GET /preview-readme
 *
 * Generates (or returns cached) the full profile preview:
 * bio, all SVGs, and the insights markdown.
 *
 * Query params:
 *   refresh   Set to "true" to bypass cache and regenerate
 */
export default async (req, res) => {
    const creds = requireCredentials(req, res);
    if (!creds) return;
    const { token, username } = creds;

    const refresh = boolParam(req.query.refresh);

    if (!refresh) {
        const cached = previewCache.get(username);
        if (cached) {
            return res.json({
                ok:            true,
                cached:        true,
                bio:           cached.bio,
                ratingSvg:     cached.ratingSvg,
                techGridSvg:   cached.techGridSvg,
                monkeytypeSvg: cached.monkeytypeSvg,
                accountTiles:  cached.accountTiles ?? {},
                insightsMd:    cached.insightsMd,
            });
        }
    }

    try {
        const monkeyOptions = {
            apiKey:   req.session.monkeytype_key   ?? null,
            username: req.session.monkeytype_username ?? null,
        };
        const extraOptions = {
            wakatimeKey: req.session.wakatime_key ?? process.env.WAKATIME_API_KEY ?? null,
        };
        const profile = await generateProfile(token, username, monkeyOptions, null, extraOptions);
        previewCache.set(username, profile);
        return res.json({
            ok:            true,
            cached:        false,
            bio:           profile.bio,
            ratingSvg:     profile.ratingSvg,
            techGridSvg:   profile.techGridSvg,
            monkeytypeSvg: profile.monkeytypeSvg,
            accountTiles:  profile.accountTiles ?? {},
            insightsMd:    profile.insightsMd,
        });
    } catch (err) {
        console.error('[preview-readme]', err.message);
        return sendJsonError(res, 500, 'internal_error', err.message);
    }
};
