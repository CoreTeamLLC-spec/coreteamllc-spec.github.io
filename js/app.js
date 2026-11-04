const MUSIC_FILE = './data/music.json';
const PROJECTS_INDEX = './data/projects/index.json';
const PROJECTS_DIR = './data/projects/';

function t(key, fallback) {
    return window.I18n ? window.I18n.t(key, fallback) : fallback;
}

const appState = { projects: [] };
const appUi = {
    trackList: document.getElementById('trackList'),
    projectsGrid: document.getElementById('projectsGrid'),
    projectPage: document.getElementById('projectPage')
};

function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('view-' + name);
    if (target) target.classList.add('active');
    
    document.querySelectorAll('.side-nav a').forEach(a => {
        a.classList.toggle('active', a.dataset.view === name);
    });
    document.querySelector('.main').scrollTop = 0;
}

document.querySelectorAll('.side-nav a').forEach(a => {
    a.addEventListener('click', (e) => {
        e.preventDefault();
        const view = a.dataset.view;
        if (view === 'home') location.hash = '';
        else location.hash = '#' + view;
    });
});

function getProjectIcon(project, size = 128) {
    if (project.icon && typeof project.icon === 'object') {
        const sizes = Object.keys(project.icon).map(Number).sort((a, b) => a - b);
        if (project.icon[size]) return project.icon[size];
        const bigger = sizes.find(s => s >= size);
        return project.icon[bigger || sizes[sizes.length - 1]];
    }
    return project.logo || project.cover || '';
}
function getProjectCover(project) { return project.cover || project.logo || ''; }
function getLinkIcon(link, type) {
    const url = (link.url || '').toLowerCase();
    const ICON_DOWNLOAD = '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>';
    const ICON_EXTERNAL = '<path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>';
    const ICON_DRIVE = '<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>';
    if (type === 'download') return ICON_DOWNLOAD;
    if (url.includes('drive.google.com') || url.includes('yandex')) return ICON_DRIVE;
    return ICON_EXTERNAL;
}

async function loadProjects() {
    try {
        const idxRes = await fetch(PROJECTS_INDEX);
        if (!idxRes.ok) throw new Error(t('errors.projectsNotFound', 'Файл data/projects/index.json не найден'));
        const names = await idxRes.json();
        if (!Array.isArray(names) || names.length === 0) {
            appUi.projectsGrid.innerHTML = `<div class="empty-state">${t('projects.empty', 'Проектов пока нет.')}</div>`;
            return;
        }
        const results = await Promise.allSettled(
            names.map(name => fetch(PROJECTS_DIR + name + '.json').then(r => {
                if (!r.ok) throw new Error(t('errors.projectNotFound', 'Не найден') + `: ${name}.json`);
                return r.json();
            }))
        );
        appState.projects = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        renderProjects();
    } catch (e) {
        appUi.projectsGrid.innerHTML = `<div class="empty-state" style="color:#ff5c8a;">${e.message}</div>`;
    }
}

function renderProjects() {
    if (!appState.projects.length) {
        appUi.projectsGrid.innerHTML = `<div class="empty-state">${t('projects.empty', 'Проектов пока нет.')}</div>`;
        return;
    }
    appUi.projectsGrid.innerHTML = '';
    appState.projects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card';
        const cover = getProjectCover(project);
        card.innerHTML = `
            <div class="project-card-logo">${cover ? `<img src="${cover}" alt="${project.title}">` : ''}</div>
            <div class="project-card-body">
                <div class="project-card-title">${project.title}</div>
                <div class="project-card-desc">${project.description || ''}</div>
            </div>
        `;
        card.addEventListener('click', () => { location.hash = '#project/' + project.id; });
        appUi.projectsGrid.appendChild(card);
    });
}

