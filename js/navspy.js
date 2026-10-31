/* Active navbar link: scroll-spy.

   The previous IntersectionObserver version only looked at the sections that
   had just changed state, so a section that was *leaving* could re-fire at a
   threshold and overwrite the one that was entering (and very tall sections
   never reached some thresholds at all). That is why the highlight sometimes
   got stuck on the wrong link.

   This version simply asks "which section is under a probe line near the top
   of the viewport?" on every scroll, so it always matches what is on screen,
   and it snaps to the last section when you reach the bottom of the page. */
(() => {
    const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];

    const sections = navLinks
        .map(link => document.getElementById(link.getAttribute('href').slice(1)))
        .filter(Boolean);

    if (!sections.length) return;

    const header = document.querySelector('.site-header');

    let active = '';
    let queued = false;
    let locked = false;      // true right after a nav click, while the page is smooth-scrolling
    let lockTimer = 0;

    // Layout position of an element (ignores the transform used by the reveal animation).
    const pageTop = (el) => {
        let y = 0;

        for (let node = el; node; node = node.offsetParent) {
            y += node.offsetTop;
        }

        return y;
    };

    function setActive(id) {
        if (id === active) return;
        active = id;

        navLinks.forEach(link => {
            const isActive = link.getAttribute('href') === `#${id}`;

            link.classList.toggle('active', isActive);

            if (isActive) {
                link.setAttribute('aria-current', 'location');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    }

    function update() {
        queued = false;

        const navHeight = header ? header.offsetHeight : 0;
        const probe = window.scrollY + navHeight + (window.innerHeight - navHeight) * 0.3;

        let current = sections[0];

        sections.forEach(section => {
            if (pageTop(section) <= probe) current = section;
        });

        const atBottom =
            Math.ceil(window.scrollY + window.innerHeight) >=
            document.documentElement.scrollHeight - 2;

        if (atBottom) current = sections[sections.length - 1];

        setActive(current.id);
    }

    function queueUpdate() {
        if (queued) return;

        queued = true;
        requestAnimationFrame(update);
    }

    function unlock() {
        locked = false;
        queueUpdate();
    }

    // Clicking a link highlights it straight away and ignores the sections the
    // page scrolls past on its way there.
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            setActive(link.getAttribute('href').slice(1));

            locked = true;
            clearTimeout(lockTimer);
            lockTimer = setTimeout(unlock, 1200);
        });
    });

    window.addEventListener('scroll', () => {
        if (locked) {
            clearTimeout(lockTimer);
            lockTimer = setTimeout(unlock, 160);
            return;
        }

        queueUpdate();
    }, { passive: true });

    window.addEventListener('resize', queueUpdate);
    window.addEventListener('load', queueUpdate);

    // Content loading in (profile.json, images, fonts) shifts section positions.
    if ('ResizeObserver' in window) {
        new ResizeObserver(queueUpdate).observe(document.body);
    }

    queueUpdate();
})();