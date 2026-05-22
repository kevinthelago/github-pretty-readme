// ── Theme toggle ──────────────────────────────────────────────────────────────
let _theme = 'system';
document.getElementById('theme-toggle').addEventListener('click', () => {
    const order = ['light', 'system', 'dark'];
    _theme = order[(order.indexOf(_theme) + 1) % order.length];
    if (_theme === 'system') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', _theme);
    }
    document.getElementById('theme-toggle').dataset.mode = _theme;
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const svgDataUri = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const renderMd   = (md)  => typeof marked !== 'undefined'
    ? marked.parse(md)
    : '<pre style="white-space:pre-wrap;font-size:13px">' + md.replace(/</g, '&lt;') + '</pre>';

const gradeColor = (score) => {
    if (score >= 80) return '#3fb950';
    if (score >= 65) return '#58a6ff';
    if (score >= 50) return '#d2a22a';
    return '#f85149';
};

// ── Tab switching ─────────────────────────────────────────────────────────────
const activateTab = (tabId) => {
    document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.preview-tab-content').forEach(c => c.classList.remove('active'));
    const btn     = document.querySelector(`.preview-tab[data-tab="${tabId}"]`);
    const content = document.getElementById(`preview-tab-${tabId}`);
    if (btn)     btn.classList.add('active');
    if (content) content.classList.add('active');
};

document.querySelectorAll('.preview-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        activateTab(tab.dataset.tab);
        const u = window._authUser;
        if (!u) return;
        const repo  = window._selectedRepo;
        const urlEl = document.getElementById('preview-url');
        if (repo) {
            urlEl.textContent = `github.com/${u}/${repo}/blob/main/SCORE.md`;
        } else {
            urlEl.textContent = tab.dataset.tab === 'insights'
                ? `github.com/${u}/${u}/blob/main/DEVELOPER_INSIGHTS.md`
                : `github.com/${u}/${u}`;
        }
    });
});

// ── Unauthenticated demo ──────────────────────────────────────────────────────
const demoRatingImg = document.getElementById('preview-rating-demo');
const demoRatingPh  = document.getElementById('preview-rating-ph-demo');
demoRatingImg.onload  = () => { demoRatingPh.style.display = 'none'; demoRatingImg.style.display = 'block'; };
demoRatingImg.onerror = () => { demoRatingPh.textContent = 'Preview unavailable'; };

const demoTechImg = document.getElementById('preview-tech-demo');
const demoTechPh  = document.getElementById('preview-tech-ph-demo');
fetch('/tech-categories?limit=8').then(r => r.json()).then(cats => {
    const chartable = cats.filter(c => c.count >= 3);
    if (!chartable.length) { demoTechPh.textContent = 'No tech data'; return; }
    const cols = chartable.length <= 3 ? chartable.length : Math.ceil(Math.sqrt(chartable.length));
    demoTechImg.src = `/tech-spider?type=grid&categories=${chartable.map(c => c.category).join(',')}&limit=8&columns=${cols}`;
    demoTechImg.onload  = () => { demoTechPh.style.display = 'none'; demoTechImg.style.display = 'block'; };
    demoTechImg.onerror = () => { demoTechPh.textContent = 'Tech stack unavailable'; };
}).catch(() => { demoTechPh.textContent = 'Could not load tech data'; });

fetch('/account-summary-md').then(r => r.ok ? r.text() : null).then(text => {
    if (!text) return;
    const el = document.getElementById('preview-bio-demo');
    el.textContent = text; el.style.color = el.style.fontStyle = '';
}).catch(() => {});

fetch('/tech-list?sort=frequency').then(r => r.json()).then(techs => {
    const el = document.getElementById('preview-badges-demo');
    if (!techs.length) return;
    el.innerHTML = techs.slice(0, 16).map(t => {
        const label = encodeURIComponent(t.language);
        const src   = t.slug && t.hex
            ? `https://img.shields.io/badge/${label}-${t.hex}?style=flat&logo=${t.slug}&logoColor=white`
            : `https://img.shields.io/badge/${label}-555555?style=flat`;
        return `<img src="${src}" alt="${t.language}" height="20" />`;
    }).join('');
}).catch(() => {});

// ── Component canvas system ───────────────────────────────────────────────────
const PROFILE_DEFS = [
    { id: 'bio',        label: 'Bio' },
    { id: 'rating',     label: 'Developer Rating' },
    { id: 'monkeytype', label: 'Typing Speed' },
    { id: 'tech',       label: 'Tech Grid' },
    { id: 'badges',     label: 'Language Badges' },
];
const REPO_DEFS = [
    { id: 'grade',       label: 'Quality Grade' },
    { id: 'dims',        label: 'Dimension Scores' },
    { id: 'tech',        label: 'Tech Stack' },
    { id: 'suggestions', label: 'Suggestions' },
    { id: 'readme',      label: 'README Draft' },
];

