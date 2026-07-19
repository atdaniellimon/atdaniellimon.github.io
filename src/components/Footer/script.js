/*
    Footer — Sleek slim
    Version 3.0  ·  Made by Daniel Limón
*/
(async function(){
    const footerHTML = `
        <div class="footer-inner">
            <div class="footer-brand">
                <div class="fb-mark">
                    <span class="fb-dot"></span>
                    <span class="fb-name">Daniel Limón</span>
                </div>
                <p class="fb-tag">${translation.footer.tagline}</p>
            </div>
            <div class="footer-cols">
                <div class="footer-col">
                    <h4>${translation.footer.links_title}</h4>
                    <a href="/labs/">${translation.header.labs}</a>
                    <a href="/aboutme/">${translation.header.about_me}</a>
                    <a href="/contact/">${translation.header.contact}</a>
                </div>
                <div class="footer-col">
                    <h4>${translation.footer.status_title}</h4>
                    <span class="fb-status"><span class="fb-pulse"></span>${translation.footer.status_available}</span>
                    <span class="fb-loc">${translation.footer.handcraft}</span>
                </div>
            </div>
            <div class="footer-social">
                <a href="https://github.com/atdaniellimon" target="_blank" rel="noopener">GitHub</a>
                <a href="https://linkedin.com/in/daniel-limon" target="_blank" rel="noopener">LinkedIn</a>
                <a href="https://twitter.com/atdaniellimon" target="_blank" rel="noopener">Twitter</a>
            </div>
        </div>
        <div class="footer-bottom">
            <p>${translation.footer.donot}</p>
        </div>
    `;
    const footerCSS = `
        footer {
            width: 92vw; max-width: var(--max);
            margin: 0 auto 6vh;
            padding: 48px 44px 32px;
            border-top: 1px solid var(--line);
            position: relative;
        }
        .footer-inner {
            display: grid;
            grid-template-columns: 1.4fr 1fr 1fr;
            gap: 48px;
            padding-bottom: 36px;
            border-bottom: 1px solid var(--line);
            margin-bottom: 22px;
        }
        .footer-brand .fb-mark { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .fb-dot { width: 9px; height: 9px; border-radius: 50%; background: linear-gradient(135deg, var(--brass), var(--brass-2)); box-shadow: 0 0 0 3px rgba(205,174,99,.16); }
        .fb-name { font-family: 'Instrument Serif', serif; font-size: 1.2rem; color: var(--platinum); }
        .fb-tag { font-size: 0.86rem; line-height: 1.65; color: var(--steel); max-width: 36ch; font-style: italic; font-family: 'Instrument Serif', serif; }
        .footer-col h4, .footer-social-title {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.56rem; font-weight: 600; text-transform: uppercase;
            letter-spacing: 2px; color: var(--brass); margin: 0 0 16px;
        }
        .footer-col a {
            display: block; text-decoration: none;
            font-family: 'Inter', sans-serif; font-size: 0.9rem;
            color: var(--platinum-2); margin-bottom: 9px;
            transition: color 160ms ease, transform 160ms ease;
        }
        .footer-col a:hover { color: var(--platinum); transform: translateX(3px); }
        .fb-status { display: inline-flex; align-items: center; gap: 9px; font-size: 0.86rem; color: var(--platinum-2); margin-bottom: 8px; }
        .fb-pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--brass); box-shadow: 0 0 0 0 rgba(205,174,99,.5); animation: fbPulse 2.4s ease-in-out infinite; }
        @keyframes fbPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(205,174,99,.5); opacity: 1; } 60% { box-shadow: 0 0 0 6px rgba(205,174,99,0); opacity: .55; } }
        .fb-loc { display: block; font-size: 0.82rem; color: var(--steel-2); font-family: 'JetBrains Mono', monospace; letter-spacing: 0.4px; }
        .footer-social { display: flex; flex-direction: column; gap: 10px; align-items: flex-end; }
        .footer-social-title { margin-bottom: 6px; }
        .footer-social a {
            text-decoration: none;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.62rem; text-transform: uppercase; letter-spacing: 1.5px;
            color: var(--steel); padding: 7px 14px; border-radius: 999px;
            border: 1px solid var(--line);
            transition: color 180ms ease, border-color 180ms ease, transform 160ms var(--ease-out);
        }
        .footer-social a:hover { color: var(--platinum); border-color: var(--brass); transform: translateY(-1px); }
        .footer-bottom { text-align: center; }
        .footer-bottom p { font-family: 'JetBrains Mono', monospace; font-size: 0.62rem; letter-spacing: 1px; color: var(--steel-2); }
        @media screen and (max-width: 880px) {
            footer { padding: 40px 24px 28px; }
            .footer-inner { grid-template-columns: 1fr; gap: 32px; }
            .footer-social { align-items: flex-start; }
        }
    `;
    const footer = document.createElement('footer');
    footer.innerHTML = footerHTML;
    const css = document.createElement('style'); css.innerHTML = footerCSS;
    document.head.appendChild(css);
    document.body.appendChild(footer);
})();
