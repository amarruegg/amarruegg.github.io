const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const textAlert = document.getElementById('text_alert');
const nedryPopup = document.getElementById('nedry_popup');
const nedryAudio = document.getElementById('nedry_audio');
const container = document.querySelector('.container');
const confidenceLevel = document.getElementById('confidence_level');
const confidenceText = document.getElementById('confidence_text');
const countdownContainer = document.getElementById('countdown_container');
const countdownNumber = document.getElementById('countdown_number');

// Set initial dimensions
function updateDimensions() {
    canvasElement.width = container.offsetWidth;
    canvasElement.height = container.offsetHeight;
    videoElement.width = container.offsetWidth;
    videoElement.height = container.offsetHeight;
}

// Initialize MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

// Initialize MediaPipe Face Mesh
const faceMesh = new FaceMesh({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }
});

// Configure hands
hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// Configure face mesh
faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

let faceLandmarks = null;
let handResults = null;
let boundaryPoints = [];
let boundaryTimer = null;
let isNedryShowing = false;
let lastAlertTime = 0;
let countdownInterval = null;
let timeRemaining = 3;
let lastHandDetectionTime = 0;
let confidenceResetTimeout = null;
let boundaryResetTimeout = null;

const HAND_TIMEOUT = 150; // Reduced from 200ms to 150ms
const CONFIDENCE_THRESHOLD = 0.8;

// Handle hands results
hands.onResults((results) => {
    handResults = results;
    const now = Date.now();
    
    // Clear any existing timeouts when we get new results
    if (confidenceResetTimeout) {
        clearTimeout(confidenceResetTimeout);
        confidenceResetTimeout = null;
    }
    
    // If no hands are detected
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        // Start a quick decay of confidence
        confidenceResetTimeout = setTimeout(() => {
            updateConfidenceMeter(0);
            hideTextAlert();
            resetBoundaryTimer();
        }, HAND_TIMEOUT);
        return;
    }
    
    // Update last hand detection time
    lastHandDetectionTime = now;

    if (boundaryPoints.length > 0) {
        let maxCurrentConfidence = 0;
        let isCrossing = false;
        
        for (const landmarks of results.multiHandLandmarks) {
            const confidence = calculateFingerFaceConfidence(landmarks, boundaryPoints);
            maxCurrentConfidence = Math.max(maxCurrentConfidence, confidence);
            
            if (confidence > CONFIDENCE_THRESHOLD) {
                isCrossing = true;
                showAlert();
            }
        }
        
        updateConfidenceMeter(maxCurrentConfidence);

        if (!isCrossing) {
            // Add small delay before resetting boundary
            if (boundaryResetTimeout) {
                clearTimeout(boundaryResetTimeout);
            }
            boundaryResetTimeout = setTimeout(() => {
                hideTextAlert();
                resetBoundaryTimer();
            }, HAND_TIMEOUT);
        }
    } else {
        updateConfidenceMeter(0);
    }
});

// Handle face mesh results
faceMesh.onResults((results) => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        faceLandmarks = results.multiFaceLandmarks[0];
        
        // Get lower face boundary points
        const lowerFaceIndices = [
            234, // Left ear area
            93, 132, 58, 172, 136, 150, 149, 176, 148, 152, // Left jaw line
            377, 400, 378, 379, 365, 397, 288, 361, // Right jaw line
            447  // Right ear area (symmetric with 234)
        ];
        boundaryPoints = lowerFaceIndices.map(index => faceLandmarks[index]);
        
        // Draw face mesh
        for (const landmarks of results.multiFaceLandmarks) {
            drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION,
                {color: 'rgba(255, 255, 255, 0.2)', lineWidth: 1});
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE,
                {color: 'rgba(255, 255, 255, 0.4)'});
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE,
                {color: 'rgba(255, 255, 255, 0.4)'});
            drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL,
                {color: 'rgba(255, 255, 255, 0.4)'});
            
            // Draw smooth boundary line
            if (boundaryPoints.length > 0) {
                canvasCtx.beginPath();
                canvasCtx.moveTo(
                    boundaryPoints[0].x * canvasElement.width,
                    boundaryPoints[0].y * canvasElement.height
                );
                
                // Use quadratic curves for smoother line
                for (let i = 1; i < boundaryPoints.length; i++) {
                    const xc = (boundaryPoints[i].x + boundaryPoints[i-1].x) / 2 * canvasElement.width;
                    const yc = (boundaryPoints[i].y + boundaryPoints[i-1].y) / 2 * canvasElement.height;
                    canvasCtx.quadraticCurveTo(
                        boundaryPoints[i-1].x * canvasElement.width,
                        boundaryPoints[i-1].y * canvasElement.height,
                        xc,
                        yc
                    );
                }
                // Close the path smoothly
                const lastPoint = boundaryPoints[boundaryPoints.length-1];
                const firstPoint = boundaryPoints[0];
                const xc = (firstPoint.x + lastPoint.x) / 2 * canvasElement.width;
                const yc = (firstPoint.y + lastPoint.y) / 2 * canvasElement.height;
                canvasCtx.quadraticCurveTo(
                    lastPoint.x * canvasElement.width,
                    lastPoint.y * canvasElement.height,
                    firstPoint.x * canvasElement.width,
                    firstPoint.y * canvasElement.height
                );
                
                canvasCtx.strokeStyle = '#8e7af7';
                canvasCtx.lineWidth = 2;
                canvasCtx.stroke();
            }
        }
    }

    // Draw hands
    if (handResults && handResults.multiHandLandmarks) {
        for (const landmarks of handResults.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS,
                {color: '#8e7af7', lineWidth: 2});
            drawLandmarks(canvasCtx, landmarks, {
                color: '#8e7af7',
                fillColor: '#8e7af7',
                lineWidth: 1,
                radius: 2
            });
        }
    }

    canvasCtx.restore();
});

