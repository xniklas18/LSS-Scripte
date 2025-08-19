// ==UserScript==
// @name         MTW Counter
// @namespace    xniklas18.leitstellenspiel.de
// @version      1.0
// @description  Zähle die aktiven MTW
// @author       Niklas
// @match        https://www.leitstellenspiel.de/*
// @match        https://leitstellenspiel.de/*
// @grant        GM_xmlhttpRequest
// @connect      www.leitstellenspiel.de
// ==/UserScript==
(function() {
    'use strict';
    // Wait for status counter wrapper to be fully loaded
    function waitForStatusWrapper() {
        return new Promise((resolve) => {
            const checkForWrapper = () => {
                // First try to find the statuscounter-wrapper in the radio panel
                const radioPanel = document.getElementById('radio_panel_heading');
                if (radioPanel) {
                    const statusWrapper = radioPanel.querySelector('.statuscounter-wrapper');
                    if (statusWrapper && statusWrapper.children.length > 0) {
                        console.log('Status wrapper found in radio panel and loaded');
                        resolve(statusWrapper);
                        return;
                    }
                }
                // Fallback: look for any statuscounter-wrapper
                const statusWrapper = document.querySelector('.statuscounter-wrapper');
                if (statusWrapper && statusWrapper.children.length > 0) {
                    console.log('Status wrapper found and loaded');
                    resolve(statusWrapper);
                    return;
                }
                // If not found, keep checking
                setTimeout(checkForWrapper, 100);
            };
            checkForWrapper();
        });
    }
    // Create MTW counter element as a separate div
    function createMTWCounter() {
        const mtwCounterDiv = document.createElement('div');
        mtwCounterDiv.setAttribute('data-mtw-counter', 'true');
        mtwCounterDiv.id = 'mtw-counter-wrapper';
        mtwCounterDiv.style.cssText = `
            margin-top: 5px;
            display: flex;
            align-items: center;
            gap: 5px;
        `;
        const mtwCounter = document.createElement('span');
        mtwCounter.setAttribute('title', 'MTW Vehicles');
        mtwCounter.className = 'building_list_fms building_list_fms_mtw';
        mtwCounter.id = 'mtw-counter-element';
        mtwCounter.innerHTML = '\n        ...\n        <!---->';
        mtwCounter.style.cssText = `
            background-color: #28a745;
            color: white;
            cursor: pointer;
        `;
        const mtwLabel = document.createElement('span');
        mtwLabel.textContent = 'MTW:';
        mtwLabel.style.cssText = `
            font-size: 12px;
            color: #666;
        `;
        mtwCounterDiv.appendChild(mtwLabel);
        mtwCounterDiv.appendChild(mtwCounter);
        return { wrapper: mtwCounterDiv, counter: mtwCounter };
    }
    // Update counter color based on count
    function updateCounterColor(counterElement, count) {
        if (count === 0) {
            counterElement.style.backgroundColor = '#dc3545'; // Red
        } else if (count < 10) {
            counterElement.style.backgroundColor = '#ffc107'; // Yellow
            counterElement.style.color = '#000'; // Black text for better readability on yellow
        } else {
            counterElement.style.backgroundColor = '#28a745'; // Green
            counterElement.style.color = '#fff'; // White text
        }
    }
    // Insert MTW counter after the statuscounter-wrapper
    async function insertMTWCounter() {
        try {
            const statusWrapper = await waitForStatusWrapper();
            // Check if MTW counter already exists
            if (document.querySelector('[data-mtw-counter="true"]')) {
                console.log('MTW counter already exists');
                return document.getElementById('mtw-counter-element');
            }
            const { wrapper, counter } = createMTWCounter();
            statusWrapper.parentNode.insertBefore(wrapper, statusWrapper.nextSibling);
            console.log('MTW counter added after status wrapper');
            return counter;
        } catch (error) {
            console.warn('Could not find status wrapper, using fallback position');
            const container = document.createElement('div');
            container.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 9999;
            `;
            const { wrapper, counter } = createMTWCounter();
            container.appendChild(wrapper);
            document.body.appendChild(container);
            return counter;
        }
    }
    // Count MTW vehicles
    function countMTWVehicles(counterElement) {
        counterElement.innerHTML = '\n        ...\n        <!---->';
        counterElement.setAttribute('title', 'MTW Vehicles - Loading...');
        counterElement.style.opacity = '0.6';
        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://www.leitstellenspiel.de/api/v2/vehicles',
            headers: {
                'Accept': 'application/json'
            },
            onload: function(response) {
                try {
                    if (response.status !== 200) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    const data = JSON.parse(response.responseText);
                    if (!data.result || !Array.isArray(data.result)) {
                        throw new Error('Invalid response format: missing result array');
                    }
                    const vehicles = data.result;
                    // RegEx pattern to match "MTW 🚒-Feuerwehr [City] [Number] | [Number]"
                    const mtwPattern = /^MTW\s+🚒-Feuerwehr\s+[\w\u00C0-\u017F]+\s+\d+\s+\|\s+\d+$/;
                    // Get all MTW vehicles (regardless of FMS status)
                    const allMTWVehicles = vehicles.filter(vehicle => {
                        const vehicleName = vehicle.caption || '';
                        return mtwPattern.test(vehicleName);
                    });
                    // Count vehicles matching the MTW pattern AND have fms_real = 2
                    const availableMTWVehicles = allMTWVehicles.filter(vehicle => {
                        return vehicle.fms_real === 2;
                    });
                    const availableCount = availableMTWVehicles.length;
                    const totalMTWCount = allMTWVehicles.length;
                    counterElement.innerHTML = `\n        ${availableCount}\n        <!---->`;
                    counterElement.setAttribute('title',
                        `MTW Vehicles (FMS 2): ${availableCount} (Total: ${totalMTWCount})`
                    );
                    counterElement.style.opacity = '1';
                    updateCounterColor(counterElement, availableCount);
                    console.log(`Found ${availableCount} available MTW vehicles out of ${totalMTWCount} total MTW vehicles`);
                } catch (error) {
                    console.error('Error processing vehicles:', error);
                    counterElement.innerHTML = '\n        !\n        <!---->';
                    counterElement.setAttribute('title', `Error: ${error.message}`);
                    counterElement.style.opacity = '1';
                }
            },
            onerror: function(error) {
                console.error('API request failed:', error);
                counterElement.innerHTML = '\n        !\n        <!---->';
                counterElement.setAttribute('title', 'API request failed');
                counterElement.style.opacity = '1';
            }
        });
    }
    // Initialize the script
    async function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        try {
            const counterElement = await insertMTWCounter();
            if (counterElement) {
                counterElement.addEventListener('click', () => {
                    countMTWVehicles(counterElement);
                });
                // Initial count
                countMTWVehicles(counterElement);
                // Auto-refresh every 30 seconds
                setInterval(() => {
                    countMTWVehicles(counterElement);
                }, 30000);
            }
        } catch (error) {
            console.error('Failed to initialize MTW counter:', error);
        }
    }
    init();
})();