function openProject(id) {
    const project = appState.projects.find(p => p.id === id);
    if (!project) { showView('projects'); return; }

    window.__currentProjectId = project.id;
    window.__rerenderProject = () => {
        if (window.__currentProjectId) openProject(window.__currentProjectId);
    };

    const bigIcon = getProjectIcon(project, 256);
    const coverImg = getProjectCover(project);
    const linksHtml = (project.links || []).map(link => {
        let type = link.type;
        if (!type) {
            const isLocal = link.url.startsWith('./') || link.url.startsWith('/') || link.url.startsWith('../');
            type = isLocal ? 'download' : 'external';
        }
        const isExternal = type === 'external';
        const icon = getLinkIcon(link, type);
        const attrs = isExternal
            ? `href="${link.url}" target="_blank" rel="noopener noreferrer"`
            : `href="${link.url}" download`;
        return `<a class="play-link ${isExternal ? 'external' : ''}" ${attrs}><svg viewBox="0 0 24 24">${icon}</svg><span>${link.label}</span></a>`;
    }).join('');

    const screenshots = project.screenshots || [];
    const screenshotsHtml = screenshots.length
        ? screenshots.map((src, i) => `<div class="screenshot-item" data-index="${i}"><img src="${src}" alt="Screenshot ${i + 1}" loading="lazy"></div>`).join('')
        : '';

    const inlineTags = [
        project.category ? `<span class="play-tag">${project.category}</span>` : '',
        project.version ? `<span class="play-tag">v${project.version}</span>` : ''
    ].filter(Boolean).join('');

    const metaParts = [
        project.updated ? `${t('projects.updated', 'Обновлено')} ${project.updated}` : '',
        project.size ? `${project.size}` : ''
    ].filter(Boolean);
    const metaNextToBtn = metaParts.length
        ? `<span class="download-meta">${metaParts.join(' <span class="meta-dot">•</span> ')}</span>`
        : '';

    appUi.projectPage.innerHTML = `
        <button class="back-btn" id="backBtn">
            <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            ${t('projects.back', 'Назад к проектам')}
        </button>

        <div class="play-banner">
            <div class="play-banner-bg" ${coverImg ? `style="background-image: url('${coverImg}')"` : ''}></div>
            <div class="play-banner-content">
                <div class="play-icon">${bigIcon ? `<img src="${bigIcon}" alt="${project.title}">` : ''}</div>
                <div class="play-header-info">
                    <h1>${project.title}</h1>
                    ${project.developer ? `<div class="play-developer">${project.developer}</div>` : ''}
                    <div class="play-tags">${inlineTags}</div>
                </div>
            </div>
        </div>

        ${linksHtml ? `
            <div class="download-section">
                <div class="download-row">
                    <button class="download-btn" id="downloadBtn">
                        ${t('projects.download', 'Скачать')}
                        <svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                    </button>
                    ${metaNextToBtn}
                </div>
                <div class="download-sources" id="downloadSources">
                    <div class="download-sources-inner">${linksHtml}</div>
                </div>
            </div>
        ` : ''}

        <div class="play-section">
            <h2>${t('projects.description', 'Описание')}</h2>
            <p class="play-description">${project.fullDescription || project.description || ''}</p>
        </div>

        ${screenshotsHtml ? `
            <div class="play-section">
                <h2>${t('projects.screenshots', 'Скриншоты')}</h2>
                <div class="screenshots-carousel-wrapper">
                    <button class="carousel-arrow carousel-prev" id="carouselPrev">‹</button>
                    <div class="screenshots-grid" id="screenshotsGrid">${screenshotsHtml}</div>
                    <button class="carousel-arrow carousel-next" id="carouselNext">›</button>
                </div>
            </div>
        ` : ''}
    `;

    showView('project-page');
    document.getElementById('backBtn').addEventListener('click', () => { location.hash = '#projects'; });

    const dlBtn = document.getElementById('downloadBtn');
    const dlSources = document.getElementById('downloadSources');
    if (dlBtn && dlSources) {
        dlBtn.addEventListener('click', () => {
            dlSources.classList.toggle('open');
            dlBtn.classList.toggle('active');
        });
    }

    if (screenshots.length) {
        const grid = document.getElementById('screenshotsGrid');
        const prevBtn = document.getElementById('carouselPrev');
        const nextBtn = document.getElementById('carouselNext');
        if (screenshots.length <= 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }
        const scrollAmount = 300;
        prevBtn.addEventListener('click', () => grid.scrollBy({ left: -scrollAmount, behavior: 'smooth' }));
        nextBtn.addEventListener('click', () => grid.scrollBy({ left: scrollAmount, behavior: 'smooth' }));

        appUi.projectPage.querySelectorAll('.screenshot-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = Number(item.dataset.index) || 0;
                openLightbox(screenshots, idx);
            });
        });
    }
}

function openLightbox(images, startIndex) {
    let current = startIndex;
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `
        <div class="lightbox-backdrop"></div>
        <button class="lightbox-arrow lightbox-prev" title="Back">‹</button>
        <img src="${images[current]}" alt="">
        <button class="lightbox-arrow lightbox-next" title="Next">›</button>
        <div class="lightbox-counter">${current + 1} / ${images.length}</div>
        <button class="lightbox-close" title="Close">✕</button>
    `;
    document.body.appendChild(lb);
    requestAnimationFrame(() => lb.classList.add('open'));

    const imgEl = lb.querySelector('img');
    const counterEl = lb.querySelector('.lightbox-counter');
    const prevBtn = lb.querySelector('.lightbox-prev');
    const nextBtn = lb.querySelector('.lightbox-next');

    if (images.length <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        counterEl.style.display = 'none';
    }

    const render = () => {
        imgEl.src = images[current];
        counterEl.textContent = `${current + 1} / ${images.length}`;
    };
    const goPrev = () => { current = (current - 1 + images.length) % images.length; render(); };
    const goNext = () => { current = (current + 1) % images.length; render(); };
    const close = () => {
        lb.classList.remove('open');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => lb.remove(), 300);
    };
    const onKey = (e) => {
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') goPrev();
        else if (e.key === 'ArrowRight') goNext();
    };

    lb.querySelector('.lightbox-backdrop').addEventListener('click', close);
    lb.querySelector('.lightbox-close').addEventListener('click', close);
    prevBtn.addEventListener('click', goPrev);
    nextBtn.addEventListener('click', goNext);
    document.addEventListener('keydown', onKey);

    let touchStartX = 0, touchEndX = 0;
    lb.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) { if (diff > 0) goNext(); else goPrev(); }
    }, { passive: true });
}