// Calculate confidence of finger crossing face boundary
function calculateFingerFaceConfidence(handLandmarks, boundaryPoints) {
    if (boundaryPoints.length === 0) return 0;

    // Get finger tips
    const fingerTips = [4, 8, 12, 16, 20];
    let maxConfidence = 0;

    for (const tipIndex of fingerTips) {
        const fingerTip = handLandmarks[tipIndex];
        
        // Find closest point on boundary
        let minDist = Infinity;
        for (let i = 0; i < boundaryPoints.length - 1; i++) {
            const p1 = boundaryPoints[i];
            const p2 = boundaryPoints[i + 1];
            
            // Calculate distance from point to line segment
            const d = pointToLineDistance(fingerTip, p1, p2);
            minDist = Math.min(minDist, d);
        }

        // Convert distance to confidence (closer = higher confidence)
        const confidence = Math.max(0, Math.min(1, 1 - (minDist / 0.1)));
        maxConfidence = Math.max(maxConfidence, confidence);
    }

    return maxConfidence;
}

// Calculate distance from point to line segment
function pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
        param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
        xx = lineStart.x;
        yy = lineStart.y;
    } else if (param > 1) {
        xx = lineEnd.x;
        yy = lineEnd.y;
    } else {
        xx = lineStart.x + param * C;
        yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;

    return Math.sqrt(dx * dx + dy * dy);
}

// Update confidence meter
function updateConfidenceMeter(confidence) {
    const percentage = Math.round(confidence * 100);
    confidenceLevel.style.width = `${percentage}%`;
    confidenceText.textContent = `${percentage}%`;
}

// Show alert
function showAlert() {
    const now = Date.now();
    
    // Show text alert immediately
    if (now - lastAlertTime > 1000) {
        textAlert.style.display = 'block';
        textAlert.classList.add('fade-in');
        lastAlertTime = now;
    }

    // Start Nedry alert timer if not already running
    if (!boundaryTimer && !isNedryShowing) {
        timeRemaining = 3;
        updateCountdown();
        showCountdown();
        
        boundaryTimer = setTimeout(() => {
            showNedryAlert();
            // Send signal to Tasmota
            fetch('http://localhost:3001/tasmota/cm?cmnd=POWER1%20TOGGLE')
                .catch(err => console.log('Proxy communication error:', err));
        }, 3000);

        // Start countdown
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            timeRemaining--;
            updateCountdown();
            if (timeRemaining <= 0) {
                clearInterval(countdownInterval);
                hideCountdown();
            }
        }, 1000);
    }
}

// Show countdown
function showCountdown() {
    countdownContainer.style.display = 'flex';
}

// Hide countdown
function hideCountdown() {
    countdownContainer.style.display = 'none';
}

// Update countdown display
function updateCountdown() {
    countdownNumber.textContent = timeRemaining;
}

// Show Nedry alert
function showNedryAlert() {
    if (!isNedryShowing) {
        isNedryShowing = true;
        nedryPopup.style.display = 'block';
        nedryPopup.classList.add('fade-in');
        nedryAudio.currentTime = 0;
        nedryAudio.play();

        setTimeout(() => {
            nedryPopup.style.display = 'none';
            nedryPopup.classList.remove('fade-in');
            isNedryShowing = false;
            boundaryTimer = null;
        }, 4000);
    }
}

// Reset boundary timer
function resetBoundaryTimer() {
    if (boundaryTimer) {
        clearTimeout(boundaryTimer);
        boundaryTimer = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    hideCountdown();
}

// Hide text alert
function hideTextAlert() {
    if (textAlert.style.display === 'block') {
        textAlert.style.display = 'none';
        textAlert.classList.remove('fade-in');
    }
}

// Set up camera
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
        await faceMesh.send({image: videoElement});
    },
    width: container.offsetWidth,
    height: container.offsetHeight
});

// Initialize dimensions
updateDimensions();

// Add window resize handling
window.addEventListener('resize', updateDimensions);

// Start camera and initialize MediaPipe
camera.start();
hands.initialize();
faceMesh.initialize();
