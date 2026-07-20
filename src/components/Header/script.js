/*
    Header — Sleek glass
    Version 3.0  ·  Made by Daniel Limón
*/

(async function(){
    const headerHTML = `
        <a class="brand" data-page="/" aria-label="Daniel Limón">
            <img src="/src/assets/img/logo.png">
        </a>
        <nav class="nav-primary">
            <a href="/labs/" class="nav-link" data-page="/labs/">${translation.header.labs}</a>
            <a href="/aboutme/" class="nav-link" data-page="/aboutme/">${translation.header.about_me}</a>
        </nav>
        <a href="/contact/" class="nav-cta">${translation.header.contact} →</a>
        <button class="hamburger" aria-label="Menu" aria-expanded="false">☰</button>
        <div class="mobile-menu">
            <a href="/" data-page="/">${translation.header.home}</a>
            <a href="/labs/" data-page="/labs/">${translation.header.labs}</a>
            <a href="/aboutme/" data-page="/aboutme/">${translation.header.about_me}</a>
            <a href="/contact/" data-page="/contact/">${translation.header.contact}</a>
        </div>
    `;

    const headerCSS = `
        header.main-lemons-header {
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 10000;
            height: 64px;
            display: flex;
            align-items: center;
            gap: 28px;
            padding: 0 clamp(16px, 4vw, 48px);
            background: rgba(10, 11, 13, 0.55);
            backdrop-filter: blur(22px) saturate(1.3);
            -webkit-backdrop-filter: blur(22px) saturate(1.3);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            transition: background 280ms ease, border-color 280ms ease;
        }
        header.main-lemons-header.scrolled {
            background: rgba(10, 11, 13, 0.82);
            border-bottom-color: rgba(255, 255, 255, 0.09);
        }

        .brand {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            cursor: pointer;
            margin-right: auto;
            height: 90%;
        }

        header.main-lemons-header img{
            height: 80%;
            filter: invert();
        }

        .nav-primary {
            display: flex;
            gap: 6px;
            align-items: center;
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
        }
        .nav-link {
            font-family: 'Inter', sans-serif;
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--steel);
            text-decoration: none;
            padding: 8px 14px;
            border-radius: 999px;
            transition: color 180ms ease, background 180ms ease;
            position: relative;
        }
        .nav-link:hover { color: var(--platinum); background: rgba(255, 255, 255, 0.05); }
        .nav-link.active { color: var(--platinum); background: rgba(255, 255, 255, 0.06); }
        .nav-link.active::after {
            content: '';
            position: absolute;
            bottom: -1px; left: 50%; transform: translateX(-50%);
            width: 18px; height: 2px; border-radius: 1px;
            background: var(--brass);
        }

        .nav-cta {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-family: 'Inter', sans-serif;
            font-size: 0.82rem;
            font-weight: 500;
            text-decoration: none;
            color: #1a1408;
            background: linear-gradient(180deg, var(--brass), var(--brass-2));
            padding: 9px 18px;
            border-radius: 999px;
            box-shadow: 0 8px 20px -12px rgba(205, 174, 99, 0.7);
            transition: transform 160ms var(--ease-out), box-shadow 220ms ease;
        }
        .nav-cta:hover { transform: translateY(-1px); box-shadow: 0 12px 26px -12px rgba(205, 174, 99, 0.85); }
        .nav-cta:active { transform: scale(0.98); }

        .hamburger {
            display: none;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--line-2);
            color: var(--platinum);
            border-radius: var(--r);
            width: 38px; height: 38px;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
            transition: border-color 180ms ease, background 180ms ease;
        }
        .hamburger:hover { border-color: var(--brass); background: rgba(205, 174, 99, 0.06); }

        .mobile-menu {
            position: absolute;
            top: 72px; right: clamp(16px, 4vw, 48px);
            display: none;
            flex-direction: column;
            gap: 4px;
            min-width: 224px;
            padding: 12px;
            background: rgba(16, 18, 22, 0.94);
            backdrop-filter: blur(22px);
            border: 1px solid var(--line);
            border-radius: var(--r);
            box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.8);
        }
        .mobile-menu.open {
            display: flex;
            animation: menuIn 220ms var(--ease-out);
        }
        .mobile-menu a {
            text-decoration: none;
            font-family: 'Inter', sans-serif;
            font-weight: 500;
            font-size: 0.9rem;
            color: var(--platinum-2);
            padding: 12px 14px;
            border-radius: 999px;
            transition: background 160ms ease, color 160ms ease;
        }
        .mobile-menu a:hover { background: rgba(255, 255, 255, 0.05); color: var(--platinum); }
        .mobile-menu a.active { color: var(--brass); background: rgba(205, 174, 99, 0.08); }
        @keyframes menuIn {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        @media screen and (max-width: 880px) {
            .nav-primary, .nav-cta { display: none; }
            .hamburger { display: block; }
            .nav-primary { left: 0; transform: none; }
        }

        div[header-space] { height: 0; }
        div[header-gradient] { display: none; }
    `;

    const header = document.createElement('header');
    header.classList.add('main-lemons-header');
    header.innerHTML = headerHTML;
    const css = document.createElement('style');
    css.innerHTML = headerCSS;
    document.head.appendChild(css);
    document.body.prepend(header);

    const space = document.createElement('div'); space.setAttribute('header-space', 'true');
    const grad  = document.createElement('div'); grad.setAttribute('header-gradient', 'true');
    document.body.prepend(grad);
    document.body.prepend(space);

    // Active page marker
    const path = window.location.pathname;
    header.querySelectorAll('[data-page]').forEach(a => {
        if (a.dataset.page === path) a.classList.add('active');
    });

    // Smooth internal navigation (page fade). stopPropagation keeps the
    // global injector handler from re-firing on these (which would reload
    // the page on a same-route click instead of scrolling to top).
    header.querySelectorAll('a[data-page]').forEach(a => {
        a.addEventListener('click', (e) => {
            if (menu?.classList.contains('open')) { menu.classList.remove('open'); burger.textContent = '☰'; burger.setAttribute('aria-expanded', 'false'); }
            if (a.dataset.page === path) { e.preventDefault(); e.stopPropagation(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
            e.preventDefault(); e.stopPropagation();
            document.body.classList.remove('ready');
            setTimeout(() => { window.location.href = a.dataset.page; }, 280);
        });
    });

    // Scrolled state (nav intensifies)
    const onScroll = () => {
        const y = window.scrollY;
        header.classList.toggle('scrolled', y > 12);
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Hamburger
    const burger = header.querySelector('.hamburger');
    const menu = header.querySelector('.mobile-menu');
    burger.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = menu.classList.toggle('open');
        burger.textContent = open ? '✕' : '☰';
        burger.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', (e) => {
        if (!header.contains(e.target)) {
            menu.classList.remove('open');
            burger.textContent = '☰';
            burger.setAttribute('aria-expanded', 'false');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu.classList.contains('open')) {
            menu.classList.remove('open');
            burger.textContent = '☰';
            burger.setAttribute('aria-expanded', 'false');
        }
    });
})();