let profileOrder  = PROFILE_DEFS.map(d => d.id);
let profileHidden = new Set();
let repoOrder     = REPO_DEFS.map(d => d.id);
let repoHidden    = new Set();
let dragSrcId    = null;
let dragCanvasId = null;
let badgesHtml   = null;

const loadBadges = () =>
    fetch('/tech-list?sort=frequency').then(r => r.json()).then(techs => {
        if (!techs.length) { badgesHtml = ''; return; }
        badgesHtml = techs.slice(0, 16).map(t => {
            const label = encodeURIComponent(t.language);
            const src   = t.slug && t.hex
                ? `https://img.shields.io/badge/${label}-${t.hex}?style=flat&logo=${t.slug}&logoColor=white`
                : `https://img.shields.io/badge/${label}-555555?style=flat`;
            return `<img src="${src}" alt="${t.language}" height="20" />`;
        }).join('');
        const el = document.querySelector('#profile-canvas .profile-badges');
        if (el) el.innerHTML = badgesHtml;
    }).catch(() => { badgesHtml = ''; });

loadBadges();

const attachDrag = (wrap, canvasEl, order, hidden, defs, renderFn) => {
    wrap.addEventListener('dragstart', e => {
        dragSrcId    = wrap.dataset.id;
        dragCanvasId = canvasEl.id;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => wrap.classList.add('dragging'), 0);
    });
    wrap.addEventListener('dragend', () => {
        wrap.classList.remove('dragging');
        canvasEl.querySelectorAll('.c-wrap').forEach(w => w.classList.remove('drag-over'));
    });
    wrap.addEventListener('dragover', e => {
        if (dragCanvasId !== canvasEl.id) return;
        e.preventDefault();
        canvasEl.querySelectorAll('.c-wrap').forEach(w => w.classList.remove('drag-over'));
        wrap.classList.add('drag-over');
    });
    wrap.addEventListener('drop', e => {
        e.preventDefault();
        if (dragCanvasId !== canvasEl.id || !dragSrcId || dragSrcId === wrap.dataset.id) return;
        wrap.classList.remove('drag-over');
        const si = order.indexOf(dragSrcId), ti = order.indexOf(wrap.dataset.id);
        if (si === -1 || ti === -1) return;
        order.splice(si, 1);
        order.splice(ti, 0, dragSrcId);
        buildCanvas(canvasEl, defs, order, hidden, renderFn);
    });
};

const buildCanvas = (canvasEl, defs, order, hidden, renderFn) => {
    canvasEl.innerHTML = '';
    for (const id of order) {
        if (hidden.has(id)) continue;
        const def  = defs.find(d => d.id === id);
        if (!def) continue;
        const body = renderFn(id);
        if (body === null) continue;
        const wrap = document.createElement('div');
        wrap.className  = 'c-wrap';
        wrap.dataset.id = id;
        wrap.draggable  = true;
        wrap.innerHTML  = `<div class="c-header">
            <span class="c-handle" title="Drag to reorder">⠿</span>
            <span class="c-label">${def.label}</span>
            <button class="c-delete" title="Remove">×</button>
        </div><div class="c-body">${body}</div>`;
        wrap.querySelector('.c-delete').addEventListener('click', () => {
            hidden.add(id);
            buildCanvas(canvasEl, defs, order, hidden, renderFn);
        });
        attachDrag(wrap, canvasEl, order, hidden, defs, renderFn);
        canvasEl.appendChild(wrap);
    }
    const available = defs.filter(d => hidden.has(d.id) && renderFn(d.id) !== null);
    if (available.length) {
        const addRow = document.createElement('div');
        addRow.className = 'c-add-row';
        addRow.innerHTML = `<button class="c-add-btn">+ Add Component</button>
            <div class="c-add-panel">${available.map(d =>
                `<div class="c-add-item" data-id="${d.id}">${d.label}</div>`).join('')}</div>`;
        const btn   = addRow.querySelector('.c-add-btn');
        const panel = addRow.querySelector('.c-add-panel');
        btn.addEventListener('click', e => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            e.stopPropagation();
        });
        addRow.querySelectorAll('.c-add-item').forEach(item => {
            item.addEventListener('click', () => {
                const rid = item.dataset.id;
                hidden.delete(rid);
                if (!order.includes(rid)) {
                    const origIdx  = defs.findIndex(d => d.id === rid);
                    const insertAt = order.reduce((pos, oid) => {
                        const oi = defs.findIndex(d => d.id === oid);
                        return oi < origIdx ? order.indexOf(oid) + 1 : pos;
                    }, 0);
                    order.splice(insertAt, 0, rid);
                }
                buildCanvas(canvasEl, defs, order, hidden, renderFn);
            });
        });
        document.addEventListener('click', () => { panel.style.display = 'none'; });
        canvasEl.appendChild(addRow);
    }
};

