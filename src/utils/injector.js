(async function(){
    if(window.location.href.includes("atdaniellimon.github.io")) window.location.href = "https://daniellimon.uk" + window.location.pathname;
    const routeKey = (function(){
        const p = window.location.pathname;
        if(p === '/') return 'home';
        if(p === '/labs/') return 'labs';
        if(p === '/aboutme/') return 'about';
        if(p === '/contact/') return 'contact';
        return null;
    })();

    const pagesList = {
        "/": "Daniel Limón",
        "/labs/": "Ventures @ Daniel Limón",
        "/aboutme/": "About Daniel Limón",
        "/contact/": "Contact Daniel Limón",
        "/404.html": "404 @ Daniel Limón"
    };
    document.title = pagesList[window.location.pathname] || "Daniel Limón";

    // Favicon + apple-touch
    const icn = document.createElement('link');
    icn.setAttribute('rel', 'shortcut icon');
    icn.href = '/src/assets/img/logo_min.png';
    icn.setAttribute('type', 'image/x-icon');
    const touch = document.createElement('link');
    touch.setAttribute('rel', 'apple-touch-icon');
    touch.href = '/src/assets/img/logo_min.png';
    document.head.appendChild(icn);
    document.head.appendChild(touch);

    // Per-directory cfg.json (header/footer toggle). Never blocks:
    // resolves in parallel; defaults to both header+footer on when the
    // file is missing or malformed.
    const dir = window.location.pathname.replace(/[^/]*$/, '');
    const settingsPromise = fetch(dir + 'cfg.json')
        .then(r => r.ok ? r.json() : Promise.reject('no cfg'))
        .catch(() => ({ header: true, footer: true }));

    // Localise <title>, meta description, and OG/Twitter cards to the
    // loaded language. Static English values in the HTML serve crawlers
    // that don't run JS; this updates them once translations land.
    function applySEO(t){
        if(!t?.meta || !routeKey) return;
        const m = t.meta[routeKey];
        if(!m) return;
        if(m.title) document.title = m.title;
        const setMeta = (sel, val) => { if(!val) return; const el = document.querySelector(sel); if(el) el.setAttribute('content', val); };
        setMeta('meta[name="description"]', m.description);
        setMeta('meta[property="og:description"]', m.description);
        setMeta('meta[property="og:title"]', m.title);
        setMeta('meta[name="twitter:title"]', m.title);
        setMeta('meta[name="twitter:description"]', m.description);
    }

    window.addEventListener("Translations_Ready", async () => {
        Moke.Hydration.register(translation);
        applySEO(translation);

        const settings = await settingsPromise;
        if(settings?.header !== false){
            await Moke.import({ piece: 'Header', def_route: true });
        }
        if(settings?.footer !== false){
            await Moke.import({ piece: 'Footer', def_route: true });
        }

        document.body.classList.add('ready');

        document.body.addEventListener('click', (e) => {
            const el = e.target.closest('a');
            if(!el) return;
            const href = el.getAttribute('href');
            if(!href || !href.trim() || href.startsWith('#')) return;
            const target = (el.target || '').toLowerCase();
            if(target === '_blank') return;
            if(href.startsWith('mailto:') || href.startsWith('tel:')) return;
            if(/^(https?:)?\/\//.test(href) && !href.startsWith(window.location.origin)) return;
            e.preventDefault();
            document.body.classList.remove('ready');
            setTimeout(() => { window.location.href = href; }, 280);
        });

        document.title = pagesList[window.location.pathname] || "Daniel Limón";
    });

    Moke.import({ piece: 'Translations', def_route: true });
})();
