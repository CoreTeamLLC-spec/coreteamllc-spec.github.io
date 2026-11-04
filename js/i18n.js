window.I18n = (function () {
    const LANGS = ['ru', 'en'];
    const DEFAULT_LANG = 'en';
    const STORAGE_KEY = 'ct-lang';

    let currentLang = DEFAULT_LANG;
    let dict = {};

    function getNested(obj, path) {
        return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
    }

    async function load(lang) {
        if (!LANGS.includes(lang)) lang = DEFAULT_LANG;
        const file = lang === 'ru' ? 'russian.json' : 'english.json';
        try {
            const res = await fetch('./lang/' + file);
            if (!res.ok) throw new Error('Lang file not found: ' + file);
            dict = await res.json();
            currentLang = lang;
            localStorage.setItem(STORAGE_KEY, lang);
            document.documentElement.setAttribute('lang', lang);
            apply();
            return true;
        } catch (e) {
            console.warn('[i18n]', e.message);
            if (lang !== DEFAULT_LANG) return load(DEFAULT_LANG);
            return false;
        }
    }

    function t(key, fallback) {
        const value = getNested(dict, key);
        return value !== undefined ? value : (fallback !== undefined ? fallback : key);
    }

    function apply() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const value = t(key);
            if (value !== undefined) el.textContent = value;
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const value = t(key);
            if (value !== undefined) el.setAttribute('placeholder', value);
        });

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const value = t(key);
            if (value !== undefined) el.setAttribute('title', value);
        });

        document.querySelectorAll('[data-lang]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
        });

        const hash = location.hash;
        if (hash.startsWith('#project/') && window.__rerenderProject) {
            window.__rerenderProject();
        }
    }

    function getLang() {
        return currentLang;
    }

    function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            showWelcomeModal();
            return load(DEFAULT_LANG);
        }
        return load(saved);
    }

    function showWelcomeModal() {
        const modal = document.getElementById('langModal');
        if (!modal) return;
        modal.classList.add('active');
    }

    function bindEvents() {
        document.querySelectorAll('.lang-modal-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const lang = btn.dataset.lang;
                await load(lang);
                const modal = document.getElementById('langModal');
                if (modal) modal.classList.remove('active');
            });
        });

        const globeBtn = document.getElementById('globeBtn');
        const dropdown = document.getElementById('langDropdown');
        if (globeBtn && dropdown) {
            globeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('open');
                globeBtn.classList.toggle('active');
            });

            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && e.target !== globeBtn) {
                    dropdown.classList.remove('open');
                    globeBtn.classList.remove('active');
                }
            });
        }

        document.querySelectorAll('.lang-dropdown-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const lang = item.dataset.lang;
                await load(lang);
                if (dropdown) dropdown.classList.remove('open');
                if (globeBtn) globeBtn.classList.remove('active');
            });
        });
    }

    return { init, t, apply, getLang, load, bindEvents };
})();