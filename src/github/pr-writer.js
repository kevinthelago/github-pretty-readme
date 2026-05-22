const ghHeaders = (token) => ({
    Authorization:  `Bearer ${token}`,
    Accept:         'application/vnd.github+json',
    'Content-Type': 'application/json',
});

const getDefaultBranch = async (token, owner, repo) => {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders(token) });
    if (!res.ok) throw new Error(`GET repo → ${res.status}`);
    const { default_branch } = await res.json();

    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${default_branch}`, {
        headers: ghHeaders(token),
    });
    if (!refRes.ok) throw new Error(`GET ref → ${refRes.status}`);
    const { object } = await refRes.json();
    return { defaultBranch: default_branch, sha: object.sha };
};

/**
 * Creates a branch off the current default branch tip.
 * If the branch already exists it is force-reset to the default branch tip
 * (so the PR always shows only the new changes from this run).
 */
export const ensureBranch = async (token, owner, repo, branchName) => {
    const { defaultBranch, sha } = await getDefaultBranch(token, owner, repo);

    const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        headers: ghHeaders(token),
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
    });

    if (createRes.status === 422) {
        // Branch exists — reset it to the current default branch tip
        const patchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branchName}`, {
            method: 'PATCH',
            headers: ghHeaders(token),
            body: JSON.stringify({ sha, force: true }),
        });
        if (!patchRes.ok) throw new Error(`PATCH ref → ${patchRes.status}: ${await patchRes.text()}`);
    } else if (!createRes.ok) {
        throw new Error(`POST ref → ${createRes.status}: ${await createRes.text()}`);
    }

    return { defaultBranch, sha };
};

/** Returns the blob SHA of a file on a given branch, or null if it doesn't exist. */
export const getFileSha = async (token, owner, repo, path, branch) => {
    const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
        { headers: ghHeaders(token) },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return (await res.json()).sha;
};

/** Writes a file to a specific branch via the Contents API. */
export const putFile = async (token, owner, repo, path, content, sha, message, branch) => {
    const body = {
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
    };
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: ghHeaders(token),
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PUT ${path} → ${res.status}: ${await res.text()}`);
};

/**
 * Opens a PR from head → base.
 * If an open PR already exists for this head branch, its title and body are updated instead.
 */
export const openOrUpdatePR = async (token, owner, repo, head, base, title, body) => {
    const listRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:${encodeURIComponent(head)}&base=${base}&state=open`,
        { headers: ghHeaders(token) },
    );
    if (listRes.ok) {
        const prs = await listRes.json();
        if (prs.length > 0) {
            const pr = prs[0];
            await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}`, {
                method: 'PATCH',
                headers: ghHeaders(token),
                body: JSON.stringify({ title, body }),
            });
            return { url: pr.html_url, number: pr.number, updated: true };
        }
    }

    const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: ghHeaders(token),
        body: JSON.stringify({ title, head, base, body }),
    });
    if (!createRes.ok) throw new Error(`POST pulls → ${createRes.status}: ${await createRes.text()}`);
    const pr = await createRes.json();
    return { url: pr.html_url, number: pr.number, updated: false };
};