// ── Developer Insights tab ────────────────────────────────────────────────────
let insightsLoaded = false;
const insightsGate    = document.getElementById('insights-gate');
const insightsLoading = document.getElementById('insights-loading');
const insightsBody    = document.getElementById('insights-body');
const insightsError   = document.getElementById('insights-error');

const renderInsights = (md) => {
    insightsBody.innerHTML        = renderMd(md);
    insightsBody.style.display    = 'block';
    insightsGate.style.display    = 'none';
    insightsLoading.style.display = 'none';
    insightsLoaded = true;
};

document.getElementById('load-insights-btn').addEventListener('click', async () => {
    if (insightsLoaded) return;
    if (window._insightsMd) { renderInsights(window._insightsMd); return; }
    insightsGate.style.display    = 'none';
    insightsLoading.style.display = 'block';
    try {
        const r    = await fetch('/developer-rating-insights');
        const text = await r.text();
        if (!r.ok) throw new Error(text || r.statusText);
        renderInsights(text);
    } catch (err) {
        insightsLoading.style.display = 'none';
        insightsGate.style.display    = 'block';
        insightsError.textContent     = '✗ ' + err.message;
        insightsError.style.display   = 'block';
    }
});

// ── OAuth error banner ────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(location.search);
if (urlParams.get('error')) {
    const p = document.createElement('p');
    p.style.cssText = 'color:var(--danger);font-size:13px;margin-top:12px;text-align:center';
    p.textContent = 'GitHub sign-in failed: ' + decodeURIComponent(urlParams.get('error'));
    document.getElementById('cta-row').after(p);
}

// ── Apply logic ───────────────────────────────────────────────────────────────
const applyLog      = document.getElementById('apply-log');
const applyMsg      = document.getElementById('apply-msg');
const progressWrap  = document.getElementById('progress-wrap');
const progressFill  = document.getElementById('progress-fill');
const progressStatus = document.getElementById('progress-status');
let   applyRunning  = false;

const setProgress = (pct, msg) => {
    progressFill.style.width = pct + '%';
    if (msg) progressStatus.textContent = msg;
};

const appendStep = (msg, kind) => {
    const cls = kind === 'skip' ? 'skip'
        : msg.startsWith('Done') ? 'done'
        : msg.includes('✗') ? 'err' : 'ok';
    applyLog.innerHTML += `<div class="${cls}">${msg}</div>`;
    applyLog.scrollTop = applyLog.scrollHeight;
};

// Builds URLSearchParams for /apply-all; returns null and shows error if selection is empty.
const buildRepoParams = () => {
    const params = new URLSearchParams();
    if (selectedFeats.has('score'))        params.set('score',        'true');
    if (selectedFeats.has('readme'))       params.set('readme',       'true');
    if (selectedFeats.has('topics'))       params.set('topics',       'true');
    if (selectedFeats.has('descriptions')) params.set('descriptions', 'true');
    if (repoScopeMode === 'all') {
        params.set('repos', '*');
    } else {
        if (!selectedRepos.size) {
            progressWrap.style.display = 'none';
            applyMsg.textContent   = '✗ No repositories selected.';
            applyMsg.className     = 'apply-msg error';
            applyMsg.style.display = 'block';
            applyRunning = false;
            document.querySelectorAll('#apply-btn-1,#apply-btn-2').forEach(b => { b.disabled = false; });
            return null;
        }
        params.set('repos', [...selectedRepos].join(','));
    }
    return params;
};

// Wraps EventSource in a Promise; maps pct to [minPct, maxPct] range.
const runSSE = (url, minPct = 0, maxPct = 100) => new Promise((resolve, reject) => {
    const es = new EventSource(url);
    es.onmessage = (e) => {
        let data;
        try { data = JSON.parse(e.data); } catch { return; }
        if (data.type === 'progress') {
            const mapped = minPct + (data.pct / 100) * (maxPct - minPct);
            setProgress(Math.round(mapped), data.msg);
        }
        if (data.type === 'step') {
            appendStep(data.msg, data.kind);
        }
        if (data.type === 'done') {
            es.close(); resolve(data);
        }
        if (data.type === 'error') {
            es.close(); reject(new Error(data.msg));
        }
    };
    es.onerror = () => { es.close(); reject(new Error('Connection lost')); };
});
const REPO_FEAT_IDS = ['score', 'readme', 'topics', 'descriptions'];
let   selectedFeats  = new Set(['profile']);
let   repoScopeMode  = 'all';   // 'all' | 'select'
let   selectedRepos  = new Set(); // used when repoScopeMode === 'select'
let   repoListCache  = null;      // fetched once

