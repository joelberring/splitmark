const WebSocket = require('ws');

// Configuration
const TARGET_URL = 'ws://localhost:8080/ws';
const NUM_RUNNERS = 10; // Start small for local test, prompt said 1000 for verify
const RACE_ID = 'test-race-1';

const runners = [];

console.log(`Starting Load Test: ${NUM_RUNNERS} runners -> ${TARGET_URL}`);

for (let i = 0; i < NUM_RUNNERS; i++) {
    const runnerId = `runner-${i}`;
    startRunner(runnerId);
}

function startRunner(runnerId) {
    const ws = new WebSocket(TARGET_URL);

    // Initial position (Stockholm)
    let lat = 59.3293;
    let lon = 18.0686;

    ws.on('open', function open() {
        console.log(`${runnerId} connected`);

        // Send position every second
        setInterval(() => {
            // Random movement
            lat += (Math.random() - 0.5) * 0.0001;
            lon += (Math.random() - 0.5) * 0.0001;

            const payload = JSON.stringify({
                lat: lat,
                lon: lon,
                timestamp: Date.now(),
                runner_id: runnerId,
                race_id: RACE_ID
            });

            ws.send(payload);
        }, 1000);
    });

    ws.on('error', (err) => {
        console.error(`${runnerId} error:`, err.message);
    });

    ws.on('close', () => {
        console.log(`${runnerId} disconnected`);
    });

    runners.push(ws);
}
