(() => {
    "use strict";

    const canvas = document.getElementById("neural-canvas");

    if (!canvas) {
        console.warn("Neural background: canvas not found.");
        return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    );

    const colors = [
        [139, 92, 246], // Purple
        [6, 182, 212],  // Cyan
        [16, 185, 129]  // Emerald
    ];

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let animationId = null;
    let lastFrame = 0;
    let visible = true;

    const mouse = {
        x: -1000,
        y: -1000,
        active: false
    };

    const connectionDistance = 145;
    const mouseRadius = 180;
    const droplets = [];

    function random(min, max) {
        return Math.random() * (max - min) + min;
    }

    function createParticle() {
        const color = colors[
            Math.floor(Math.random() * colors.length)
        ];

        return {
            x: random(0, width),
            y: random(0, height),
            vx: random(-0.22, 0.22),
            vy: random(-0.22, 0.22),
            radius: random(1.3, 2.8),
            color,
            phase: random(0, Math.PI * 2),
            pulseSpeed: random(0.0008, 0.002)
        };
    }

    function resizeCanvas() {
        const previousWidth = width;
        const previousHeight = height;

        width = window.innerWidth;
        height = window.innerHeight;

        dpr = Math.min(window.devicePixelRatio || 1, 1.75);

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);

        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const targetCount = Math.max(
            30,
            Math.min(100, Math.round((width * height) / 15000))
        );

        if (previousWidth > 0 && particles.length > 0) {
            const scaleX = width / previousWidth;
            const scaleY = height / previousHeight;

            particles.forEach(particle => {
                particle.x *= scaleX;
                particle.y *= scaleY;
            });
        }

        if (particles.length > targetCount) {
            particles.length = targetCount;
        }

        while (particles.length < targetCount) {
            particles.push(createParticle());
        }

        draw(performance.now(), 0);
    }

    function updateParticle(particle, delta) {
        const step = Math.min(delta / 16.67, 2);

        particle.x += particle.vx * step;
        particle.y += particle.vy * step;

        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;

        if (particle.y < -10) particle.y = height + 10;
        if (particle.y > height + 10) particle.y = -10;

        if (mouse.active) {
            const dx = mouse.x - particle.x;
            const dy = mouse.y - particle.y;
            const distance = Math.hypot(dx, dy);

            if (distance > 0 && distance < mouseRadius) {
                const strength =
                    (1 - distance / mouseRadius) * 0.012;

                particle.vx += dx / distance * strength * step;
                particle.vy += dy / distance * strength * step;
            }
        }

        const speed = Math.hypot(particle.vx, particle.vy);
        const maxSpeed = 0.48;

        if (speed > maxSpeed) {
            particle.vx = particle.vx / speed * maxSpeed;
            particle.vy = particle.vy / speed * maxSpeed;
        }

        particle.phase += particle.pulseSpeed * delta;
    }

    function drawConnections() {
        const maxDistanceSquared =
            connectionDistance * connectionDistance;

        for (let i = 0; i < particles.length; i++) {
            const a = particles[i];

            for (let j = i + 1; j < particles.length; j++) {
                const b = particles[j];

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const distanceSquared = dx * dx + dy * dy;

                if (distanceSquared > maxDistanceSquared) continue;

                const distance = Math.sqrt(distanceSquared);

                const opacity =
                    (1 - distance / connectionDistance) * 0.32;

                const [r, g, bColor] = a.color;

                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);

                ctx.strokeStyle =
                    `rgba(${r}, ${g}, ${bColor}, ${opacity})`;

                ctx.lineWidth = 0.7;
                ctx.stroke();
            }
        }
    }

    function drawParticles(time = 0) {
        particles.forEach(particle => {
            const pulse = 0.5 + 0.5 * Math.sin(
                particle.phase + time * 0.0002
            );

            const radius = particle.radius + pulse * 0.45;
            const [r, g, b] = particle.color;

            // Soft glow.
            ctx.beginPath();
            ctx.arc(
                particle.x,
                particle.y,
                radius * 3.2,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.055)`;
            ctx.fill();

            // Neuron center.
            ctx.beginPath();
            ctx.arc(
                particle.x,
                particle.y,
                radius,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `rgba(${r}, ${g}, ${b}, ${0.55 + pulse * 0.4})`;

            ctx.fill();
        });
    }

    function drawMouseConnections() {
        if (!mouse.active) return;

        particles.forEach(particle => {
            const dx = mouse.x - particle.x;
            const dy = mouse.y - particle.y;
            const distance = Math.hypot(dx, dy);

            if (distance > mouseRadius) return;

            const opacity =
                (1 - distance / mouseRadius) * 0.24;

            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(particle.x, particle.y);

            ctx.strokeStyle =
                `rgba(6, 182, 212, ${opacity})`;

            ctx.lineWidth = 0.8;
            ctx.stroke();
        });
    }

    // Create the droplet ripple and a burst of particles.
    function createDroplet(x, y) {
        droplets.push({
            type: "ripple",
            x,
            y,
            radius: 0,
            maxRadius: random(75, 125),
            age: 0,
            duration: 850
        });

        const burstCount = 12;

        for (let i = 0; i < burstCount; i++) {
            const angle =
                (Math.PI * 2 * i) / burstCount +
                random(-0.15, 0.15);

            const speed = random(1, 2.8);

            droplets.push({
                type: "particle",
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: random(1.2, 2.6),
                age: 0,
                duration: random(400, 750),
                color: Math.random() > 0.5
                    ? [6, 182, 212]
                    : [139, 92, 246]
            });
        }
    }

    function drawDroplets(delta = 16) {
        for (let i = droplets.length - 1; i >= 0; i--) {
            const drop = droplets[i];

            drop.age += delta;

            const progress = Math.min(
                drop.age / drop.duration,
                1
            );

            const fade = 1 - progress;

            if (drop.type === "particle") {
                const step = Math.min(delta / 16.67, 2);

                drop.x += drop.vx * step;
                drop.y += drop.vy * step;

                drop.vx *= Math.pow(0.97, step);
                drop.vy *= Math.pow(0.97, step);

                const [r, g, b] = drop.color;

                ctx.beginPath();
                ctx.arc(
                    drop.x,
                    drop.y,
                    drop.radius * fade,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle =
                    `rgba(${r}, ${g}, ${b}, ${fade})`;

                ctx.fill();
            } else {
                const easedProgress =
                    1 - Math.pow(1 - progress, 3);

                drop.radius = drop.maxRadius * easedProgress;

                // Outer cyan ripple.
                ctx.beginPath();
                ctx.arc(
                    drop.x,
                    drop.y,
                    drop.radius,
                    0,
                    Math.PI * 2
                );

                ctx.strokeStyle =
                    `rgba(6, 182, 212, ${fade * 0.65})`;

                ctx.lineWidth = 1.6 * fade;
                ctx.stroke();

                // Inner purple ripple.
                ctx.beginPath();
                ctx.arc(
                    drop.x,
                    drop.y,
                    drop.radius * 0.68,
                    0,
                    Math.PI * 2
                );

                ctx.strokeStyle =
                    `rgba(139, 92, 246, ${fade * 0.4})`;

                ctx.lineWidth = 1.1 * fade;
                ctx.stroke();

                // Flash at the point of impact.
                ctx.beginPath();
                ctx.arc(
                    drop.x,
                    drop.y,
                    5 * fade,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle =
                    `rgba(100, 230, 255, ${fade})`;

                ctx.fill();
            }

            if (progress >= 1) {
                droplets.splice(i, 1);
            }
        }
    }

    function draw(time = 0, delta = 16) {
        ctx.clearRect(0, 0, width, height);

        drawConnections();
        drawMouseConnections();
        drawParticles(time);
        drawDroplets(delta);
    }

    function animate(time) {
        if (!visible || document.hidden) {
            animationId = null;
            return;
        }

        if (time - lastFrame >= 16) {
            const delta = lastFrame
                ? Math.min(time - lastFrame, 50)
                : 16;

            lastFrame = time;

            if (!reducedMotion.matches) {
                particles.forEach(particle => {
                    updateParticle(particle, delta);
                });
            }

            draw(time, delta);
        }

        animationId = requestAnimationFrame(animate);
    }

    function startAnimation() {
        if (!visible || document.hidden) return;

        if (animationId !== null) return;

        lastFrame = 0;
        animationId = requestAnimationFrame(animate);
    }

    function stopAnimation() {
        if (animationId !== null) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    window.addEventListener("pointermove", event => {
        mouse.x = event.clientX;
        mouse.y = event.clientY;
        mouse.active = true;
    }, { passive: true });

    window.addEventListener("blur", () => {
        mouse.active = false;
    });

    window.addEventListener("click", event => {
        // Ignore clicks on interactive elements.
        if (
            event.target.closest(
                "a, button, input, textarea, select, " +
                "[role='button'], canvas#neural-network"
            )
        ) {
            return;
        }

        createDroplet(event.clientX, event.clientY);

        // Render immediately when animation is paused.
        if (reducedMotion.matches || document.hidden) {
            draw(performance.now(), 16);
        }
    });

    window.addEventListener("resize", resizeCanvas, {
        passive: true
    });

    document.addEventListener("visibilitychange", () => {
        visible = !document.hidden;

        if (visible) {
            startAnimation();
        } else {
            stopAnimation();
        }
    });

    reducedMotion.addEventListener("change", () => {
        stopAnimation();

        if (!reducedMotion.matches) {
            startAnimation();
        } else {
            draw(performance.now(), 16);
        }
    });

    resizeCanvas();
    startAnimation();
})();