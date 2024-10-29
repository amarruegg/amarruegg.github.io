// DOM Elements
const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const startButton = document.getElementById('start');
const alertElement = document.getElementById('alert');
const ctx = canvasElement.getContext('2d');

// State
let isRunning = false;
let faceMesh = null;
let hands = null;
let boundaryPoints = [];
let lastBoundaryViolation = 0;
const VIOLATION_COOLDOWN = 1000; // 1 second cooldown between signals

// Initialize video dimensions
function initDimensions() {
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;
}

// Initialize MediaPipe Face Mesh
async function initFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onFaceMeshResults);
    
    console.log('FaceMesh initialized');
    return faceMesh.initialize();
}

// Initialize MediaPipe Hands
async function initHands() {
    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 2,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onHandResults);
    
    console.log('Hands initialized');
    return hands.initialize();
}

// Face Mesh Results Handler
function onFaceMeshResults(results) {
    if (!results.multiFaceLandmarks || !results.multiFaceLandmarks.length) {
        boundaryPoints = [];
        return;
    }

    const landmarks = results.multiFaceLandmarks[0];
    
    // Update boundary points (lower face)
    const indices = [
        234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
        377, 400, 378, 379, 365, 397, 288, 361, 447
    ];
    boundaryPoints = indices.map(i => landmarks[i]);

    // Draw face mesh
    ctx.save();
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    // Draw mesh connections
    drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, 
        {color: 'rgba(255,255,255,0.2)', lineWidth: 1});
    
    // Draw boundary line
    if (boundaryPoints.length) {
        ctx.beginPath();
        ctx.moveTo(
            boundaryPoints[0].x * canvasElement.width,
            boundaryPoints[0].y * canvasElement.height
        );
        
        for (let i = 1; i < boundaryPoints.length; i++) {
            const xc = (boundaryPoints[i].x + boundaryPoints[i-1].x) / 2 * canvasElement.width;
            const yc = (boundaryPoints[i].y + boundaryPoints[i-1].y) / 2 * canvasElement.height;
            ctx.quadraticCurveTo(
                boundaryPoints[i-1].x * canvasElement.width,
                boundaryPoints[i-1].y * canvasElement.height,
                xc, yc
            );
        }
        
        ctx.strokeStyle = '#8e7af7';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    ctx.restore();
}

// Hand Results Handler
function onHandResults(results) {
    if (!results.multiHandLandmarks) return;

    // Draw hands
    for (const landmarks of results.multiHandLandmarks) {
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, 
            {color: '#8e7af7', lineWidth: 2});
        drawLandmarks(ctx, landmarks, 
            {color: '#8e7af7', fillColor: '#8e7af7', lineWidth: 1, radius: 2});
        
        // Check boundary violation
        if (boundaryPoints.length && isHandNearBoundary(landmarks)) {
            handleBoundaryViolation();
        }
    }
}

// Check if hand is near boundary
function isHandNearBoundary(handLandmarks) {
    if (!boundaryPoints.length) return false;

    const fingerTips = [4, 8, 12, 16, 20];
    const threshold = 0.05; // Normalized distance threshold

    return fingerTips.some(tipIdx => {
        const tip = handLandmarks[tipIdx];
        return boundaryPoints.some(point => {
            const dist = Math.hypot(tip.x - point.x, tip.y - point.y);
            return dist < threshold;
        });
    });
}

// Handle boundary violation
function handleBoundaryViolation() {
    const now = Date.now();
    if (now - lastBoundaryViolation < VIOLATION_COOLDOWN) return;
    
    lastBoundaryViolation = now;
    alertElement.style.display = 'block';
    
    // Send signal to local proxy
    fetch('http://localhost:3001/tasmota/cm?cmnd=POWER1%20TOGGLE')
        .catch(err => console.log('Proxy communication error:', err));
    
    // Hide alert after 1 second
    setTimeout(() => {
        alertElement.style.display = 'none';
    }, 1000);
}

// Camera setup
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 640,
                height: 480
            }
        });
        videoElement.srcObject = stream;
        return new Promise(resolve => {
            videoElement.onloadedmetadata = () => {
                initDimensions();
                resolve(videoElement);
            };
        });
    } catch (err) {
        console.error('Error accessing camera:', err);
        throw err;
    }
}

// Main loop
async function predictWebcam() {
    if (!isRunning) return;
    
    if (videoElement.videoWidth) {
        await hands.send({image: videoElement});
        await faceMesh.send({image: videoElement});
    }
    
    requestAnimationFrame(predictWebcam);
}

// Start/Stop handler
async function toggleCamera() {
    try {
        if (!isRunning) {
            startButton.disabled = true;
            startButton.textContent = 'Starting...';
            
            // Initialize everything
            await Promise.all([
                setupCamera(),
                initFaceMesh(),
                initHands()
            ]);
            
            isRunning = true;
            startButton.textContent = 'Disable Camera';
            predictWebcam();
        } else {
            isRunning = false;
            const stream = videoElement.srcObject;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            videoElement.srcObject = null;
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            startButton.textContent = 'Enable Camera';
        }
    } catch (err) {
        console.error('Setup error:', err);
        alert('Error setting up camera. Please check console and refresh.');
        startButton.textContent = 'Enable Camera';
    }
    startButton.disabled = false;
}

// Event listeners
startButton.addEventListener('click', toggleCamera);

// Error handling
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    alert('An error occurred. Please check console and refresh.');
});
