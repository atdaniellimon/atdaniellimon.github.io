var translation = null;

(async function(){
    const lang = (navigator.languages ? navigator.languages[0] : navigator.language).split('-')[0] || 'en';

    async function fetchLangauge(which){
        const request = new Request(`/src/assets/langs/${which}.json`);
        await fetch(request).then(async (response) => {
            if (!response.ok) {
                await fetchLangauge('en');
                throw new Error(`Status: ${response.status}, http error found.`);
            }

            return response.json();
        }).then((json) => {
            translation = json;
            window.dispatchEvent(new CustomEvent('Translations_Ready'));
        })
    }

    await fetchLangauge(lang);
})();