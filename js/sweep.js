// Static layout check: with reduced motion every node sits exactly on its anchor,
// so any overlap / clipping found here is a real layout problem.
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const widths = [860, 900, 1000, 1100, 1200, 1280, 1366, 1440, 1600, 1920];
    let bad = 0;

    for (const w of widths) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        await page.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'networkidle' });
        await page.evaluate(() => document.getElementById('skills').scrollIntoView());
        await page.waitForTimeout(600);

        const r = await page.evaluate(() => {
            const lab = document.getElementById('skills-lab');
            const stage = lab.querySelector('.sk-stage');
            const mode = lab.classList.contains('is-map') ? 'map' : 'list';
            if (mode !== 'map') return { mode };
            const sr = stage.getBoundingClientRect();
            const rects = [...stage.querySelectorAll('.sk-slot')].map(e => ({ t: e.textContent.trim().replace(/\s+/g, ' '), r: e.getBoundingClientRect() }));
            rects.push({ t: 'CORE', r: stage.querySelector('.sk-core-body').getBoundingClientRect() });
            const overlaps = [], outside = [];
            rects.forEach(a => { if (a.r.left < sr.left || a.r.right > sr.right || a.r.top < sr.top || a.r.bottom > sr.bottom) outside.push(a.t); });
            for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
                const a = rects[i].r, b = rects[j].r;
                const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                if (ox > 0.5 && oy > 0.5) overlaps.push(`${rects[i].t} x ${rects[j].t}`);
            }
            return { mode, stage: `${stage.clientWidth}x${stage.clientHeight}`, overlaps, outside };
        });
        if (r.overlaps && (r.overlaps.length || r.outside.length)) bad++;
        console.log(w, JSON.stringify(r));
        await ctx.close();
    }
    console.log(bad ? `${bad} widths with problems` : 'ALL CLEAN');
    await browser.close();
})();