async function loadTracks() {
    try {
        const res = await fetch(MUSIC_FILE);
        if (!res.ok) throw new Error(t('errors.musicNotFound', 'Файл data/music.json не найден'));
        const data = await res.json();

        const tracks = data.map(item => {
            const isYT = item.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
            if (isYT) {
                return {
                    type: 'youtube', id: isYT[1],
                    title: item.title || 'YouTube', author: item.author || 'YouTube',
                    cover: `https://img.youtube.com/vi/${isYT[1]}/mqdefault.jpg`,
                    duration: null
                };
            }
            return {
                type: 'audio', src: item.url,
                title: item.title || 'Аудио', author: item.author || 'Файл',
                cover: item.cover || '',
                duration: null
            };
        });

        window.Player.setTracks(tracks);
        renderTracks(tracks);
        await preloadDurations(tracks);
    } catch (e) {
        appUi.trackList.innerHTML = `<div class="empty-state" style="color:#ff5c8a;">${e.message}</div>`;
    }
}

async function preloadDurations(tracks) {
    const promises = tracks.map((t, i) => {
        if (t.type !== 'audio') return Promise.resolve();
        return new Promise(resolve => {
            const a = new Audio();
            a.preload = 'metadata';
            a.src = t.src;
            a.addEventListener('loadedmetadata', () => {
                t.duration = a.duration;
                updateTrackDurationUI(i, a.duration);
                resolve();
            });
            a.addEventListener('error', () => resolve());
        });
    });
    await Promise.all(promises);
}

function updateTrackDurationUI(index, dur) {
    const el = appUi.trackList.children[index];
    if (!el) return;
    const durEl = el.querySelector('.track-duration');
    if (durEl) durEl.textContent = window.Player.formatTime(dur);
}

const COVER_SVG_APP = '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';

function renderTracks(tracks) {
    appUi.trackList.innerHTML = '';
    if (!tracks.length) {
        appUi.trackList.innerHTML = `<div class="empty-state">${t('playlist.empty', 'Треков нет.')}</div>`;
        return;
    }

    tracks.forEach((track, i) => {
        const el = document.createElement('div');
        el.className = 'track';
        el.innerHTML = `
            <div class="track-cover">
                ${track.cover ? `<img src="${track.cover}" alt="">` : COVER_SVG_APP}
            </div>
            <div style="min-width: 0;">
                <div class="track-title">${track.title}</div>
                <div class="track-author">${track.author}</div>
            </div>
            <div class="track-num">${i + 1}</div>
            <div class="track-duration">${track.duration ? window.Player.formatTime(track.duration) : '—'}</div>
        `;
        el.addEventListener('click', () => {
            if (i === window.Player.state.currentIndex) {
                window.Player.togglePlay();
            } else {
                window.Player.selectTrack(i);
                window.Player.playTrack();
            }
        });
        appUi.trackList.appendChild(el);
    });
}

async function pickDonateArt() {
    const img = document.getElementById('donateArt');
    if (!img) return;

    if (!appState.projects.length) {
        img.style.display = 'none';
        return;
    }

    const candidates = [];
    await Promise.all(appState.projects.map(project => {
        const path = `./images/projects/${project.id}/donate.png`;
        return new Promise(resolve => {
            const testImg = new Image();
            testImg.onload = () => { candidates.push(path); resolve(); };
            testImg.onerror = () => resolve();
            testImg.src = path;
        });
    }));

    if (!candidates.length) {
        img.style.display = 'none';
        return;
    }

    const randomPath = candidates[Math.floor(Math.random() * candidates.length)];
    img.src = randomPath;
    img.style.display = 'block';
}

function routeFromHash() {
    const hash = location.hash;
    if (hash.startsWith('#project/')) {
        const id = hash.replace('#project/', '');
        if (appState.projects.length) openProject(id);
        else showView('projects');
    } else if (hash === '#projects') {
        showView('projects');
    } else if (hash === '#playlist') {
        showView('playlist');
    } else if (hash === '#donate') {
        showView('donate');
    } else {
        showView('home');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await window.I18n.init();
    window.I18n.bindEvents();
    window.Player.init();
    await Promise.all([loadTracks(), loadProjects()]);
    pickDonateArt();
    routeFromHash();
});

window.addEventListener('hashchange', routeFromHash);
