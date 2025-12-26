// ==UserScript==
// @name         YouTube Native Speed Menu HACK v8 (Desktop & Mobile)
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Persists playback speed (0.1x-8x) and overrides the settings menu on both Desktop and Mobile YouTube.
// @author       Gemini
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const IS_MOBILE = window.location.hostname === 'm.youtube.com';
    console.log(`[YT-Speed-v8] Initialized (${IS_MOBILE ? 'Mobile' : 'Desktop'} Mode)`);

    // --- Configuration ---
    const CONFIG = {
        min: 0.1,
        max: 8.0,
        step: 0.1,
        tranches: [0.25, 0.5, 1, 1.25, 1.5, 2, 2.5, 3, 4],
        storageKeySpeed: 'yt-custom-speed-value',
        storageKeyEnabled: 'yt-custom-speed-remember'
    };

    const CUSTOM_CONTAINER_ID = 'yt-custom-speed-injected';

    // --- CSS ---
    const STYLES = `
        /* Common Slider */
        #${CUSTOM_CONTAINER_ID} input[type=range] {
            width: 100%;
            cursor: pointer;
            margin: 10px 0;
            accent-color: #ff0000;
        }

        /* Container Adjustments */
        #${CUSTOM_CONTAINER_ID} {
            padding: 12px 15px;
            color: #eee;
            font-family: Roboto, Arial, sans-serif;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        /* Mobile specific adjustments */
        .mobile-mode #${CUSTOM_CONTAINER_ID} {
            background-color: #212121; /* Match mobile sheet bg */
            padding: 20px;
        }

        /* Toggle Switch */
        .yt-speed-toggle-wrapper {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            color: #ccc;
            margin-top: 12px;
        }

        .yt-speed-toggle {
            position: relative;
            display: inline-block;
            width: 34px;
            height: 18px;
        }

        .yt-speed-toggle input { opacity: 0; width: 0; height: 0; }

        .yt-speed-slider {
            position: absolute;
            cursor: pointer;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: #555;
            transition: .2s;
            border-radius: 34px;
        }

        .yt-speed-slider:before {
            position: absolute;
            content: "";
            height: 14px;
            width: 14px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            transition: .2s;
            border-radius: 50%;
        }

        input:checked + .yt-speed-slider { background-color: #ff0000; }
        input:checked + .yt-speed-slider:before { transform: translateX(16px); }
    `;

    function injectStyles() {
        if (document.getElementById('yt-speed-hack-styles')) return;
        const style = document.createElement('style');
        style.id = 'yt-speed-hack-styles';
        style.textContent = STYLES;
        document.head.appendChild(style);
        if (IS_MOBILE) document.body.classList.add('mobile-mode');
    }

    // --- State Management ---
    function saveState(speed) {
        const isEnabled = getState().remember;
        if (isEnabled) {
            localStorage.setItem(CONFIG.storageKeySpeed, speed);
        }
    }

    function getState() {
        const rawEnabled = localStorage.getItem(CONFIG.storageKeyEnabled);
        const isEnabled = rawEnabled === null ? true : rawEnabled === 'true';
        return {
            speed: parseFloat(localStorage.getItem(CONFIG.storageKeySpeed) || '1.0'),
            remember: isEnabled
        };
    }

    // --- DOM Creation ---
    function create(tag, styles = {}, text = null) {
        const el = document.createElement(tag);
        Object.assign(el.style, styles);
        if (text) el.textContent = text;
        return el;
    }

    // --- Label Updater (Desktop & Mobile) ---
    function updateLabels(speed) {
        const speedTxt = parseFloat(speed).toFixed(2) + 'x';

        // Desktop Label
        const desktopMenu = document.querySelector('.ytp-settings-menu');
        if (desktopMenu) {
            const items = Array.from(desktopMenu.querySelectorAll('.ytp-menuitem'));
            const speedItem = items.find(i => i.textContent.includes('Playback speed') || i.textContent.includes('Speed'));
            if (speedItem) {
                const content = speedItem.querySelector('.ytp-menuitem-content');
                if (content) content.textContent = speedTxt;
            }
        }

        // Mobile Label (Usually inside a list item view model)
        if (IS_MOBILE) {
            // Mobile is trickier, it usually just shows "Speed" and then the value on the right
            // We look for elements containing "Speed" and update their sibling or child values
            const sheet = document.querySelector('.yt-spec-bottom-sheet-layout');
            if (sheet) {
                // This is loose logic because mobile classes are messy, but usually works
                const items = Array.from(sheet.querySelectorAll('yt-list-item-view-model, .group-item'));
                const speedEntry = items.find(i => i.textContent.includes('Speed'));
                if (speedEntry) {
                   // Try to find the secondary text container
                   const secondary = speedEntry.querySelector('.yt-list-item-view-model__secondary'); // Common mobile class
                   if (secondary) secondary.textContent = speedTxt;
                }
            }
        }
    }

    // --- Custom UI Injection ---
    function injectCustomControls(containerEl, video) {
        // Hide Native Items
        // Desktop: .ytp-menuitem
        // Mobile: yt-list-item-view-model OR .group-item depending on version
        const itemSelector = IS_MOBILE ? 'yt-list-item-view-model, .group-item, a[role="radio"]' : '.ytp-menuitem';
        const nativeItems = Array.from(containerEl.querySelectorAll(itemSelector));

        nativeItems.forEach(item => {
            if (item.style.display !== 'none') item.style.display = 'none';
        });

        // Prevention check
        if (document.getElementById(CUSTOM_CONTAINER_ID)) {
            // Just sync values
            const slider = document.querySelector(`#${CUSTOM_CONTAINER_ID} input[type="range"]`);
            const display = document.querySelector(`#${CUSTOM_CONTAINER_ID} .speed-display`);
            if (slider && display && document.activeElement !== slider) {
                slider.value = video.playbackRate;
                display.textContent = video.playbackRate.toFixed(2) + 'x';
            }
            return;
        }

        console.log("[YT-Speed-v8] Injecting UI...");

        const wrapper = create('div');
        wrapper.id = CUSTOM_CONTAINER_ID;

        // 1. Header/Slider
        const labelRow = create('div', { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' });
        labelRow.appendChild(create('span', {}, 'Custom Speed'));
        const valueDisplay = create('span', { fontWeight: 'bold', color: '#fff' }, video.playbackRate.toFixed(2) + 'x');
        valueDisplay.className = 'speed-display';
        labelRow.appendChild(valueDisplay);

        const slider = create('input');
        slider.type = 'range';
        slider.min = CONFIG.min;
        slider.max = CONFIG.max;
        slider.step = CONFIG.step;
        slider.value = video.playbackRate;

        slider.addEventListener('input', (e) => {
            e.stopPropagation();
            const val = parseFloat(e.target.value);
            video.playbackRate = val;
            valueDisplay.textContent = val.toFixed(2) + 'x';
            saveState(val);
        });

        // Mobile touch event stop
        slider.addEventListener('touchmove', (e) => e.stopPropagation());

        wrapper.appendChild(labelRow);
        wrapper.appendChild(slider);

        // 2. Buttons Grid
        const btnGrid = create('div', {
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)', // 4 columns
            gap: '8px',
            marginBottom: '15px'
        });

        CONFIG.tranches.forEach(rate => {
            const btn = create('div', {
                textAlign: 'center',
                padding: IS_MOBILE ? '12px 0' : '6px 0', // Larger touch target on mobile
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                userSelect: 'none',
            }, rate + 'x');

            btn.onclick = (e) => {
                e.stopPropagation();
                video.playbackRate = rate;
                slider.value = rate;
                valueDisplay.textContent = rate.toFixed(2) + 'x';
                saveState(rate);
            };

            btnGrid.appendChild(btn);
        });
        wrapper.appendChild(btnGrid);

        // 3. Toggle
        const toggleWrapper = create('div');
        toggleWrapper.className = 'yt-speed-toggle-wrapper';
        toggleWrapper.appendChild(create('span', {}, 'Remember speed'));

        const toggleLabel = create('label');
        toggleLabel.className = 'yt-speed-toggle';
        const toggleInput = create('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = getState().remember;

        toggleInput.addEventListener('change', (e) => {
            e.stopPropagation();
            localStorage.setItem(CONFIG.storageKeyEnabled, e.target.checked);
            if(e.target.checked) saveState(video.playbackRate);
        });

        const toggleSlider = create('span');
        toggleSlider.className = 'yt-speed-slider';

        toggleLabel.appendChild(toggleInput);
        toggleLabel.appendChild(toggleSlider);
        toggleWrapper.appendChild(toggleLabel);
        wrapper.appendChild(toggleWrapper);

        // Prepend to menu
        if (IS_MOBILE) {
            // On mobile we might need to append depending on container layout,
            // but prepend usually works to keep it above scroll
            containerEl.insertBefore(wrapper, containerEl.firstChild);
        } else {
            containerEl.insertBefore(wrapper, containerEl.firstChild);
        }
    }

    // --- Detection Logic ---

    function getVideo() {
        return document.querySelector('video') || document.querySelector('.html5-main-video');
    }

    function checkMenus() {
        const video = getVideo();
        if (!video) return;

        if (IS_MOBILE) {
            // --- Mobile Logic ---
            // Mobile uses a bottom sheet usually class .yt-spec-bottom-sheet-layout__bottom-sheet-content
            const bottomSheet = document.querySelector('.yt-spec-bottom-sheet-layout__bottom-sheet-content');
            if (bottomSheet && bottomSheet.style.display !== 'none') {
                // Check header
                const header = bottomSheet.querySelector('.yt-spec-bottom-sheet-layout__header-title');
                const title = header ? header.textContent : bottomSheet.textContent;

                if (title && (title.includes('Playback speed') || title.includes('Speed'))) {
                    // This is the speed menu
                    // On mobile, the content is usually in a scrollable div inside
                    const contentBox = bottomSheet.querySelector('#content') || bottomSheet;
                    injectCustomControls(contentBox, video);
                } else {
                    // We might be in the main menu, try to fix label
                    updateLabels(video.playbackRate);
                }
            }
        } else {
            // --- Desktop Logic ---
            const settingsMenu = document.querySelector('.ytp-popup.ytp-settings-menu');
            if (settingsMenu && settingsMenu.style.display !== 'none') {
                const panel = settingsMenu.querySelector('.ytp-panel-menu');
                if (panel) {
                    const text = panel.textContent;
                    if (text.includes('0.25') || text.includes('Normal')) {
                        injectCustomControls(panel, video);
                    } else {
                        updateLabels(video.playbackRate);
                    }
                }
            }
        }
    }

    // --- Initialization ---

    function applySavedSpeed() {
        const state = getState();
        const video = getVideo();
        if (state.remember && video) {
            // Tolerance check to prevent unnecessary stutter
            if (Math.abs(video.playbackRate - state.speed) > 0.05) {
                video.playbackRate = state.speed;
            }
        }
    }

    function loop() {
        const video = getVideo();
        if (video) {
            // Attach rate listener if missing
            if (!video.getAttribute('data-speed-hack-attached')) {
                video.setAttribute('data-speed-hack-attached', 'true');
                video.addEventListener('ratechange', () => {
                    saveState(video.playbackRate);
                    updateLabels(video.playbackRate);
                });
                applySavedSpeed();
            }

            // On mobile, sometimes the video element is swapped (shorts vs normal), re-apply if needed
            if (getState().remember && Math.abs(video.playbackRate - getState().speed) > 0.1 && !video.paused && video.currentTime > 1) {
                // Enforcement logic for ads/playlist transitions
                video.playbackRate = getState().speed;
            }
        }

        checkMenus();
    }

    // Use a fast interval instead of MutationObserver for menu detection
    // because mobile DOM changes are extremely rapid and nested.
    injectStyles();
    setInterval(loop, 500);

})();
