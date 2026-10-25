const $ = (id) => document.getElementById(id);

const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[c]);

const safe = (url) =>
    /^https?:\/\//i.test(url || '') ? url : '#';

/* Load portfolio data */

fetch('profile.json')
    .then(response => {
        if (!response.ok) throw new Error('Could not load profile.json');
        return response.json();
    })
    .then(profile => {
        document.title = `${profile.name} | Portfolio`;

        $('name').textContent = profile.name;
        $('tagline').textContent = profile.tagline;
        $('about-bio').textContent = profile.bio;
        $('hero-bio').textContent = profile.bio;

        $('skills-list').innerHTML = (profile.skills || [])
            .map(skill => `<li>${esc(skill)}</li>`)
            .join('');

        $('projects-list').innerHTML = (profile.projects || [])
            .map(project => `
                <article class="project-card">
                    <div class="project-icon" aria-hidden="true">↗</div>
                    <h3>${esc(project.title)}</h3>
                    <p>${esc(project.desc)}</p>
                    <a href="${esc(safe(project.link))}"
                       target="_blank"
                       rel="noopener noreferrer">
                        Explore project →
                    </a>
                </article>
            `)
            .join('');

        $('links').innerHTML = Object.entries(profile.links || {})
            .map(([label, url]) => `
                <a href="${esc(safe(url))}"
                   target="_blank"
                   rel="noopener noreferrer">${esc(label)} ↗</a>
            `)
            .join('');

        
    })
    .catch(error => {
        console.error('Portfolio loading error:', error);
        $('tagline').textContent =
            'Please check that profile.json is valid and the local server is running.';
    });


/* Neural Network */

