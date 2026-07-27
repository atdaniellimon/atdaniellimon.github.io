// ============================================
// Labs — holding subsidiary cards from XML.
// Each card is a company profile (sector, name,
// what the business does) — NOT a repo link.
// Grids marked [data-reveal][data-stagger] get
// scroll-staggered children via motion.js.
// ============================================
(async function(){
    let ventures = [];

    async function getVentures(){
        const response = await fetch('/labs/experiments.xml');
        if(!response.ok) throw new Error("Failed to fetch XML");
        const text = await response.text();

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const ventureNodes = xmlDoc.querySelectorAll('venture');

        ventures = Array.from(ventureNodes).map(node => ({
            id: node.getAttribute('id'),
            name: node.querySelector('name')?.textContent || 'Unnamed',
            sector: node.querySelector('sector')?.textContent || '',
            short_desc: node.querySelector('short_desc')?.textContent || '',
            description: node.querySelector('description')?.textContent || '',
            redirect: node.querySelector('redirect')?.textContent || ''
        }));

        if (window.Moke && Moke.Hydration) Moke.Hydration.register({ ventures });
    }

    function cardMarkup(venture, i){
        let styleString = `--stagger:${i};`;
        
        if(venture.redirect){
            styleString += ' cursor: pointer;';
        }

        return `
            <article class="lab-card" style="${styleString}" ${venture.redirect ? `onclick="window.open('${venture.redirect}')"` : ''}>
                <div class="lab-header">
                    <span class="lab-sector">${venture.sector}</span>
                    <span class="subsidiary-badge">${String(i + 1).padStart(2, '0')} · Subsidiary</span>
                </div>
                <div class="lab-content">
                    <h2>${venture.name}</h2>
                    <p class="lab-desc-short">${venture.short_desc}</p>
                    <p class="lab-desc-long">${venture.description}</p>
                </div>
            </article>
        `;
    }


    async function renderVentures(){
        const grids = document.querySelectorAll('.labs-grid');
        if(!grids.length || !ventures.length) return;

        const html = ventures.map((v, i) => cardMarkup(v, i)).join('');

        grids.forEach((grid) => {
            grid.innerHTML += html;
            // Re-evaluate stagger so the CSS delay calc sees fresh children
            if(grid.hasAttribute('data-stagger')){
                Array.from(grid.children).forEach((child, i) => child.style.setProperty('--stagger', i));
            }
        });
    }

    await getVentures();
    await renderVentures();
})();
