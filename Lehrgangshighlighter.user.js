// ==UserScript==
// @name         Lehrgangshighlighter
// @namespace    http://tampermonkey.net/
// @version      1.5
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
        if (!title || typeof title !== 'string') {
            return '';
        }
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
            const notRunningCounts = {};
            runningSchoolings.forEach(schooling => {
                if (!schooling.education_title) return;
                if (schooling.running === false) {
                    const normalizedTitle = normalizeTitle(schooling.education_title);
                    if (normalizedTitle) {
                        notRunningCounts[normalizedTitle] = (notRunningCounts[normalizedTitle] || 0) + 1;
                    }
                }
            });
            Array.from(educationSelect.options).forEach(option => {
                if (option.value && option.textContent) {
                    const originalText = option.textContent.trim();
                    if (option.textContent.includes(' [')) return;
                    const optionText = normalizeText(originalText);
                    const mainTitle = normalizeText(extractMainTitle(optionText));
                    const matchingTitle = Object.keys(notRunningCounts).find(title => {
                        const normalizedTitle = normalizeText(title);
                        return normalizedTitle === mainTitle || mainTitle.endsWith(normalizedTitle);
                    });
                    const count = matchingTitle ? notRunningCounts[matchingTitle] : 0;
                    option.textContent = `${originalText} [${count}]`;
                    if (count === 0) {
                        option.style.backgroundColor = '#FFB6C1';
                        option.style.color = '#000';
                    } else if (count === 1) {
                        option.style.backgroundColor = '#FFF8DC';
                        option.style.color = '#000';
                    } else {
                        option.style.backgroundColor = '#C8E6C9';
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