// --- 1. Chart.js Initialisation ---
const ctx = document.getElementById('telemetryChart').getContext('2d');
const telemetryChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Gas (kΩ)', data: [], borderColor: '#f87171', tension: 0.4, yAxisID: 'y' },
            { label: 'Temp (°C)', data: [], borderColor: '#38bdf8', tension: 0.4, yAxisID: 'y1' },
            { label: 'Humidity (%)', data: [], borderColor: '#4ade80', tension: 0.4, yAxisID: 'y1' }
        ]
    },
    options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Gas (kΩ)' } },
            y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Temp / Hum' } }
        }
    }
});

const API_BASE_URL = 'https://aeris-dashboard-ngrzevvlaw.eu-west-1.fcapp.run';

// --- 2. Fetch Live Data & Update UI ---
async function fetchLatestData() {
    try{
        const response = await fetch(`${API_BASE_URL}/api/latest`);
        if(!response.ok){
            throw new Error('Network response was not ok');
        }
        const data = await response.json();

        // Update Status
        const statusEl = document.getElementById('system-status');
        if(data.anomaly_type && data.anomaly_type !== 'None'){
            statusEl.innerText = `ALERT: ${data.anomaly_type}`;
            statusEl.className = 'status-critical';
        }
        else{
            statusEl.innerText = 'NORMAL (0%)';
            statusEl.className = 'status-normal';
        }
        document.getElementById('last-update').innerText = new Date(data.timestamp * 1000).toLocaleTimeString();

        // Update Sensors
        document.getElementById('temp-p').innerText = `${data.sensors?.temp_p || '--'}°C`;
        document.getElementById('hum-p').innerText = `${data.sensors?.hum_p || '--'}%`;
        document.getElementById('gas-p').innerText = `${data.sensors?.gas_p ? (data.sensors.gas_p / 1000).toFixed(1) : '--'} kΩ`;
        
        document.getElementById('temp-s').innerText = `${data.sensors?.temp_s || '--'}°C`;
        document.getElementById('hum-s').innerText = `${data.sensors?.hum_s || '--'}%`;
        document.getElementById('gas-s').innerText = `${data.sensors?.gas_s ? (data.sensors.gas_s / 1000).toFixed(1) : '--'} kΩ`;

        // Update Diagnosis
        document.getElementById('anomaly-type').innerText = data.anomaly_type || 'No Anomalies Detected';
        document.getElementById('diagnosis-text').innerText = data.qwen_diagnosis || 'Environment stable.';

        // Update Chart
        const timeLabel = new Date(data.timestamp * 1000).toLocaleTimeString();
        if(telemetryChart.data.labels.length > 30){
            telemetryChart.data.labels.shift();
            telemetryChart.data.datasets[0].data.shift();
            telemetryChart.data.datasets[1].data.shift();
            telemetryChart.data.datasets[2].data.shift();
        }
        telemetryChart.data.labels.push(timeLabel);
        telemetryChart.data.datasets[0].data.push(data.sensors?.gas_p ? (data.sensors.gas_p / 1000).toFixed(1) : 0);
        telemetryChart.data.datasets[1].data.push(data.sensors?.temp_p || 0);
        telemetryChart.data.datasets[2].data.push(data.sensors?.hum_p || 0);
        telemetryChart.update();

    }
    catch(error){
        console.error('Error fetching latest data:', error);
    }
}

// --- 3. Fetch Audit Trail ---
async function fetchAuditTrail() {
    try{
        const response = await fetch(`${API_BASE_URL}/api/audit-trail`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        const auditList = document.getElementById('audit-list');
        auditList.innerHTML = ''; 
        
        if(data.trail && data.trail.length > 0){
            data.trail.forEach(item => {
                const li = document.createElement('li');
                li.className = 'audit-item';
                const time = new Date(item.timestamp * 1000).toLocaleString();
                li.innerHTML = `
                    <div class="audit-time">${time}</div>
                    <div><strong>${item.anomaly_type}</strong> (Confidence: ${(item.anomaly_confidence * 100).toFixed(0)}%)</div>
                    <div style="font-size: 0.9em; margin-top: 5px;">${item.qwen_response || 'No AI diagnosis available.'}</div>
                `;
                auditList.appendChild(li);
            });
        }
        else{
            auditList.innerHTML = '<li class="audit-item">No recent anomalies recorded.</li>';
        }
    }
    catch (error){
        console.error('Error fetching audit trail:', error);
    }
}

// --- 4. Ask Qwen Chat Logic ---
async function askQwen(){
    const input = document.getElementById('chatInput');
    const responseDiv = document.getElementById('chatResponse');
    const btn = document.getElementById('chatBtn');

    const question = input.value.trim();
    if(!question){
        return;
    }

    responseDiv.innerText = "Thinking...";
    responseDiv.style.color = "#94a3b8";
    btn.disabled = true;

    try{
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });

        const data = await response.json();

        if(data.status === 'success') {
            responseDiv.innerText = data.response;
            responseDiv.style.color = "#e2e8f0";
        }
        else{
            responseDiv.innerText = "Error: " + (data.message || "Unknown error");
            responseDiv.style.color = "#f87171";
        }
    }
    catch(error){
        responseDiv.innerText = "Network error: " + error.message;
        responseDiv.style.color = "#f87171";
    }
    finally{
        btn.disabled = false;
        input.value = '';
    }
}

// --- 5. Anomaly Simulator Logic ---
document.getElementById('simulate-ai-btn').addEventListener('click', async () =>{
    const resultDiv = document.getElementById('ai-diagnosis-result');
    const btn = document.getElementById('simulate-ai-btn');
    
    resultDiv.innerText = "Analysing simulated data with Qwen AI...";
    resultDiv.style.color = "#94a3b8";
    btn.disabled = true;
    btn.innerText = "Thinking...";

    const payload = {
        temp_p: parseFloat(document.getElementById('sim-temp-p').value),
        hum_p: parseFloat(document.getElementById('sim-hum-p').value),
        gas_p: parseFloat(document.getElementById('sim-gas-p').value),
        temp_s: parseFloat(document.getElementById('sim-temp-s').value),
        hum_s: parseFloat(document.getElementById('sim-hum-s').value),
        gas_s: parseFloat(document.getElementById('sim-gas-s').value)
    };

    try{
        const response = await fetch(`${API_BASE_URL}/api/simulate-diagnosis`,{
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if(data.status === 'success'){
            resultDiv.innerText = data.diagnosis;
            resultDiv.style.color = "#4ade80";
        }
        else{
            resultDiv.innerText = "Error: " + (data.message || "Unknown error");
            resultDiv.style.color = "#f87171";
        }
    }
    catch(error){
        resultDiv.innerText = "Network error: " + error.message;
        resultDiv.style.color = "#f87171";
    }
    finally{
        btn.disabled = false;
        btn.innerText = "Get AI Diagnosis";
    }
});

// --- 6. Quick Simulate Shortcut ---
// Scrolls down to the Anomaly Simulator card and focuses the AI diagnosis button.
document.getElementById('simulate-btn').addEventListener('click', () => {
    const simBtn = document.getElementById('simulate-ai-btn');
    if(simBtn){
        simBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        simBtn.focus();
    }
});

// --- 5. Auto-Refresh ---
fetchLatestData();
fetchAuditTrail();
setInterval(fetchLatestData, 5000);  // Refresh chart/sensors every 5 seconds
setInterval(fetchAuditTrail, 15000); // Refresh audit trail every 15 seconds