/* ==================================================
   SKILLS: interactive skill graph
   - Wide screens: floating "neurons" grouped around category hubs and a
     central core. Hover lights a cluster and shows its name in the core,
     click a node to fire a pulse into the core, click a category (or its
     filter) to zoom into an orbit around the core.
   - Narrow screens: tidy category cards (same data, same colours).
   profile.json "skills" can be { "Category": ["Skill", ...] } (recommended)
   or a flat ["Skill", ...] list.
   ================================================== */

const SKILL_COLORS = ['#67e8f9', '#818cf8', '#34d399', '#c084fc', '#f472b6', '#fbbf24'];

const clampTo = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeOut = (u) => 1 - Math.pow(1 - u, 3);

function normalizeSkills(raw) {
    if (Array.isArray(raw)) {
        return raw.length ? [{ name: 'Skills', items: raw.map(String) }] : [];
    }

    if (raw && typeof raw === 'object') {
        return Object.entries(raw)
            .map(([name, items]) => ({
                name,
                items: (Array.isArray(items) ? items : []).map(String)
            }))
            .filter(group => group.items.length);
    }

    return [];
}

function initSkills(rawSkills) {
    const lab = $('skills-lab');
    if (!lab) return;

    const groups = normalizeSkills(rawSkills);
    const total = groups.reduce((sum, g) => sum + g.items.length, 0);

    if (!total) {
        lab.textContent = '';
        return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colorOf = (i) => SKILL_COLORS[i % SKILL_COLORS.length];

    const MAP_MIN_WIDTH = 760;   // below this the section becomes category cards
    const CORE_BOX = 168;        // area around the core kept clear of nodes
    const FLOAT = 5;             // idle drift in px
    const MAGNET_RADIUS = 170;   // cursor pull radius

    /* ----- Markup ----- */

    lab.innerHTML = `
        <div class="sk-toolbar">
            <div class="sk-filters" role="group" aria-label="Filter skills by category">
                <button type="button" class="sk-filter is-active" data-cat="all" aria-pressed="true">
                    All <span class="sk-filter-count">${total}</span>
                </button>
                ${groups.map((g, i) => `
                <button type="button" class="sk-filter" data-cat="${i}" aria-pressed="false"
                        style="--c:${colorOf(i)}">
                    <span class="sk-dot" aria-hidden="true"></span>${esc(g.name)}
                    <span class="sk-filter-count">${g.items.length}</span>
                </button>`).join('')}
            </div>
            <p class="sk-hint" aria-hidden="true">hover a node · click to fire it</p>
        </div>

        <div class="sk-stage">
            <svg class="sk-links" aria-hidden="true"></svg>

            <div class="sk-core" aria-hidden="true">
                <span class="sk-core-ring"></span>
                <span class="sk-core-ring r2"></span>
                <div class="sk-core-body">
                    <strong class="sk-core-main">${total}</strong>
                    <span class="sk-core-sub">skills</span>
                </div>
            </div>

            ${groups.map((g, i) => `
            <div class="sk-cluster" style="--c:${colorOf(i)}">
                <div class="sk-slot sk-hub-slot">
                    <button type="button" class="sk-hub" data-cat="${i}" tabindex="-1"
                            title="Zoom into ${esc(g.name)}">
                        ${esc(g.name)}<span class="sk-hub-count">${g.items.length}</span>
                    </button>
                </div>
                <ul class="sk-group" aria-label="${esc(g.name)}">
                    ${g.items.map(name => `
                    <li class="sk-slot"><span class="sk-node"><span class="sk-dot" aria-hidden="true"></span>${esc(name)}</span></li>`).join('')}
                </ul>
            </div>`).join('')}
        </div>
    `;

    /* ----- Model ----- */

    const stage = lab.querySelector('.sk-stage');
    const svg = lab.querySelector('.sk-links');
    const core = lab.querySelector('.sk-core');
    const coreBody = lab.querySelector('.sk-core-body');
    const coreMain = lab.querySelector('.sk-core-main');
    const coreSub = lab.querySelector('.sk-core-sub');
    const filterBtns = [...lab.querySelectorAll('.sk-filter')];
    const SVG_NS = 'http://www.w3.org/2000/svg';

    let seed = 11;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    const makeLine = (kind, color) => {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('class', `sk-link ${kind}`);
        line.style.setProperty('--c', color);
        svg.appendChild(line);
        return line;
    };

    const blank = () => ({
        x: 0, y: 0, vx: 0, vy: 0,   // current position (centre) and velocity
        ax: 0, ay: 0,               // anchor from the layout
        w: 0, h: 0,                 // measured size
        phase: rand() * Math.PI * 2,
        startAt: 0
    });

    const nodeByEl = new Map();

    const clusters = [...stage.querySelectorAll('.sk-cluster')].map((el, i) => {
        const color = colorOf(i);
        const hubSlot = el.querySelector('.sk-hub-slot');

        const cluster = {
            i, el, color,
            name: groups[i].name,
            mix: 0,           // 0 = links start at the hub, 1 = links start at the core
            home: { x: 0, y: 0 },
            sim: null,
            nodes: [],
            lines: []
        };

        cluster.hub = {
            ...blank(),
            cluster,
            slot: hubSlot,
            btn: hubSlot.querySelector('.sk-hub')
        };

        cluster.hubLine = makeLine('is-hub', color);
        cluster.lines.push(cluster.hubLine);

        cluster.nodes = [...el.querySelectorAll('.sk-group > .sk-slot')].map((slot, j) => {
            const node = {
                ...blank(),
                cluster,
                idx: j,
                slot,
                btn: slot.querySelector('.sk-node'),
                name: groups[i].items[j],
                line: makeLine('is-node', color)
            };

            nodeByEl.set(node.btn, node);
            cluster.lines.push(node.line);
            return node;
        });

        return cluster;
    });

    const boxes = clusters.flatMap(c => [c.hub, ...c.nodes]);

    /* ----- State ----- */

    let isMap = false;
    let W = 0;
    let H = 0;
    let lastWidth = -1;
    let focus = null;            // zoomed category index, or null for the full graph
    let hoverNode = null;
    let hoverCluster = null;
    let pinned = null;           // touch: the node that was tapped last
    let pointer = null;          // cursor inside the stage
    let lastPointerType = 'mouse';
    let started = false;
    let visible = false;
    let needSnap = true;
    let running = false;
    let rafId = 0;
    let last = 0;
    let rot = 0;                 // orbit angle for the zoomed category
    let spin = 1;                // orbit speed (slows while the cursor is inside)
    const pulses = [];

    /* ----- Core readout, hover and filter state ----- */

    function refreshCore() {
        const node = hoverNode || pinned;
        const c = node
            ? node.cluster
            : (hoverCluster || (focus !== null ? clusters[focus] : null));

        core.style.setProperty('--c', c ? c.color : 'var(--accent)');

        if (node) {
            coreMain.textContent = node.name;
            coreSub.textContent = node.cluster.name;
        } else if (c) {
            coreMain.textContent = c.name;
            coreSub.textContent = `${c.nodes.length} skills`;
        } else {
            coreMain.textContent = total;
            coreSub.textContent = 'skills';
        }

        coreMain.classList.toggle('is-name', !!c);
    }

    function applyHot() {
        const node = hoverNode || pinned;
        const hotCluster = node ? node.cluster : hoverCluster;

        clusters.forEach(c => {
            const hot = c === hotCluster;
            const faded = !!hotCluster && !hot && focus === null;

            c.el.classList.toggle('is-hot', hot);
            c.el.classList.toggle('is-faded', faded);

            c.lines.forEach(line => {
                line.classList.toggle('is-hot', hot);
                line.classList.toggle('is-faded', faded);
            });

            c.nodes.forEach(n => n.btn.classList.toggle('is-hot', n === node));
        });

        refreshCore();
    }

    function setFocus(idx) {
        focus = idx;
        hoverNode = null;
        hoverCluster = null;
        pinned = null;

        lab.classList.toggle('is-focus', idx !== null);

        filterBtns.forEach(btn => {
            const on = btn.dataset.cat === 'all'
                ? idx === null
                : Number(btn.dataset.cat) === idx;

            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-pressed', String(on));
        });

        clusters.forEach(c => {
            const gone = idx !== null && c.i !== idx;

            c.el.classList.toggle('is-gone', gone);
            c.el.inert = gone;
            c.lines.forEach(line => line.classList.toggle('is-gone', gone));

            // The hub of the zoomed category steps aside; the core names it instead.
            c.hub.slot.classList.toggle('is-off', idx === c.i);
            c.hubLine.classList.toggle('is-off', idx === c.i);
        });

        applyHot();

        if (reduced && isMap) step(performance.now(), true);
    }

    /* ----- Layout ----- */

    function measure() {
        boxes.forEach(b => {
            b.w = b.slot.offsetWidth;
            b.h = b.slot.offsetHeight;
        });
    }

    // Spread hubs around the core, then relax every box so nothing overlaps.
    // Deterministic, and works for any number of categories / skills.
    function computeAnchors() {
        const cx = W / 2;
        const cy = H / 2;
        const sim = [];

        const add = (ref, x, y, group, kind) => {
            const s = { ref, x, y, w: ref.w, h: ref.h, group, kind, fixed: false };
            sim.push(s);
            return s;
        };

        clusters.forEach((c, i) => {
            const a = -Math.PI / 2 + (i / clusters.length) * Math.PI * 2;

            c.home = {
                x: cx + Math.cos(a) * W * 0.37,
                y: cy + Math.sin(a) * H * 0.33
            };

            c.sim = add(c.hub, c.home.x, c.home.y, i, 'hub');

            c.nodes.forEach((n, j) => {
                const ang = a + j * 2.39996;
                const rad = 46 + 24 * Math.sqrt(j + 1);

                add(
                    n,
                    c.home.x + Math.cos(ang) * rad * 1.6,
                    c.home.y + Math.sin(ang) * rad,
                    i,
                    'node'
                );
            });
        });

        sim.push({
            ref: null, x: cx, y: cy, w: CORE_BOX, h: CORE_BOX,
            group: -1, kind: 'core', fixed: true
        });

        const margin = 14;

        const ITERATIONS = 600;

        for (let it = 0; it < ITERATIONS; it++) {
            // Gentle pull towards the hub (nodes) or the hub's home (hubs).
            // It fades out so the last passes are pure overlap removal.
            const ease = 1 - it / ITERATIONS;

            for (const s of sim) {
                if (s.fixed) continue;

                const c = clusters[s.group];
                const tx = s.kind === 'hub' ? c.home.x : c.sim.x;
                const ty = s.kind === 'hub' ? c.home.y : c.sim.y;
                const pull = (s.kind === 'hub' ? 0.06 : 0.03) * ease;

                s.x += (tx - s.x) * pull;
                s.y += (ty - s.y) * pull;
            }

            // Push overlapping boxes apart along the axis of least overlap.
            for (let a = 0; a < sim.length; a++) {
                for (let b = a + 1; b < sim.length; b++) {
                    const p = sim[a];
                    const q = sim[b];
                    const pad = p.group === q.group ? 12 : 24;

                    const ox = (p.w + q.w) / 2 + pad - Math.abs(q.x - p.x);
                    const oy = (p.h + q.h) / 2 + pad - Math.abs(q.y - p.y);

                    if (ox <= 0 || oy <= 0) continue;

                    const wp = p.fixed ? 0 : (q.fixed ? 1 : 0.5);
                    const wq = q.fixed ? 0 : (p.fixed ? 1 : 0.5);

                    if (ox < oy) {
                        const dir = q.x >= p.x ? 1 : -1;
                        p.x -= dir * ox * wp;
                        q.x += dir * ox * wq;
                    } else {
                        const dir = q.y >= p.y ? 1 : -1;
                        p.y -= dir * oy * wp;
                        q.y += dir * oy * wq;
                    }
                }
            }

            for (const s of sim) {
                if (s.fixed) continue;

                s.x = clampTo(s.x, s.w / 2 + margin, W - s.w / 2 - margin);
                s.y = clampTo(s.y, s.h / 2 + margin, H - s.h / 2 - margin);
            }
        }

        sim.forEach(s => {
            if (s.ref) {
                s.ref.ax = s.x;
                s.ref.ay = s.y;
            }
        });
    }

    // Orbit radii for the zoomed category.
    function ringOf(c) {
        const k = c.nodes.length;

        return {
            rx: Math.min(W / 2 - 110, 150 + k * 30),
            ry: Math.min(H / 2 - 54, 92 + k * 14)
        };
    }

    /* ----- Animation ----- */

    const setLine = (line, x1, y1, x2, y2) => {
        line.setAttribute('x1', x1.toFixed(1));
        line.setAttribute('y1', y1.toFixed(1));
        line.setAttribute('x2', x2.toFixed(1));
        line.setAttribute('y2', y2.toFixed(1));
    };

    const place = (b) => {
        b.slot.style.transform =
            `translate3d(${(b.x - b.w / 2).toFixed(1)}px, ${(b.y - b.h / 2).toFixed(1)}px, 0)`;
    };

    function flash(el) {
        if (!el.animate) return;

        el.animate(
            [
                { transform: 'scale(1)' },
                { transform: 'scale(1.12)' },
                { transform: 'scale(1)' }
            ],
            { duration: 380, easing: 'ease-out' }
        );
    }

    // snap = true places everything exactly on its target (no springs, no drift).
    function step(now, snap) {
        const dt = snap ? 16.7 : Math.min(now - last || 16.7, 48);
        const k = dt / 16.7;
        last = now;

        const cx = W / 2;
        const cy = H / 2;

        spin += ((pointer ? 0.12 : 1) - spin) * Math.min(1, 0.05 * k);

        if (focus !== null && !reduced && !snap) {
            rot += dt * 0.00009 * spin;
        }

        const ring = focus !== null ? ringOf(clusters[focus]) : null;
        const damp = Math.pow(0.8, k);

        for (const c of clusters) {
            c.mix += ((focus !== null ? 1 : 0) - c.mix) * (snap ? 1 : Math.min(1, 0.1 * k));

            const items = [c.hub, ...c.nodes];

            for (const b of items) {
                let tx = b.ax;
                let ty = b.ay;

                if (focus === c.i && b !== c.hub) {
                    const ang = -Math.PI / 2 + (b.idx / c.nodes.length) * Math.PI * 2 + rot;

                    tx = cx + Math.cos(ang) * ring.rx;
                    ty = cy + Math.sin(ang) * ring.ry;
                }

                if (!snap && !reduced) {
                    tx += Math.sin(now * 0.0007 + b.phase) * FLOAT;
                    ty += Math.cos(now * 0.0006 + b.phase * 1.3) * FLOAT;

                    // Nodes lean towards the cursor (stable: the node under the
                    // cursor never runs away from it).
                    if (pointer && b !== c.hub) {
                        const dx = pointer.x - b.x;
                        const dy = pointer.y - b.y;
                        const d = Math.hypot(dx, dy);

                        if (d < MAGNET_RADIUS) {
                            const pull = (1 - d / MAGNET_RADIUS) * 0.3;

                            tx += dx * pull;
                            ty += dy * pull;
                        }
                    }
                }

                if (snap) {
                    b.x = tx;
                    b.y = ty;
                    b.vx = 0;
                    b.vy = 0;
                } else if (now < b.startAt) {
                    // Waiting for its turn in the intro: parked on the core.
                    b.x = cx;
                    b.y = cy;
                    b.vx = 0;
                    b.vy = 0;
                } else {
                    b.vx += (tx - b.x) * 0.085 * k;
                    b.vy += (ty - b.y) * 0.085 * k;
                    b.vx *= damp;
                    b.vy *= damp;
                    b.x += b.vx * k;
                    b.y += b.vy * k;
                }

                place(b);
            }

            setLine(c.hubLine, cx, cy, c.hub.x, c.hub.y);

            const sx = c.hub.x + (cx - c.hub.x) * c.mix;
            const sy = c.hub.y + (cy - c.hub.y) * c.mix;

            for (const n of c.nodes) {
                setLine(n.line, sx, sy, n.x, n.y);
            }
        }

        // Pulses travel node -> hub -> core (or node -> core when zoomed).
        for (let q = pulses.length - 1; q >= 0; q--) {
            const p = pulses[q];
            const u = (now - p.t0) / 950;
            const n = p.node;
            const c = n.cluster;

            if (u >= 1) {
                p.dot.remove();
                pulses.splice(q, 1);
                flash(coreBody);
                continue;
            }

            let from = n;
            let to = { x: cx, y: cy };
            let e;

            if (focus === null) {
                if (u < 0.5) {
                    to = c.hub;
                    e = easeOut(u / 0.5);
                } else {
                    from = c.hub;
                    e = easeOut((u - 0.5) / 0.5);

                    if (!p.hubHit) {
                        p.hubHit = true;
                        flash(c.hub.btn);
                    }
                }
            } else {
                e = easeOut(u);
            }

            p.dot.setAttribute('cx', (from.x + (to.x - from.x) * e).toFixed(1));
            p.dot.setAttribute('cy', (from.y + (to.y - from.y) * e).toFixed(1));
        }
    }

    function loop(now) {
        if (!running) return;

        rafId = requestAnimationFrame(loop);
        step(now, false);
    }

    function updateRunning() {
        const should = isMap && W > 0 && visible && !document.hidden && !reduced;

        if (should && !running) {
            running = true;
            last = 0;
            rafId = requestAnimationFrame(loop);
        } else if (!should && running) {
            running = false;
            cancelAnimationFrame(rafId);
        }
    }

    function fire(node) {
        const ripple = document.createElement('span');

        ripple.className = 'sk-ripple';
        ripple.addEventListener('animationend', () => ripple.remove());
        node.btn.appendChild(ripple);

        if (!isMap || reduced) return;

        const dot = document.createElementNS(SVG_NS, 'circle');

        dot.setAttribute('r', '4.5');
        dot.setAttribute('class', 'sk-pulse');
        dot.style.setProperty('--c', node.cluster.color);
        svg.appendChild(dot);

        pulses.push({ dot, node, t0: performance.now(), hubHit: false });
    }

    /* ----- Intro ----- */

    function countUp() {
        const t0 = performance.now();
        const duration = 1000;

        (function tick(now) {
            const u = Math.min(1, (now - t0) / duration);

            if (!hoverNode && !hoverCluster && !pinned && focus === null) {
                coreMain.textContent = Math.round(total * easeOut(u));
            }

            if (u < 1) requestAnimationFrame(tick);
        })(t0);
    }

    function startIntro() {
        started = true;

        const now = performance.now();

        boxes.forEach((b, idx) => {
            const isHub = b === b.cluster.hub;

            b.startAt = reduced ? 0 : now + (isHub ? 160 + b.cluster.i * 80 : 380 + idx * 22);
            b.slot.style.setProperty('--d', `${Math.max(0, b.startAt - now)}ms`);
        });

        lab.classList.add('is-live');

        if (!reduced) {
            countUp();

            // Once everyone has arrived, drop the stagger so later fades are instant.
            setTimeout(() => {
                boxes.forEach(b => b.slot.style.removeProperty('--d'));
            }, 380 + boxes.length * 22 + 700);
        }
    }

    /* ----- Responsive: map <-> list, re-layout on resize ----- */

    function gather() {
        boxes.forEach(b => {
            b.x = W / 2;
            b.y = H / 2;
            b.vx = 0;
            b.vy = 0;
            place(b);
        });
    }

    function sync(force) {
        const width = lab.clientWidth;

        if (!force && width === lastWidth) return;
        lastWidth = width;

        const wantMap = width >= MAP_MIN_WIDTH;

        if (wantMap !== isMap) {
            isMap = wantMap;

            lab.classList.toggle('is-map', isMap);
            lab.classList.toggle('is-list', !isMap);

            if (!isMap) {
                boxes.forEach(b => {
                    b.slot.style.transform = '';
                    b.slot.style.removeProperty('--d');
                });

                stage.style.height = '';
                pulses.splice(0).forEach(p => p.dot.remove());
                needSnap = true;
            }
        }

        if (isMap) {
            stage.style.height = `${Math.round(clampTo(stage.clientWidth * 0.6, 560, 700))}px`;

            W = stage.clientWidth;
            H = stage.clientHeight;

            measure();
            computeAnchors();

            if (reduced) {
                step(performance.now(), true);
            } else if (!started) {
                gather();
            } else if (needSnap) {
                step(performance.now(), true);
            }

            needSnap = false;
        }

        updateRunning();
    }

    /* ----- Events ----- */

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.cat === 'all') {
                setFocus(null);
            } else {
                const idx = Number(btn.dataset.cat);
                setFocus(focus === idx ? null : idx);
            }
        });
    });

    stage.addEventListener('pointerdown', e => {
        lastPointerType = e.pointerType;
    });

    stage.addEventListener('pointermove', e => {
        if (e.pointerType === 'touch') return;

        const rect = stage.getBoundingClientRect();
        pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    });

    stage.addEventListener('pointerleave', () => {
        pointer = null;

        if (hoverNode || hoverCluster) {
            hoverNode = null;
            hoverCluster = null;
            applyHot();
        }
    });

    stage.addEventListener('pointerover', e => {
        if (e.pointerType === 'touch') return;

        const nodeEl = e.target.closest('.sk-node');
        const hubEl = e.target.closest('.sk-hub');

        const node = nodeEl ? nodeByEl.get(nodeEl) : null;
        const cluster = hubEl ? clusters[Number(hubEl.dataset.cat)] : null;

        if (node !== hoverNode || cluster !== hoverCluster) {
            hoverNode = node;
            hoverCluster = cluster;
            applyHot();
        }
    });

    stage.addEventListener('click', e => {
        const hubEl = e.target.closest('.sk-hub');

        if (hubEl) {
            const idx = Number(hubEl.dataset.cat);
            setFocus(focus === idx ? null : idx);
            return;
        }

        const nodeEl = e.target.closest('.sk-node');

        if (nodeEl) {
            const node = nodeByEl.get(nodeEl);

            fire(node);

            // Touch has no hover, so a tap keeps the node highlighted.
            if (lastPointerType === 'touch') {
                pinned = pinned === node ? null : node;
                applyHot();
            }

            return;
        }

        if (pinned) {
            pinned = null;
            applyHot();
        }
    });

    document.addEventListener('click', e => {
        if (pinned && !stage.contains(e.target)) {
            pinned = null;
            applyHot();
        }
    });

    lab.addEventListener('keydown', e => {
        if (e.key === 'Escape' && focus !== null) setFocus(null);
    });

    document.addEventListener('visibilitychange', updateRunning);

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;

            if (visible && !started) startIntro();

            updateRunning();
        }, { threshold: 0.15 }).observe(stage);
    } else {
        visible = true;
        startIntro();
    }

    let resizeFrame = 0;

    const onResize = () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => sync(false));
    };

    if ('ResizeObserver' in window) {
        new ResizeObserver(onResize).observe(lab);
    } else {
        window.addEventListener('resize', onResize);
    }

    sync(true);
    refreshCore();

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => sync(true));
    }
}