const runApply = async (allBtns) => {
    if (applyRunning) return;
    applyRunning = true;
    allBtns.forEach(b => { b.disabled = true; });
    applyMsg.className      = 'apply-msg';
    applyLog.innerHTML      = '';
    applyLog.style.display  = 'block';
    progressWrap.style.display = 'block';
    setProgress(0, 'Starting…');
    document.getElementById('apply-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const repo        = window._selectedRepo;
    const hasRepoFeat = REPO_FEAT_IDS.some(id => selectedFeats.has(id));

    const showScheduleNote = () => {
        const scheduleNote = document.getElementById('schedule-note');
        const scheduleLink = document.getElementById('schedule-link');
        if (window._authUser) scheduleLink.href = `https://github.com/${window._authUser}/${window._authUser}/settings/secrets/actions/new?secret_name=GH_PAT`;
        scheduleNote.style.display = 'block';
    };

    const finish = (ok, msg) => {
        setProgress(100, ok ? 'Done.' : 'Failed.');
        applyMsg.textContent = ok ? `✓ ${msg}` : `✗ ${msg}`;
        applyMsg.className   = ok ? 'apply-msg success' : 'apply-msg error';
        applyMsg.style.display = 'block';
    };

    try {
        if (repo && !hasRepoFeat) {
            // Single-repo path — no SSE on repo-apply, keep fetch()
            const generateReadme = document.getElementById('readme-toggle').checked;
            applyMsg.textContent   = `Applying to ${repo}…`;
            applyMsg.style.display = 'block';
            setProgress(10, `Scoring ${repo}…`);
            const url  = `/repo-apply?repo=${encodeURIComponent(repo)}${generateReadme ? '&readme=true' : ''}`;
            const data = await fetch(url).then(r => r.json());
            (data.steps ?? []).forEach(s => {
                const cls = s.startsWith('Done') ? 'done' : s.startsWith('  ✗') ? 'err' : 'ok';
                applyLog.innerHTML += `<div class="${cls}">${s}</div>`;
            });
            if (!data.ok) throw new Error(data.error ?? 'Unknown error');
            finish(true, `Applied to github.com/${window._authUser}/${repo}`);

        } else if (hasRepoFeat && selectedFeats.has('profile')) {
            // Both profile + repos — sequential: 0→50% profile, 50→100% repos
            const params = buildRepoParams();
            if (!params) return;
            const scopeLabel = repoScopeMode === 'all' ? 'all repositories' : `${selectedRepos.size} repositories`;
            applyMsg.textContent   = `Updating profile and running across ${scopeLabel}…`;
            applyMsg.style.display = 'block';
            await runSSE('/apply-readme', 0, 50);
            await runSSE(`/apply-all?${params}`, 50, 100);
            finish(true, `Done — profile updated and operations applied across ${scopeLabel}.`);
            insightsLoaded = false;
            insightsBody.innerHTML = ''; insightsBody.style.display = 'none';
            insightsGate.style.display = 'block';
            showScheduleNote();

        } else if (hasRepoFeat) {
            // Repos only
            const params = buildRepoParams();
            if (!params) return;
            const scopeLabel = repoScopeMode === 'all' ? 'all repositories' : `${selectedRepos.size} repositories`;
            applyMsg.textContent   = `Running bulk operations across ${scopeLabel}…`;
            applyMsg.style.display = 'block';
            await runSSE(`/apply-all?${params}`, 0, 100);
            finish(true, `Done — operations applied across ${scopeLabel}.`);

        } else if (selectedFeats.has('profile')) {
            // Profile only
            applyMsg.textContent   = 'Generating and pushing to GitHub…';
            applyMsg.style.display = 'block';
            await runSSE('/apply-readme', 0, 100);
            finish(true, `Profile updated — github.com/${window._authUser}`);
            insightsLoaded = false;
            insightsBody.innerHTML = ''; insightsBody.style.display = 'none';
            insightsGate.style.display = 'block';
            showScheduleNote();

        } else {
            progressWrap.style.display = 'none';
            applyMsg.textContent   = 'Select at least one feature above.';
            applyMsg.className     = 'apply-msg';
            applyMsg.style.display = 'block';
        }
    } catch (err) {
        finish(false, err.message);
        applyLog.innerHTML += `<div class="err">✗ ${err.message}</div>`;
    }

    applyRunning = false;
    allBtns.forEach(b => { b.disabled = false; });
};

// ── Auth state ────────────────────────────────────────────────────────────────
fetch('/auth/me').then(r => r.ok ? r.json() : null).then(me => {
    if (!me) return;
    window._authUser     = me.username;
    window._selectedRepo = null;

    document.getElementById('preview-demo').style.display    = 'none';
    document.getElementById('preview-loading').style.display = 'block';

    document.getElementById('nav-user').style.display  = 'flex';
    document.getElementById('nav-avatar').src           = me.avatar;
    document.getElementById('nav-username').textContent = '@' + me.username;

    document.getElementById('preview-url').textContent = `github.com/${me.username}/${me.username}`;
    document.getElementById('url-caret').style.display = 'inline';
    document.getElementById('preview-url').classList.add('clickable');

    const ghPath   = `M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z`;
    const applyBtn1 = document.createElement('button');
    applyBtn1.className = 'btn btn-primary btn-lg';
    applyBtn1.disabled  = true;
    applyBtn1.id        = 'apply-btn-1';
    applyBtn1.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="${ghPath}"/></svg> Apply to Profile`;
    const disconnectA = document.createElement('a');
    disconnectA.href      = '/auth/logout';
    disconnectA.className = 'btn btn-ghost btn-lg';
    disconnectA.textContent = 'Disconnect';
    const ctaRow = document.getElementById('cta-row');
    ctaRow.innerHTML = '';
    ctaRow.append(applyBtn1, disconnectA);

    document.getElementById('apply-section').style.display    = 'block';
    document.getElementById('settings-section').style.display = 'block';

    const applyBtn2    = document.getElementById('apply-btn-2');
    const allApplyBtns = [applyBtn1, applyBtn2];
    applyBtn1.addEventListener('click', () => runApply(allApplyBtns));
    applyBtn2.addEventListener('click', () => runApply(allApplyBtns));

    // Feature selector
    const featureGrid = document.getElementById('feature-grid');
    featureGrid.classList.add('interactive');

    // Mark profile card as initially selected
    featureGrid.querySelector('[data-id="profile"]').classList.add('selected');
    featureGrid.querySelector('[data-id="profile"] .feature-check').textContent = '✓';

    const repoScopeEl  = document.getElementById('repo-scope');
    const scopeAllBtn  = document.getElementById('scope-all');
    const scopeSelBtn  = document.getElementById('scope-select');
    const repoPicker   = document.getElementById('repo-picker');
    const repoChipsEl  = document.getElementById('repo-chips');

    const buildRepoChips = async () => {
        if (!repoListCache) {
            repoListCache = await fetch('/repos').then(r => r.json()).catch(() => []);
            repoListCache = repoListCache.filter(r => !r.isProfile);
        }
        repoChipsEl.innerHTML = repoListCache.map(r =>
            `<div class="repo-chip${selectedRepos.has(r.name) ? ' selected' : ''}" data-name="${r.name}">${r.name}</div>`
        ).join('');
        repoChipsEl.querySelectorAll('.repo-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const name = chip.dataset.name;
                if (selectedRepos.has(name)) { selectedRepos.delete(name); chip.classList.remove('selected'); }
                else                         { selectedRepos.add(name);    chip.classList.add('selected'); }
                syncApplyLabel();
            });
        });
    };

    scopeAllBtn.addEventListener('click', () => {
        repoScopeMode = 'all';
        scopeAllBtn.classList.add('active'); scopeSelBtn.classList.remove('active');
        repoPicker.style.display = 'none';
        syncApplyLabel();
    });
    scopeSelBtn.addEventListener('click', () => {
        repoScopeMode = 'select';
        scopeSelBtn.classList.add('active'); scopeAllBtn.classList.remove('active');
        repoPicker.style.display = 'block';
        buildRepoChips();
        syncApplyLabel();
    });

    const syncApplyLabel = () => {
        const hasRepo = REPO_FEAT_IDS.some(id => selectedFeats.has(id));

        // Show/hide repo scope row
        repoScopeEl.style.display = hasRepo ? 'flex' : 'none';

        let label;
        if (!hasRepo && !selectedFeats.has('profile')) {
            label = 'Select features above';
            allApplyBtns.forEach(b => { b.disabled = true; });
        } else {
            allApplyBtns.forEach(b => { b.disabled = window._previewLoading ?? false; });
            if (hasRepo && selectedFeats.has('profile')) {
                const scopeStr = repoScopeMode === 'all'
                    ? 'All Repos'
                    : selectedRepos.size ? `${selectedRepos.size} Repo${selectedRepos.size !== 1 ? 's' : ''}` : 'Select Repos';
                label = `Apply to Profile & ${scopeStr}`;
            } else if (hasRepo) {
                const scopeStr = repoScopeMode === 'all'
                    ? 'All Repositories'
                    : selectedRepos.size ? `${selectedRepos.size} Repositor${selectedRepos.size !== 1 ? 'ies' : 'y'}` : 'Select Repositories';
                label = `Apply to ${scopeStr}`;
            } else {
                label = window._selectedRepo ? `Apply to ${window._selectedRepo}` : 'Apply to Profile';
            }
        }
        const svg = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="${ghPath}"/></svg>`;
        allApplyBtns.forEach(b => { b.innerHTML = `${svg} ${label}`; });
    };

    featureGrid.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            if (selectedFeats.has(id)) {
                selectedFeats.delete(id);
                card.classList.remove('selected');
                card.querySelector('.feature-check').textContent = '';
            } else {
                selectedFeats.add(id);
                card.classList.add('selected');
                card.querySelector('.feature-check').textContent = '✓';
            }
            syncApplyLabel();
        });
    });

    // Profile preview
    const loadingEl     = document.getElementById('preview-loading');
    const loadErrEl     = document.getElementById('preview-load-error');
    const profileCanvas = document.getElementById('profile-canvas');

    const buildProfileCanvas = (data) => {
        window._previewData = data;
        const u = me.username;
        const insightsUrl = `https://github.com/${u}/${u}/blob/main/DEVELOPER_INSIGHTS.md`;
        const renderFn = (id) => {
            switch (id) {
                case 'bio':
                    return `<p style="margin-bottom:0">${data.bio ?? ''}</p>`;
                case 'rating':
                    if (!data.ratingSvg) return null;
                    return `<a href="${insightsUrl}"><img src="${svgDataUri(data.ratingSvg)}" style="width:100%;border-radius:4px;display:block" alt="Developer Rating"/></a>`;
                case 'monkeytype':
                    if (!data.monkeytypeSvg) return null;
                    return `<img src="${svgDataUri(data.monkeytypeSvg)}" style="width:100%;border-radius:4px;display:block" alt="Typing Speed"/>`;
                case 'tech':
                    if (!data.techGridSvg) return null;
                    return `<img src="${svgDataUri(data.techGridSvg)}" style="width:100%;border-radius:4px;display:block" alt="Tech Grid"/>`;
                case 'badges':
                    return `<div class="profile-badges">${badgesHtml ?? '<span style="color:var(--text-3);font-size:12px">Loading badges…</span>'}</div>`;
                default: return '';
            }
        };
        buildCanvas(profileCanvas, PROFILE_DEFS, profileOrder, profileHidden, renderFn);
    };

    const showPreview = (data) => {
        profileOrder  = PROFILE_DEFS.map(d => d.id);
        profileHidden = new Set();
        buildProfileCanvas(data);
        loadingEl.style.display     = 'none';
        profileCanvas.style.display = 'block';
        if (data.insightsMd) {
            window._insightsMd = data.insightsMd;
            renderInsights(data.insightsMd);
            document.getElementById('tab-insights').textContent = 'Developer Insights ✓';
        }
        allApplyBtns.forEach(b => { b.disabled = false; });
    };

    const fetchPreview = async (refresh = false) => {
        loadingEl.style.display     = 'block';
        loadErrEl.style.display     = 'none';
        profileCanvas.style.display = 'none';
        allApplyBtns.forEach(b => { b.disabled = true; });
        try {
            const r    = await fetch('/preview-readme' + (refresh ? '?refresh=true' : ''));
            const data = await r.json();
            if (!r.ok) throw new Error(data.error ?? r.statusText);
            showPreview(data);
        } catch (err) {
            loadErrEl.textContent = '✗ ' + err.message + ' — ';
            const retry = document.createElement('button');
            retry.className = 'btn-sm'; retry.style.display = 'inline'; retry.textContent = 'Retry';
            retry.addEventListener('click', () => fetchPreview());
            loadErrEl.appendChild(retry);
            loadErrEl.style.display = 'block';
        }
    };

    fetchPreview();

    // URL dropdown — repo switcher
    const urlEl    = document.getElementById('preview-url');
    const dropdown = document.getElementById('url-dropdown');

    const setProfileMode = () => {
        window._selectedRepo = null;
        urlEl.textContent    = `github.com/${me.username}/${me.username}`;
        document.getElementById('tab-readme').style.display    = '';
        document.getElementById('tab-insights').style.display  = '';
        document.getElementById('tab-score').style.display     = 'none';
        activateTab('readme');
        syncApplyLabel();
        document.getElementById('readme-toggle-label').style.display = 'none';
        document.getElementById('schedule-note').style.display        = 'none';
        applyMsg.style.display = 'none';
        applyLog.style.display = 'none';
        const previewReady = profileCanvas.style.display !== 'none';
        allApplyBtns.forEach(b => { b.disabled = !previewReady; });
    };

    const buildRepoCanvas = (data, repoName) => {
        const { codeQuality, suggestions, techStack, summary, readmeOutline } = data;
        repoOrder  = REPO_DEFS.map(d => d.id);
        repoHidden = new Set();
        const renderFn = (id) => {
            switch (id) {
                case 'grade': {
                    const g  = codeQuality?.grade ?? '?';
                    const colorMap = { 'A+': '#3fb950', A: '#3fb950', B: '#58a6ff', C: '#d2a22a', D: '#f0883e', F: '#f85149' };
                    const gc = colorMap[g] ?? '#6e7681';
                    return `<div class="grade-hero">
                        <div class="grade-badge grade-${CSS.escape(g)}">${g}</div>
                        <div class="grade-hero-info">
                            <h2>${repoName}</h2>
                            <p>${summary || data.meta?.description || ''}</p>
                            <div class="grade-overall" style="color:${gc}">${codeQuality?.overall ?? '—'}/100</div>
                        </div>
                    </div>`;
                }
                case 'dims': {
                    const dims = [
                        ['Testing',       codeQuality?.testing],
                        ['Documentation', codeQuality?.documentation],
                        ['Tooling',       codeQuality?.tooling],
                        ['CI/CD',         codeQuality?.ci],
                        ['Security',      codeQuality?.security],
                        ['Structure',     codeQuality?.structure],
                    ].filter(([, d]) => d);
                    if (!dims.length) return null;
                    return `<div class="quality-dims">${dims.map(([label, dim]) => {
                        const color = gradeColor(dim.score);
                        const notes = dim.notes || (dim.evidence?.slice(0, 2).join(' · ') ?? '');
                        return `<div class="quality-dim">
                            <div class="dim-header">
                                <span>${label}</span>
                                <span class="dim-grade dim-grade-${CSS.escape(dim.grade)}">${dim.grade}</span>
                            </div>
                            <div class="score-bar-bg"><div class="score-bar-fill" style="width:${dim.score}%;background:${color}"></div></div>
                            <div class="dim-score">${dim.score}/100</div>
                            ${notes ? `<div class="dim-notes">${notes}</div>` : ''}
                        </div>`;
                    }).join('')}</div>`;
                }
                case 'tech': {
                    if (!techStack?.length) return null;
                    return `<div><p class="section-label" style="margin-bottom:10px">Tech stack detected</p>
                        <div class="tech-tags">${techStack.slice(0, 12).map(t => `<span class="tech-tag">${t}</span>`).join('')}</div></div>`;
                }
                case 'suggestions': {
                    if (!suggestions?.length) return null;
                    return `<div><p class="section-label" style="margin-bottom:10px">Top suggestions</p>
                        <ul class="suggestions-list">${suggestions.slice(0, 5).map(s => `<li>${s}</li>`).join('')}</ul></div>`;
                }
                case 'readme': {
                    if (!readmeOutline) return null;
                    const md = [
                        `# ${readmeOutline.title || repoName}`,
                        readmeOutline.tagline ? `> ${readmeOutline.tagline}` : '',
                        readmeOutline.features?.length ? '## Features\n\n' + readmeOutline.features.map(f => `- ${f}`).join('\n') : '',
                        readmeOutline.installationSteps?.length ? '## Installation\n\n```bash\n' + readmeOutline.installationSteps.join('\n') + '\n```' : '',
                        readmeOutline.usageExample ? '## Usage\n\n```\n' + readmeOutline.usageExample + '\n```' : '',
                    ].filter(Boolean).join('\n\n');
                    return `<div class="gh-render" style="padding:0;background:none">${renderMd(md)}</div>`;
                }
                default: return '';
            }
        };
        const canvasEl = document.getElementById('repo-canvas');
        buildCanvas(canvasEl, REPO_DEFS, repoOrder, repoHidden, renderFn);
    };

    const setRepoMode = async (repoName) => {
        window._selectedRepo = repoName;
        urlEl.textContent    = `github.com/${me.username}/${repoName}/blob/main/SCORE.md`;
        document.getElementById('tab-readme').style.display   = 'none';
        document.getElementById('tab-insights').style.display = 'none';
        document.getElementById('tab-score').style.display    = '';
        activateTab('score');
        allApplyBtns.forEach(b => { b.disabled = true; });
        syncApplyLabel();
        document.getElementById('readme-toggle-label').style.display = 'flex';
        document.getElementById('schedule-note').style.display        = 'none';
        applyMsg.style.display = 'none';
        applyLog.style.display = 'none';

        const scanLoading = document.getElementById('repo-scan-loading');
        const repoCanvas  = document.getElementById('repo-canvas');
        const repoError   = document.getElementById('repo-error');
        repoCanvas.innerHTML      = '';
        scanLoading.style.display = 'block';
        repoError.style.display   = 'none';

        try {
            const r    = await fetch(`/repo-scan?repo=${encodeURIComponent(repoName)}`);
            const data = await r.json();
            if (!r.ok) throw new Error(data.error ?? r.statusText);
            scanLoading.style.display = 'none';
            buildRepoCanvas(data, repoName);
            allApplyBtns.forEach(b => { b.disabled = false; });
            fetch('/preview-readme?refresh=true').then(r => r.json()).then(pd => {
                if (!pd?.ok) return;
                window._previewData = pd;
                if (!window._selectedRepo && profileCanvas.style.display !== 'none') {
                    buildProfileCanvas(pd);
                }
                if (pd.insightsMd) window._insightsMd = pd.insightsMd;
            }).catch(() => {});
        } catch (err) {
            scanLoading.style.display = 'none';
            repoError.textContent     = '✗ ' + err.message;
            repoError.style.display   = 'block';
        }
    };

    fetch('/repos').then(r => r.json()).then(repoList => {
        dropdown.innerHTML = repoList.map(r => `
            <div class="url-item ${r.isProfile ? 'url-item-profile' : ''}" data-repo="${r.isProfile ? '' : r.name}">
                <span class="url-item-name">${me.username}/${r.name}${r.isProfile ? '<span class="url-item-badge">profile</span>' : ''}</span>
                ${r.description ? `<span class="url-item-desc">${r.description}</span>` : ''}
            </div>
        `).join('');
        dropdown.querySelectorAll('.url-item').forEach(item => {
            item.addEventListener('click', () => {
                dropdown.style.display = 'none';
                const repo = item.dataset.repo;
                if (!repo) setProfileMode();
                else        setRepoMode(repo);
            });
        });
    }).catch(() => {});

    urlEl.addEventListener('click', () => {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.gh-url-wrapper')) dropdown.style.display = 'none';
    });

    // Monkeytype
    const mtStatus    = document.getElementById('mt-status');
    const mtForm      = document.getElementById('mt-connect-form');
    const mtConnected = document.getElementById('mt-connected');
    const mtLabel     = document.getElementById('mt-connected-label');
    const mtError     = document.getElementById('mt-error');

    const showMtConnected    = (u) => { mtStatus.style.display='inline'; mtForm.style.display='none'; mtConnected.style.display='block'; mtLabel.textContent=u?`Connected as ${u}.`:'Monkeytype connected.'; };
    const showMtDisconnected = ()  => { mtStatus.style.display='none'; mtForm.style.display='block'; mtConnected.style.display='none'; };

    if (me.monkeytype_connected) showMtConnected(me.monkeytype_username);

    document.getElementById('mt-save').addEventListener('click', async () => {
        const key  = document.getElementById('mt-key').value.trim();
        const user = document.getElementById('mt-user').value.trim();
        if (!key) { mtError.textContent = 'Please enter your Ape Key.'; mtError.style.display = 'block'; return; }
        const btn = document.getElementById('mt-save');
        btn.disabled = true; btn.textContent = 'Connecting…'; mtError.style.display = 'none';
        try {
            const r = await fetch('/monkeytype/connect', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({api_key:key,username:user||null}) });
            if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'Failed'); }
            showMtConnected(user || null);
            fetchPreview(true);
        } catch (err) {
            mtError.textContent = '✗ ' + err.message; mtError.style.display = 'block';
        } finally { btn.disabled = false; btn.textContent = 'Connect'; }
    });

    document.getElementById('mt-disconnect').addEventListener('click', async () => {
        await fetch('/monkeytype/disconnect', { method: 'POST' });
        showMtDisconnected();
        fetchPreview(true);
    });

}).catch(() => {});