(() => {
    const canvas = document.getElementById('neural-network');
    const hero = document.getElementById('hero');

    if (!canvas || !hero) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;

    const layerSizes = [4, 7, 8, 7, 3];
    const LAYERS = layerSizes.length;
    const LABELS = ['cat', 'dog', 'bird'];
    const STEP = 0.42;      // seconds between layers
    const IDLE_GAP = 3.4;   // seconds before an automatic pass

    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'button');


    const rootStyle = getComputedStyle(document.documentElement);

    const toRgb = (name, fallback) => {
        const value = rootStyle.getPropertyValue(name).trim();
        const m = /^#([0-9a-f]{6})$/i.exec(value) || /^#([0-9a-f]{6})$/i.exec(fallback);
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };

    const lighten = (c, t) => c.map(v => v + (255 - v) * t);

    const mid = toRgb('--accent', '#67e8f9');

    const palette = {
        low: toRgb('--accent-secondary', '#818cf8'),
        mid,
        high: lighten(mid, 0.72),
        muted: toRgb('--muted', '#a0a6b8'),
        text: toRgb('--fg', '#f2f2f7')
    };

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    function ramp(v) {
        v = clamp(v, 0, 1);
        const t = v < 0.5 ? v * 2 : (v - 0.5) * 2;
        const a = v < 0.5 ? palette.low : palette.mid;
        const b = v < 0.5 ? palette.mid : palette.high;
        return [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t
        ];
    }

    const rgba = (c, a) =>
        `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`;



    let seed = 7;
    const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };

    const nodes = [];
    const edges = [];
    const starts = [];

    layerSizes.forEach((size, k) => {
        starts.push(nodes.length);

        for (let i = 0; i < size; i++) {
            nodes.push({
                k,
                i,
                bx: 0,
                by: 0,
                x: 0,
                y: 0,
                phase: rand() * Math.PI * 2,
                act: 0
            });
        }
    });

    for (let k = 0; k < LAYERS - 1; k++) {
        for (let i = 0; i < layerSizes[k]; i++) {
            for (let j = 0; j < layerSizes[k + 1]; j++) {
                edges.push({
                    a: starts[k] + i,
                    b: starts[k + 1] + j,
                    k,
                    w: 0.25 + rand() * 0.75
                });
            }
        }
    }

    /* ---- State ---- */

    let width = 0;
    let height = 0;
    let pointer = null;
    let visible = true;
    let passes = [];
    let passCount = 0;
    let lastPassTime = 0;

    const now = () => performance.now() / 1000;

    function createPass(startTime, flat) {
        const values = [];

        for (let k = 0; k < LAYERS; k++) {
            const layer = [];

            for (let i = 0; i < layerSizes[k]; i++) {
                layer.push(0.15 + rand() * 0.85);
            }

            values.push(layer);
        }

        // Softmax over the output layer gives the prediction shown on screen.
        const out = values[LAYERS - 1].map(v => Math.exp(v * 4));
        const total = out.reduce((s, v) => s + v, 0);
        let best = 0;

        out.forEach((v, i) => {
            if (v > out[best]) best = i;
        });

        passCount++;

        const pass = {
            t0: startTime,
            values,
            flat: !!flat,
            shown: false,
            n: passCount,
            label: LABELS[best],
            p: out[best] / total
        };

        passes.push(pass);
        if (passes.length > 4) passes.shift();
        lastPassTime = startTime;

        return pass;
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        width = rect.width;
        height = rect.height;

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const left = 36;
        const right = width - 64;      // room for the output labels
        const top = 58;                // room for the status text
        const bottom = 58;             // room for the caption below

        nodes.forEach(n => {
            n.bx = left + n.k * (right - left) / (LAYERS - 1);
            n.by = top + (height - top - bottom) * (n.i + 0.5) / layerSizes[n.k];
            n.x = n.bx;
            n.y = n.by;
        });

        draw(now());
    }

    const envelope = u =>
        u < 0 ? 0 : (u < 0.12 ? u / 0.12 : Math.exp(-(u - 0.12) * 1.5));

    function draw(t) {
        if (!width || !height) return;

        // Move nodes: gentle drift, plus a pull toward the cursor.
        nodes.forEach(n => {
            n.x = n.bx + (reducedMotion ? 0 : Math.sin(t * 0.6 + n.phase) * 4);
            n.y = n.by + (reducedMotion ? 0 : Math.cos(t * 0.5 + n.phase) * 4);

            let hover = 0;

            if (pointer) {
                const dx = pointer.x - n.x;
                const dy = pointer.y - n.y;
                const d = Math.hypot(dx, dy);

                if (d < 130) {
                    hover = 1 - d / 130;
                    n.x += dx * 0.14 * hover;
                    n.y += dy * 0.14 * hover;
                }
            }

            let a = 0;

            passes.forEach(p => {
                const v = p.values[n.k][n.i];
                a = Math.max(
                    a,
                    p.flat ? v * 0.9 : envelope(t - p.t0 - n.k * STEP) * v
                );
            });

            n.act = Math.max(a, hover * 0.75);
        });

        ctx.clearRect(0, 0, width, height);
        ctx.lineCap = 'round';

        // Connections.
        edges.forEach(e => {
            const na = nodes[e.a];
            const nb = nodes[e.b];
            const s = na.act * e.w;

            ctx.strokeStyle = rgba(
                s > 0.04 ? ramp(na.act) : palette.low,
                (s > 0.04 ? 0.07 : 0.1) + 0.7 * s
            );
            ctx.lineWidth = 0.7 + 1.4 * s;

            ctx.beginPath();
            ctx.moveTo(na.x, na.y);
            ctx.lineTo(nb.x, nb.y);
            ctx.stroke();
        });

        // Signal dots travelling along the strong connections.
        if (!reducedMotion) {
            passes.forEach(p => {
                edges.forEach(e => {
                    if (e.w < 0.55 || p.values[e.k][nodes[e.a].i] < 0.5) return;

                    const u = (t - p.t0 - e.k * STEP) / STEP;
                    if (u < 0 || u > 1) return;

                    const a = nodes[e.a];
                    const b = nodes[e.b];

                    ctx.fillStyle = rgba(ramp(1), 0.95);
                    ctx.beginPath();
                    ctx.arc(
                        a.x + (b.x - a.x) * u,
                        a.y + (b.y - a.y) * u,
                        2.4,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                });
            });
        }

      
        ctx.font = '11px ui-monospace, monospace';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        nodes.forEach(n => {
            ctx.fillStyle = rgba(ramp(n.act), 0.3 + 0.7 * n.act);
            ctx.strokeStyle = rgba(palette.muted, 0.55);
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.arc(n.x, n.y, 3.5 + n.act * 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            if (n.k === LAYERS - 1) {
                ctx.fillStyle = rgba(palette.text, 0.55 + 0.4 * n.act);
                
            }
        });

        // Status text (top left).
        passes.forEach(p => {
            if (!p.shown && (p.flat || t - p.t0 > (LAYERS - 1) * STEP)) {
                p.shown = true;
            }
        });

        const last = passes[passes.length - 1];

       
    }


    function runPass() {
        const t = now();

        if (reducedMotion) {
            passes = [];
            createPass(t, true);
            draw(t);
        } else {
            createPass(t, false);
        }
    }

    function loop() {
        requestAnimationFrame(loop);

        if (!visible || document.hidden) return;

        const t = now();

        if (t - lastPassTime > IDLE_GAP) createPass(t, false);

        draw(t);
    }

    canvas.addEventListener('pointermove', event => {
        const rect = canvas.getBoundingClientRect();

        pointer = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };

        if (reducedMotion) draw(now());
    });

    canvas.addEventListener('pointerleave', () => {
        pointer = null;
        if (reducedMotion) draw(now());
    });

    canvas.addEventListener('click', runPass);

    canvas.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            runPass();
        }
    });

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
        }).observe(hero);
    }

    if ('ResizeObserver' in window) {
        new ResizeObserver(resize).observe(canvas);
    } else {
        window.addEventListener('resize', resize);
    }

    resize();

    if (reducedMotion) {
        createPass(now(), true);
        draw(now());
    } else {
        
        createPass(now() - 1.1, false);
        requestAnimationFrame(loop);
    }
})();