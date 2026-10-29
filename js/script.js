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


/* Project cards: image, tags, spotlight hover */

// Allows http(s) URLs and simple relative paths like images/demo.png
const safeImg = (url) =>
    /^(https?:\/\/[^\s"'<>]+|[\w\-./%]+)$/i.test(url || '') ? url : '';

const placeholderSvg = `
    <svg viewBox="0 0 200 110" fill="none" stroke="currentColor" aria-hidden="true">
        <g stroke-width="1" opacity=".55">
            <path d="M25 25 L75 15 M25 25 L75 55 M25 55 L75 15 M25 55 L75 55 M25 55 L75 95 M25 85 L75 55 M25 85 L75 95"/>
            <path d="M75 15 L125 35 M75 55 L125 35 M75 55 L125 75 M75 95 L125 75 M75 15 L125 75"/>
            <path d="M125 35 L175 55 M125 75 L175 55"/>
        </g>
        <g fill="currentColor" stroke="none">
            <circle cx="25" cy="25" r="3.5"/><circle cx="25" cy="55" r="3.5"/><circle cx="25" cy="85" r="3.5"/>
            <circle cx="75" cy="15" r="3.5"/><circle cx="75" cy="55" r="3.5"/><circle cx="75" cy="95" r="3.5"/>
            <circle cx="125" cy="35" r="3.5"/><circle cx="125" cy="75" r="3.5"/>
            <circle cx="175" cy="55" r="5"/>
        </g>
    </svg>`;

function renderProject(project, index) {
    const number = String(index + 1).padStart(2, '0');
    const link = esc(safe(project.link));
    const demo = project.demo ? safe(project.demo) : '#';
    const img = safeImg(project.image);
    const tags = Array.isArray(project.tags) ? project.tags : [];

    return `
        <article class="proj-card">
            <a class="proj-media${img ? '' : ' no-image'}"
               href="${link}"
               target="_blank"
               rel="noopener noreferrer"
               tabindex="-1"
               aria-hidden="true">
                <div class="proj-placeholder">${placeholderSvg}</div>
                ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}
                <span class="proj-index">${number}</span>
                <span class="proj-corner tr"></span>
                <span class="proj-corner bl"></span>
            </a>

            <div class="proj-body">
                <h3>${esc(project.title)}</h3>
                <p>${esc(project.desc)}</p>

                ${tags.length
                    ? `<ul class="proj-tags">${tags
                        .map(tag => `<li>${esc(tag)}</li>`)
                        .join('')}</ul>`
                    : ''}

                <div class="proj-links">
                    <a class="proj-link"
                       href="${link}"
                       target="_blank"
                       rel="noopener noreferrer">
                        View project <span>→</span>
                    </a>
                    ${
                        demo !== '#'
                            ? `<a class="proj-demo"
                                  href="${esc(demo)}"
                                  target="_blank"
                                  rel="noopener noreferrer">
                                   Demo <span>↗</span>
                               </a>`
                            : ''
                    }
                </div>
            </div>
        </article>
    `;
}

/* "Explore All Projects" tile: sits in the grid right after the last project card */

const REPOS_URL = 'https://github.com/mohamedfahadlal?tab=repositories';

function renderExploreTile() {
    return `
        <a class="proj-more"
           href="${REPOS_URL}"
           target="_blank"
           rel="noopener noreferrer"
           aria-label="Explore all my projects on GitHub">
            <span class="proj-more-icon" aria-hidden="true">↗</span>
            <span class="proj-more-title">Explore All Projects</span>
            <span class="proj-more-sub">See everything I've built on GitHub</span>
        </a>
    `;
}

function initProjectCards() {
    const list = $('projects-list');
    if (!list) return;

    // If an image can't be loaded, fall back to the placeholder art.
    list.querySelectorAll('.proj-media img').forEach(img => {
        img.addEventListener('error', () => {
            img.closest('.proj-media').classList.add('no-image');
        });
    });

    // Spotlight follows the cursor.
    list.querySelectorAll('.proj-card').forEach(card => {
        card.addEventListener('pointermove', event => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
            card.style.setProperty('--my', `${event.clientY - rect.top}px`);
        });
    });
}

/* Load portfolio data */

fetch('profile.json')
    .then(response => {
        if (!response.ok) {
            throw new Error('Could not load profile.json');
        }

        return response.json();
    })
    .then(profile => {
        document.title = `${profile.name} | Portfolio`;

        $('name').textContent = profile.name;
        $('tagline').textContent = profile.tagline;
        $('about-bio').textContent = profile.bio;
        

        $('skills-list').innerHTML = (profile.skills || [])
            .map(skill => `<li>${esc(skill)}</li>`)
            .join('');

        $('projects-list').innerHTML = (profile.projects || [])
            .map((project, index) => renderProject(project, index))
            .join('') + renderExploreTile();

        initProjectCards();

        const socialIcons = {
            github: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor"
                        d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.67-3.76-1.32-3.76-1.32-.5-1.29-1.24-1.63-1.24-1.63-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.71 2.62 1.22 3.26.93.1-.72.39-1.22.71-1.5-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.21 1.16-2.99-.12-.29-.5-1.42.11-2.95 0 0 .95-.3 3.05 1.14a10.6 10.6 0 0 1 5.55 0c2.1-1.43 3.05-1.14 3.05-1.14.61 1.53.23 2.66.11 2.95.72.78 1.16 1.77 1.16 2.99 0 4.29-2.61 5.24-5.1 5.51.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"/>
                </svg>
            `,
            linkedin: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor"
                        d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.9H4.98V9.4h2.95v9.5ZM6.45 8.1a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42ZM19 18.9h-2.94v-4.62c0-1.1-.02-2.51-1.53-2.51-1.53 0-1.77 1.2-1.77 2.43v4.7H9.82V9.4h2.82v1.3h.04c.39-.74 1.35-1.52 2.78-1.52 2.97 0 3.53 1.95 3.53 4.49v5.23Z"/>
                </svg>
            `
        };

        $('links').innerHTML = Object.entries(profile.links || {})
            .map(([label, url]) => {
                const key = label.toLowerCase();

                if (!socialIcons[key]) return '';

                return `
                    <a
                        class="social-icon"
                        href="${esc(safe(url))}"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="${esc(label)}"
                        title="${esc(label)}"
                    >
                        ${socialIcons[key]}
                    </a>
                `;
            })
            .join('');
    })
    .catch(error => {
        console.error('Portfolio loading error:', error);

        const tagline = $('tagline');

        if (tagline) {
            tagline.textContent =
                'Please check profile.json and ensure the local server is running.';
        }
    });


/* Interactive hero neural network */

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

    const STEP = 0.42;
    const IDLE_GAP = 3.4;

    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'button');
    canvas.setAttribute(
        'aria-label',
        'Interactive neural network. Click to run another prediction.'
    );

    const rootStyle = getComputedStyle(
        document.documentElement
    );

    const toRgb = (name, fallback) => {
        const value = rootStyle
            .getPropertyValue(name)
            .trim();

        const match =
            /^#([0-9a-f]{6})$/i.exec(value) ||
            /^#([0-9a-f]{6})$/i.exec(fallback);

        const n = parseInt(match[1], 16);

        return [
            (n >> 16) & 255,
            (n >> 8) & 255,
            n & 255
        ];
    };

    const lighten = (color, amount) =>
        color.map(v => v + (255 - v) * amount);

    const mid = toRgb('--accent', '#67e8f9');

    const palette = {
        low: toRgb('--accent-secondary', '#818cf8'),
        mid,
        high: lighten(mid, 0.72),
        muted: toRgb('--muted', '#a0a6b8'),
        text: toRgb('--fg', '#f2f2f7')
    };

    const clamp = (v, lo, hi) =>
        Math.max(lo, Math.min(hi, v));

    function ramp(v) {
        v = clamp(v, 0, 1);

        const t = v < 0.5
            ? v * 2
            : (v - 0.5) * 2;

        const a = v < 0.5
            ? palette.low
            : palette.mid;

        const b = v < 0.5
            ? palette.mid
            : palette.high;

        return [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t
        ];
    }

    const rgba = (color, alpha) =>
        `rgba(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])},${alpha.toFixed(3)})`;

    // Deterministic random values for a stable network layout.
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

    // Connect every neuron to every neuron in the next layer.
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

        const out = values[LAYERS - 1].map(
            v => Math.exp(v * 4)
        );

        const total = out.reduce(
            (sum, v) => sum + v,
            0
        );

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

        if (passes.length > 4) {
            passes.shift();
        }

        lastPassTime = startTime;

        return pass;
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();

        const dpr = Math.min(
            window.devicePixelRatio || 1,
            2
        );

        width = rect.width;
        height = rect.height;

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const left = 36;
        const right = width - 64;
        const top = 58;
        const bottom = 58;

        nodes.forEach(n => {
            n.bx = left +
                n.k * (right - left) / (LAYERS - 1);

            n.by = top +
                (height - top - bottom) *
                (n.i + 0.5) / layerSizes[n.k];

            n.x = n.bx;
            n.y = n.by;
        });

        draw(now());
    }

    const envelope = u =>
        u < 0
            ? 0
            : u < 0.12
                ? u / 0.12
                : Math.exp(-(u - 0.12) * 1.5);

    function draw(t) {
        if (!width || !height) return;

        // Gently move nodes and respond to the pointer.
        nodes.forEach(n => {
            n.x = n.bx + (
                reducedMotion
                    ? 0
                    : Math.sin(t * 0.6 + n.phase) * 4
            );

            n.y = n.by + (
                reducedMotion
                    ? 0
                    : Math.cos(t * 0.5 + n.phase) * 4
            );

            let hover = 0;

            if (pointer) {
                const dx = pointer.x - n.x;
                const dy = pointer.y - n.y;
                const distance = Math.hypot(dx, dy);

                if (distance < 130) {
                    hover = 1 - distance / 130;

                    n.x += dx * 0.14 * hover;
                    n.y += dy * 0.14 * hover;
                }
            }

            let activation = 0;

            passes.forEach(p => {
                const value = p.values[n.k][n.i];

                activation = Math.max(
                    activation,
                    p.flat
                        ? value * 0.9
                        : envelope(
                            t - p.t0 - n.k * STEP
                        ) * value
                );
            });

            n.act = Math.max(
                activation,
                hover * 0.75
            );
        });

        ctx.clearRect(0, 0, width, height);
        ctx.lineCap = 'round';

        // Connections: increased opacity and line thickness.
        edges.forEach(e => {
            const na = nodes[e.a];
            const nb = nodes[e.b];

            const strength = na.act * e.w;

            const opacity =
                (strength > 0.04 ? 0.16 : 0.19) +
                0.72 * strength;

            ctx.strokeStyle = rgba(
                strength > 0.04
                    ? ramp(na.act)
                    : palette.low,
                opacity
            );

            ctx.lineWidth = 0.9 + 1.4 * strength;

            ctx.beginPath();
            ctx.moveTo(na.x, na.y);
            ctx.lineTo(nb.x, nb.y);
            ctx.stroke();
        });

        // Signal dots travel along active connections.
        if (!reducedMotion) {
            passes.forEach(p => {
                edges.forEach(e => {
                    if (
                        e.w < 0.55 ||
                        p.values[e.k][nodes[e.a].i] < 0.5
                    ) {
                        return;
                    }

                    const u =
                        (t - p.t0 - e.k * STEP) / STEP;

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

        // Draw visible neurons with a brighter outline.
        nodes.forEach(n => {
            ctx.fillStyle = rgba(
                ramp(n.act),
                0.3 + 0.7 * n.act
            );

            ctx.strokeStyle = rgba(
                palette.muted,
                0.78
            );

            ctx.lineWidth = 1.15;

            ctx.beginPath();

            ctx.arc(
                n.x,
                n.y,
                3.8 + n.act * 3.8,
                0,
                Math.PI * 2
            );

            ctx.fill();
            ctx.stroke();

            // Glow around active neurons.
            if (n.act > 0.12) {
                ctx.beginPath();

                ctx.arc(
                    n.x,
                    n.y,
                    7 + n.act * 4,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle = rgba(
                    ramp(n.act),
                    0.12 + n.act * 0.12
                );

                ctx.fill();
            }

            if (n.k === LAYERS - 1) {
                ctx.fillStyle = rgba(
                    palette.text,
                    0.55 + 0.4 * n.act
                );
            }
        });

        passes.forEach(p => {
            if (
                !p.shown &&
                (
                    p.flat ||
                    t - p.t0 > (LAYERS - 1) * STEP
                )
            ) {
                p.shown = true;
            }
        });
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

        if (t - lastPassTime > IDLE_GAP) {
            createPass(t, false);
        }

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


/* =====================================
   SCROLL REVEAL OBSERVER
   ===================================== */

(() => {
    const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;

    const sections = document.querySelectorAll(
        'main > section'
    );

    // Avoid animations for users who prefer reduced motion.
    if (reducedMotion) {
        sections.forEach(section => {
            section.classList.add('is-visible');
        });

        return;
    }

    // Reveal sections as they enter the viewport.
    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                } else {
                    // Allows the animation to run again
                    // when the user scrolls back to the section.
                    entry.target.classList.remove('is-visible');
                }
            });
        },
        {
            threshold: 0.12,
            rootMargin: '0px 0px -40px 0px'
        }
    );

    sections.forEach(section => {
        section.classList.add('reveal');
        observer.observe(section);
    });
})();

/* Active navbar link on scroll */
document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.querySelectorAll(".nav-links a");

    const sections = ["home", "about", "skills", "projects", "contact"]
        .map(id => document.getElementById(id))
        .filter(Boolean);

    function setActiveLink(id) {
        navLinks.forEach(link => {
            const isActive = link.getAttribute("href") === `#${id}`;

            link.classList.toggle("active", isActive);

            if (isActive) {
                link.setAttribute("aria-current", "location");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    const observer = new IntersectionObserver(
        entries => {
            const visibleSections = entries
                .filter(entry => entry.isIntersecting)
                .sort(
                    (a, b) =>
                        b.intersectionRatio - a.intersectionRatio
                );

            if (visibleSections.length > 0) {
                setActiveLink(visibleSections[0].target.id);
            }
        },
        {
            rootMargin: "-20% 0px -60% 0px",
            threshold: [0, 0.1, 0.25, 0.5, 0.75]
        }
    );

    sections.forEach(section => observer.observe(section));

    // Ensure Home is active when the page first loads.
    if (window.scrollY < 100) {
        setActiveLink("home");
    }
});