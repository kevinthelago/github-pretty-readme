import { THEME_CSS } from './theme.js';

const H = 64;                 // tile height (single row)
const PILL_H = 40;            // pill height
const PILL_Y = (H - PILL_H) / 2;
const PAD_X = 20;             // outer horizontal padding
const PILL_GAP = 12;          // gap between pills
const ICON = 18;              // rendered icon size (simple-icons paths are 24×24)
const ICON_SCALE = ICON / 24;
const PAD_L = 14;             // pill inner left padding (before icon)
const PAD_R = 16;             // pill inner right padding (after label)
const ICON_GAP = 8;          // gap between icon and label
const LABEL_SIZE = 13;
const CHAR_W = 7.3;          // approx advance width for one LABEL_SIZE char (Arial)

/**
 * Generic "link" glyph (24×24) used when a platform has no matching brand icon,
 * so unknown platforms still render a recognisable badge instead of breaking.
 */
const LINK_PATH =
    'M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7h-4a5 5 0 0 0 0 10h4v-1.9h-4A3.1 3.1 0 0 1 3.9 12zm5.1 1h6v-2H9v2zm4-6v1.9h4A3.1 3.1 0 0 1 17 13.1h-4V15h4a5 5 0 0 0 0-10h-4z';

const escapeXml = (s) =>
    String(s).replace(/[<>&"']/g, (c) =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

const estLabelWidth = (label) => Math.ceil(label.length * CHAR_W);

const pillWidth = (badge) => PAD_L + ICON + ICON_GAP + estLabelWidth(badge.label) + PAD_R;

/**
 * Renders a single horizontal row of social/links badges as an SVG string.
 *
 * Each badge is a brand-tinted pill carrying the platform's simple-icons glyph
 * and a label. Platforms without a known brand icon fall back to a neutral
 * "link" glyph so they degrade gracefully rather than disappearing.
 *
 * @param {Array<{ key:string, label:string, url?:string, icon?:({path:string,hex:string}|null), hex?:(string|null) }>} badges
 * @returns {string} a complete `<svg>` document, theme-aware via THEME_CSS.
 */
export const renderSocialLinks = (badges) => {
    const list = Array.isArray(badges) ? badges : [];

    if (list.length === 0) {
        const W = 280;
        return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    ${THEME_CSS}
    <rect width="${W}" height="${H}" rx="12" style="fill:var(--bg2)"/>
    <text x="${W / 2}" y="${H / 2 + 4}" text-anchor="middle" style="fill:var(--fg40)" font-size="13" font-family="Arial, sans-serif">No social links configured</text>
</svg>`;
    }

    // Lay out pills left-to-right, tracking the running x cursor.
    let x = PAD_X;
    const pills = list.map((badge) => {
        const w = pillWidth(badge);
        const hex = badge.icon?.hex ?? badge.hex ?? null;
        const iconColor = hex ? `#${hex}` : null;
        const iconPath = badge.icon?.path ?? LINK_PATH;

        const iconX = x + PAD_L;
        const iconY = (H - ICON) / 2;
        const labelX = iconX + ICON + ICON_GAP;

        // Brand-tinted pill; neutral when no brand colour is known.
        const fill = iconColor
            ? `fill="${iconColor}" fill-opacity="0.12"`
            : `style="fill:var(--fg06)"`;
        const stroke = iconColor
            ? `stroke="${iconColor}" stroke-opacity="0.30"`
            : `style="stroke:var(--fg15)"`;
        const iconFill = iconColor ? `fill="${iconColor}"` : `style="fill:var(--fg60)"`;

        const pill = `
    <a${badge.url ? ` href="${escapeXml(badge.url)}" target="_blank" rel="noopener"` : ''}>
        <rect x="${x}" y="${PILL_Y}" width="${w}" height="${PILL_H}" rx="${PILL_H / 2}" ${fill} ${stroke} stroke-width="1"/>
        <path d="${iconPath}" transform="translate(${iconX}, ${iconY}) scale(${ICON_SCALE})" ${iconFill}/>
        <text x="${labelX}" y="${H / 2 + 4}" style="fill:var(--fg)" font-size="${LABEL_SIZE}" font-weight="500" font-family="Arial, sans-serif">${escapeXml(badge.label)}</text>
    </a>`;

        x += w + PILL_GAP;
        return pill;
    });

    const W = x - PILL_GAP + PAD_X; // last gap was added speculatively; trim it

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">
    ${THEME_CSS}
    ${pills.join('')}
</svg>`;
};

export default renderSocialLinks;
