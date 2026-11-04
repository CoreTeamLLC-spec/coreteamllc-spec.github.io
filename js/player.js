(function() {
    'use strict';

    window.Player = {
        audio: new Audio(),
        state: {
            tracks: [],
            currentIndex: -1,
            isPlaying: false,
            ytReady: false,
            ytPlayer: null,
            volume: 1,
            muted: false,
            lastVolume: 1,
            shuffle: false,
            repeat: 'off',
            playHistory: [],
            _pendingIndex: undefined,
            _pendingPosition: 0,
            _pendingWasPlaying: false
        }
    };

    const P = window.Player;
    const S = P.state;

    const PLAY_ICON = '<path d="M8 5v14l11-7z"/>';
    const PAUSE_ICON = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    const COVER_SVG = '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
    const VOL_ON = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
    const VOL_OFF = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';

    const ui = {};

    function formatTime(s) {
        if (isNaN(s) || s === Infinity || s < 0) return '0:00';
        return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    }

    function showPlayerError(msg) {
        if (!ui.errorMsg) return;
        ui.errorMsg.textContent = msg;
        setTimeout(() => { ui.errorMsg.textContent = ''; }, 6000);
    }

    function setCover(el, coverUrl) {
        el.innerHTML = coverUrl ? `<img src="${coverUrl}" alt="">` : COVER_SVG;
    }

    P.init = function () {
        ui.mini = {
            root: document.getElementById('miniPlayer'),
            title: document.getElementById('miniTitle'),
            author: document.getElementById('miniAuthor'),
            cover: document.getElementById('miniCover'),
            playIcon: document.getElementById('miniPlayIcon'),
            progressFill: document.getElementById('miniProgressFill'),
            cur: document.getElementById('miniCur'),
            total: document.getElementById('miniTotal'),
            volumeFill: document.getElementById('miniVolumeFill'),
            muteBtn: document.getElementById('miniMuteBtn')
        };
        ui.full = {
            root: document.getElementById('fullPlayer'),
            title: document.getElementById('fullTitle'),
            author: document.getElementById('fullAuthor'),
            cover: document.getElementById('fullCover'),
            playIcon: document.getElementById('fullPlayIcon'),
            progressFill: document.getElementById('fullProgressFill'),
            cur: document.getElementById('fullCur'),
            total: document.getElementById('fullTotal'),
            volumeFill: document.getElementById('fullVolumeFill'),
            muteBtn: document.getElementById('fullMuteBtn'),
            shuffleBtn: document.getElementById('fullShuffle'),
            repeatBtn: document.getElementById('fullRepeat')
        };
        ui.errorMsg = document.getElementById('errorMsg');

        const audio = P.audio;
        audio.addEventListener('timeupdate', () => {
            if (S.tracks[S.currentIndex]?.type === 'audio' && audio.duration) {
                const percent = `${(audio.currentTime / audio.duration) * 100}%`;
                ui.mini.progressFill.style.width = percent;
                ui.full.progressFill.style.width = percent;
                ui.mini.cur.textContent = formatTime(audio.currentTime);
                ui.full.cur.textContent = formatTime(audio.currentTime);
                P.saveStateThrottled();
            }
        });
        audio.addEventListener('loadedmetadata', () => {
            ui.mini.total.textContent = formatTime(audio.duration);
            ui.full.total.textContent = formatTime(audio.duration);
            const t = S.tracks[S.currentIndex];
            if (t) t.duration = audio.duration;
        });
        audio.addEventListener('play', () => { P.updatePlayState(true); P.saveState(); });
        audio.addEventListener('pause', () => { P.updatePlayState(false); P.saveState(); });
        audio.addEventListener('ended', () => P.playNext(true));
        audio.addEventListener('error', () => showPlayerError('Ошибка загрузки файла. Проверьте ссылку.'));

        makeDraggableProgress(document.getElementById('miniProgress'));
        makeDraggableProgress(document.getElementById('fullProgress'));

        makeDraggableVolume(document.getElementById('miniVolumeBar'));
        makeDraggableVolume(document.getElementById('fullVolumeBar'));
        ui.mini.muteBtn.addEventListener('click', P.toggleMute);
        ui.full.muteBtn.addEventListener('click', P.toggleMute);

        document.getElementById('miniPlay').onclick = P.togglePlay;
        document.getElementById('fullPlay').onclick = P.togglePlay;
        document.getElementById('miniNext').onclick = () => P.playNext(false);
        document.getElementById('fullNext').onclick = () => P.playNext(false);
        document.getElementById('miniPrev').onclick = P.playPrev;
        document.getElementById('fullPrev').onclick = P.playPrev;
        ui.full.shuffleBtn.onclick = P.toggleShuffle;
        ui.full.repeatBtn.onclick = P.cycleRepeat;

        const hideBtn = document.getElementById('miniHideBtn');
        const restoreBtn = document.getElementById('miniRestore');
        if (hideBtn && restoreBtn) {
            hideBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                ui.mini.root.classList.add('hidden');
                restoreBtn.classList.add('visible');
            });
            restoreBtn.addEventListener('click', () => {
                ui.mini.root.classList.remove('hidden');
                restoreBtn.classList.remove('visible');
            });
        }

        ui.mini.root.addEventListener('click', (e) => {
            if (e.target.closest('.mini-btn') ||
                e.target.closest('.mini-play') ||
                e.target.closest('.mini-volume') ||
                e.target.closest('.mini-progress') ||
                e.target.closest('.mini-hide') ||
                e.target.closest('.mini-expand')) {
                return;
            }
            ui.full.root.classList.add('open');
        });

        document.getElementById('miniExpand').addEventListener('click', (e) => {
            e.stopPropagation();
            ui.full.root.classList.add('open');
        });

        document.getElementById('fullCollapse').addEventListener('click', () => {
            ui.full.root.classList.remove('open');
        });

        document.addEventListener('keydown', (e) => {
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;
            switch (e.code) {
                case 'Space': e.preventDefault(); P.togglePlay(); break;
                case 'ArrowRight': e.preventDefault(); P.seekBy(e.shiftKey ? 30 : 5); break;
                case 'ArrowLeft': e.preventDefault(); P.seekBy(e.shiftKey ? -30 : -5); break;
                case 'KeyM': P.toggleMute(); break;
                case 'KeyN': P.playNext(false); break;
                case 'KeyP': P.playPrev(); break;
            }
        });

        const ytScript = document.createElement('script');
        ytScript.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(ytScript);

        window.onYouTubeIframeAPIReady = () => {
            S.ytPlayer = new YT.Player('yt-player', {
                height: '0', width: '0',
                playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1 },
                events: {
                    onReady: () => { S.ytReady = true; P.applyVolume(); },
                    onStateChange: (e) => {
                        if (e.data === YT.PlayerState.PLAYING) { P.updatePlayState(true); P.updateProgress(); P.saveState(); }
                        else if (e.data === YT.PlayerState.PAUSED) { P.updatePlayState(false); P.saveState(); }
                        else if (e.data === YT.PlayerState.ENDED) { P.updatePlayState(false); P.playNext(true); }
                    }
                }
            });
        };

        P.loadSavedState();
        P.updateVolumeUI();
        P.updateShuffleRepeatUI();
        P.applyVolume();
    };

    P.setTracks = function (tracks) {
        S.tracks = tracks;
        if (typeof S._pendingIndex === 'number' && S._pendingIndex >= 0 && S._pendingIndex < S.tracks.length) {
            const idx = S._pendingIndex;
            delete S._pendingIndex;
            P.selectTrack(idx, { autoplay: false });
        }
    };

    P.updatePlayState = function (isPlaying) {
        S.isPlaying = isPlaying;
        const icon = isPlaying ? PAUSE_ICON : PLAY_ICON;
        ui.mini.playIcon.innerHTML = icon;
        ui.full.playIcon.innerHTML = icon;
        document.querySelectorAll('.track').forEach((el, i) => {
            el.classList.toggle('playing', i === S.currentIndex && isPlaying);
        });
        const t = S.tracks[S.currentIndex];
        if (t && isPlaying) document.title = `▶ ${t.title} — ${t.author}`;
        else if (t) document.title = `❚❚ ${t.title} — ${t.author}`;
        else document.title = 'CoreTeam.LLC — Игры и цифровые проекты';
        P.updateMediaSession();
    };

    P.selectTrack = function (index, opts = {}) {
        if (index < 0 || index >= S.tracks.length) return;
        P.pauseTrack();
        S.currentIndex = index;
        const track = S.tracks[index];

        ui.mini.root.classList.add('visible');

        setCover(ui.mini.cover, track.cover);
        setCover(ui.full.cover, track.cover);

        ui.mini.title.textContent = track.title;
        ui.mini.author.textContent = track.author;
        ui.full.title.textContent = track.title;
        ui.full.author.textContent = track.author;
        ui.errorMsg.textContent = '';

        ui.mini.progressFill.style.width = '0%';
        ui.full.progressFill.style.width = '0%';
        ui.mini.cur.textContent = '0:00';
        ui.full.cur.textContent = '0:00';
        ui.mini.total.textContent = track.duration ? formatTime(track.duration) : '0:00';
        ui.full.total.textContent = track.duration ? formatTime(track.duration) : '0:00';

        document.querySelectorAll('.track').forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });

        if (track.type === 'youtube' && S.ytPlayer && S.ytReady) {
            S.ytPlayer.loadVideoById(track.id);
            S.ytPlayer.pauseVideo();
        } else if (track.type === 'audio') {
            P.audio.src = track.src;
            P.audio.load();
        }

        P.updatePlayState(false);

        if (S._pendingPosition && S._pendingPosition > 0) {
            const pos = S._pendingPosition;
            const wasPlaying = S._pendingWasPlaying;
            S._pendingPosition = 0;
            S._pendingWasPlaying = false;

            if (track.type === 'audio') {
                const applyPos = () => {
                    try { P.audio.currentTime = pos; } catch (e) {}
                    ui.mini.cur.textContent = formatTime(pos);
                    ui.full.cur.textContent = formatTime(pos);
                    const percent = P.audio.duration ? `${(pos / P.audio.duration) * 100}%` : '0%';
                    ui.mini.progressFill.style.width = percent;
                    ui.full.progressFill.style.width = percent;
                    if (wasPlaying) {
                        ui.mini.playIcon.innerHTML = PAUSE_ICON;
                        ui.full.playIcon.innerHTML = PAUSE_ICON;
                    }
                };
                if (P.audio.readyState >= 1) applyPos();
                else P.audio.addEventListener('loadedmetadata', applyPos, { once: true });
            } else if (track.type === 'youtube' && S.ytPlayer && S.ytReady) {
                S.ytPlayer.seekTo(pos, true);
                ui.mini.cur.textContent = formatTime(pos);
                ui.full.cur.textContent = formatTime(pos);
                if (wasPlaying) {
                    ui.mini.playIcon.innerHTML = PAUSE_ICON;
                    ui.full.playIcon.innerHTML = PAUSE_ICON;
                }
            }
        }

        P.saveState();
    };

    P.togglePlay = function () {
        if (S.isPlaying) P.pauseTrack();
        else P.playTrack();
    };

    P.playTrack = function () {
        if (S.currentIndex === -1) return;
        const track = S.tracks[S.currentIndex];
        if (track.type === 'youtube') {
            if (S.ytPlayer && S.ytReady) S.ytPlayer.playVideo();
            else showPlayerError('Плеер YouTube еще загружается. Подождите...');
        } else if (track.type === 'audio') {
            P.audio.play().catch(() => {
                showPlayerError('Ошибка: аудиофайл не найден или заблокирован.');
                P.updatePlayState(false);
            });
        }
    };

    P.pauseTrack = function () {
        if (S.currentIndex === -1) return;
        const track = S.tracks[S.currentIndex];
        if (track.type === 'youtube' && S.ytPlayer && S.ytReady) S.ytPlayer.pauseVideo();
        else if (track.type === 'audio') P.audio.pause();
        P.updatePlayState(false);
    };

    P.getNextIndex = function () {
        if (!S.tracks.length) return -1;
        if (S.shuffle) {
            if (S.tracks.length === 1) return 0;
            let next;
            do { next = Math.floor(Math.random() * S.tracks.length); } while (next === S.currentIndex);
            return next;
        }
        return (S.currentIndex + 1) % S.tracks.length;
    };

    P.getPrevIndex = function () {
        if (!S.tracks.length) return -1;
        if (S.shuffle) {
            if (S.playHistory.length > 1) {
                S.playHistory.pop();
                return S.playHistory[S.playHistory.length - 1];
            }
            return P.getNextIndex();
        }
        return (S.currentIndex - 1 + S.tracks.length) % S.tracks.length;
    };

    P.playNext = function (auto = false) {
        if (!S.tracks.length) return;
        if (auto) {
            if (S.repeat === 'one') {
                if (S.tracks[S.currentIndex].type === 'audio') P.audio.currentTime = 0;
                else if (S.ytPlayer && S.ytReady) S.ytPlayer.seekTo(0);
                P.playTrack();
                return;
            }
            if (S.repeat === 'off' && S.currentIndex === S.tracks.length - 1 && !S.shuffle) {
                P.updatePlayState(false);
                return;
            }
        }
        const nextIndex = P.getNextIndex();
        S.playHistory.push(nextIndex);
        P.selectTrack(nextIndex);
        P.playTrack();
    };

    P.playPrev = function () {
        if (!S.tracks.length) return;
        if (S.isPlaying && (P.audio.currentTime > 3 || (S.ytPlayer && S.ytPlayer.getCurrentTime && S.ytPlayer.getCurrentTime() > 3))) {
            if (S.tracks[S.currentIndex].type === 'youtube') S.ytPlayer.seekTo(0);
            else P.audio.currentTime = 0;
        } else {
            const prevIndex = P.getPrevIndex();
            P.selectTrack(prevIndex);
            P.playTrack();
        }
    };

    P.updateProgress = function () {
        if (S.currentIndex === -1) return;
        const track = S.tracks[S.currentIndex];
        let curr = 0, total = 0;
        if (track.type === 'audio') { curr = P.audio.currentTime; total = P.audio.duration; }
        else if (track.type === 'youtube' && S.ytPlayer && S.ytReady) {
            curr = S.ytPlayer.getCurrentTime() || 0;
            total = S.ytPlayer.getDuration() || 0;
        }
        if (total > 0) {
            const percent = `${(curr / total) * 100}%`;
            ui.mini.progressFill.style.width = percent;
            ui.full.progressFill.style.width = percent;
            ui.mini.cur.textContent = formatTime(curr);
            ui.full.cur.textContent = formatTime(curr);
            ui.mini.total.textContent = formatTime(total);
            ui.full.total.textContent = formatTime(total);
        }
        if (S.isPlaying) requestAnimationFrame(P.updateProgress);
    };

    function makeDraggableProgress(barEl) {
        let dragging = false;
        const handle = (e) => {
            const rect = barEl.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const track = S.tracks[S.currentIndex];
            if (!track) return;
            if (track.type === 'audio' && P.audio.duration) {
                P.audio.currentTime = percent * P.audio.duration;
            } else if (track.type === 'youtube' && S.ytPlayer && S.ytReady) {
                S.ytPlayer.seekTo(percent * S.ytPlayer.getDuration(), true);
            }
        };
        barEl.addEventListener('mousedown', (e) => { dragging = true; handle(e); });
        window.addEventListener('mousemove', (e) => { if (dragging) handle(e); });
        window.addEventListener('mouseup', () => { dragging = false; });
    }

    P.updateVolumeUI = function () {
        const w = `${S.volume * 100}%`;
        ui.mini.volumeFill.style.width = w;
        ui.full.volumeFill.style.width = w;
        const icon = S.muted || S.volume === 0 ? VOL_OFF : VOL_ON;
        ui.mini.muteBtn.innerHTML = icon;
        ui.full.muteBtn.innerHTML = icon;
    };

    P.setVolume = function (percent, save = true) {
        S.volume = Math.max(0, Math.min(1, percent));
        if (S.volume > 0) S.muted = false;
        P.updateVolumeUI();
        P.applyVolume();
        if (save) P.saveState();
    };

    P.applyVolume = function () {
        const v = S.muted ? 0 : S.volume;
        if (S.currentIndex !== -1) {
            const track = S.tracks[S.currentIndex];
            if (track.type === 'audio') P.audio.volume = v;
            else if (S.ytPlayer && S.ytReady) S.ytPlayer.setVolume(v * 100);
        } else {
            P.audio.volume = v;
        }
    };

    P.toggleMute = function () {
        if (S.muted) {
            S.muted = false;
            if (S.volume === 0) S.volume = S.lastVolume || 0.5;
        } else {
            S.lastVolume = S.volume;
            S.muted = true;
        }
        P.updateVolumeUI();
        P.applyVolume();
        P.saveState();
    };

    function makeDraggableVolume(barEl) {
        let dragging = false;
        const handle = (e) => {
            const rect = barEl.getBoundingClientRect();
            P.setVolume((e.clientX - rect.left) / rect.width);
        };
        barEl.addEventListener('mousedown', (e) => { dragging = true; handle(e); });
        window.addEventListener('mousemove', (e) => { if (dragging) handle(e); });
        window.addEventListener('mouseup', () => { dragging = false; });
    }

    P.toggleShuffle = function () {
        S.shuffle = !S.shuffle;
        P.updateShuffleRepeatUI();
        P.saveState();
    };

    P.cycleRepeat = function () {
        S.repeat = S.repeat === 'off' ? 'all' : S.repeat === 'all' ? 'one' : 'off';
        P.updateShuffleRepeatUI();
        P.saveState();
    };

    P.updateShuffleRepeatUI = function () {
        ui.full.shuffleBtn.classList.toggle('active', S.shuffle);
        ui.full.repeatBtn.classList.toggle('active', S.repeat !== 'off');
        ui.full.repeatBtn.classList.toggle('repeat-one', S.repeat === 'one');
        ui.full.repeatBtn.title = S.repeat === 'off' ? 'Повтор выкл' : S.repeat === 'all' ? 'Повтор плейлиста' : 'Повтор трека';
    };

    P.seekBy = function (delta) {
        if (S.currentIndex === -1) return;
        const track = S.tracks[S.currentIndex];
        if (track.type === 'audio' && P.audio.duration) {
            P.audio.currentTime = Math.max(0, Math.min(P.audio.duration, P.audio.currentTime + delta));
        } else if (track.type === 'youtube' && S.ytPlayer && S.ytReady) {
            const cur = S.ytPlayer.getCurrentTime() || 0;
            const dur = S.ytPlayer.getDuration() || 0;
            S.ytPlayer.seekTo(Math.max(0, Math.min(dur, cur + delta)), true);
        }
    };

    P.saveState = function () {
        try {
            localStorage.setItem('ct-settings', JSON.stringify({
                volume: S.volume,
                muted: S.muted,
                shuffle: S.shuffle,
                repeat: S.repeat
            }));

            if (S.currentIndex >= 0) {
                let position = 0;
                const track = S.tracks[S.currentIndex];
                if (track) {
                    if (track.type === 'audio') position = P.audio.currentTime || 0;
                    else if (track.type === 'youtube' && S.ytPlayer && S.ytReady) {
                        position = S.ytPlayer.getCurrentTime() || 0;
                    }
                }
                sessionStorage.setItem('ct-session', JSON.stringify({
                    index: S.currentIndex,
                    position: position,
                    wasPlaying: S.isPlaying
                }));
            }
        } catch (e) {}
    };

    P.saveStateThrottled = (function () {
        let last = 0;
        return function () {
            const now = Date.now();
            if (now - last > 1000) {
                last = now;
                P.saveState();
            }
        };
    })();

    P.loadSavedState = function () {
        try {
            const rawSettings = localStorage.getItem('ct-settings');
            if (rawSettings) {
                const s = JSON.parse(rawSettings);
                if (typeof s.volume === 'number') P.setVolume(s.volume, false);
                if (typeof s.shuffle === 'boolean') S.shuffle = s.shuffle;
                if (s.repeat) S.repeat = s.repeat;
                if (typeof s.muted === 'boolean') {
                    S.muted = s.muted;
                    if (s.muted) S.lastVolume = s.volume || 0.5;
                }
            }

            const rawSession = sessionStorage.getItem('ct-session');
            if (rawSession) {
                const s = JSON.parse(rawSession);
                if (typeof s.index === 'number' && s.index >= 0) {
                    S._pendingIndex = s.index;
                    S._pendingPosition = s.position || 0;
                    S._pendingWasPlaying = !!s.wasPlaying;
                }
            }
        } catch (e) {}
    };

    P.updateMediaSession = function () {
        if (!('mediaSession' in navigator)) return;
        const track = S.tracks[S.currentIndex];
        if (!track) return;
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.author,
                album: 'CoreTeam.LLC',
                artwork: track.cover ? [{ src: track.cover, sizes: '512x512', type: 'image/png' }] : []
            });
            navigator.mediaSession.setActionHandler('play', () => P.playTrack());
            navigator.mediaSession.setActionHandler('pause', () => P.pauseTrack());
            navigator.mediaSession.setActionHandler('previoustrack', () => P.playPrev());
            navigator.mediaSession.setActionHandler('nexttrack', () => P.playNext(false));
        } catch (e) {}
    };

    P.formatTime = formatTime;
})();