// ==UserScript==
// @name         Lehrgangshighlighter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Hebt bereits geöffnete Lehrgänge farblich hervor.
// @author       xniklas18
// @match        https://www.leitstellenspiel.de/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==
(function() {
    'use strict';
    function fetchRunningSchoolings() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://www.leitstellenspiel.de/api/alliance_schoolings',
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data.result || []);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }
    function normalizeTitle(title) {
        return title.replace(/^(Feuerwehr|Polizei|Rettungsdienst|THW|SEG) - /, '').trim().normalize('NFC');
    }
    function normalizeText(text) {
        return text.trim().normalize('NFC');
    }
    function extractMainTitle(optionText) {
        return optionText.replace(/\s*\(\d+\s+Tage?\)$/, '').trim();
    }
    function highlightNonRunningSchoolings() {
        const educationSelect = document.getElementById('education_select');
        if (!educationSelect) return;
        fetchRunningSchoolings().then(runningSchoolings => {
            const notRunningTitles = runningSchoolings
                .filter(schooling => schooling.running === false)
                .map(schooling => normalizeTitle(schooling.education_title));
            Array.from(educationSelect.options).forEach(option => {
                if (option.value && option.textContent) {
                    const optionText = normalizeText(option.textContent);
                    const mainTitle = normalizeText(extractMainTitle(optionText));
                    const isNotRunning = notRunningTitles.some(title => {
                        const normalizedTitle = normalizeText(title);
                        return normalizedTitle === mainTitle || mainTitle.endsWith(normalizedTitle);
                    });
                    if (isNotRunning) {
                        option.style.backgroundColor = '#ADD8E6';
                        option.style.color = '#000';
                    }
                }
            });
        }).catch(error => {
            console.error('Error fetching alliance schoolings:', error);
        });
    }
    function init() {
        setTimeout(() => {
            highlightNonRunningSchoolings();
        }, 1000);
    }
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                const educationSelect = document.getElementById('education_select');
                if (educationSelect && !educationSelect.dataset.highlighted) {
                    educationSelect.dataset.highlighted = 'true';
                    highlightNonRunningSchoolings();
                }
            }
        });
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    init();
})();