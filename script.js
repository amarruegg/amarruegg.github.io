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
const modeButtons = document.querySelectorAll('.mode-button');

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
let isBoundaryViolation = false;
let currentMode = 'beard';

const HAND_TIMEOUT = 150;
const CONFIDENCE_THRESHOLD = 0.8;
const EYE_BOUNDARY_OFFSET = 0.025; // About a quarter inch at typical webcam distance

// Mode selector handler
modeButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Update active state
        modeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentMode = button.dataset.mode;
    });
});

// Get boundary points based on current mode
function getBoundaryPoints(faceLandmarks) {
    if (!faceLandmarks) return [];

    switch (currentMode) {
        case 'eyes': {
            // Combined left and right eye points
            const eyeIndices = [
                // Left eye
                33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7,
                // Right eye
                362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382
            ];
            
            const points = eyeIndices.map(index => {
                const point = faceLandmarks[index];
                return {
                    x: point.x,
                    y: point.y,
                    originalX: point.x,
                    originalY: point.y
                };
            });

            // Add offset to detection points
            points.forEach(point => {
                const centerX = 0.5;
                const centerY = 0.5;
                point.x += (point.x - centerX) * EYE_BOUNDARY_OFFSET;
                point.y += (point.y - centerY) * EYE_BOUNDARY_OFFSET;
            });

            return points;
        }
        case 'scalp': {
            // Specific scalp boundary points
            const scalpIndices = [
                234, // Left ear area
                127, 162, 21, 54, 103, 67, 109, 10, // Left scalp
                338, 297, 332, 284, 251, 389, 356, // Right scalp
                454  // Right ear area
            ];
            return scalpIndices.map(index => faceLandmarks[index]);
        }
        default: { // beard mode
            // Original beard boundary points
            const lowerFaceIndices = [
                234, // Left ear area
                93, 132, 58, 172, 136, 150, 149, 176, 148, 152, // Left jaw line
                377, 400, 378, 379, 365, 397, 288, 361, // Right jaw line
                447  // Right ear area
            ];
            return lowerFaceIndices.map(index => faceLandmarks[index]);
        }
    }
}

// Handle hands results
hands.onResults((results) => {
    handResults = results;
    const now = Date.now();
    let maxCurrentConfidence = 0;
    
    // Calculate current confidence if hands are present
    if (results.multiHandLandmarks && 
        results.multiHandLandmarks.length > 0 && 
        boundaryPoints.length > 0) {
        
        // Calculate maximum confidence across all hands
        for (const landmarks of results.multiHandLandmarks) {
            const confidence = calculateFingerFaceConfidence(landmarks, boundaryPoints);
            maxCurrentConfidence = Math.max(maxCurrentConfidence, confidence);
        }
        
        // Update last detection time only if confidence is high enough
        if (maxCurrentConfidence > CONFIDENCE_THRESHOLD) {
            lastHandDetectionTime = now;
        }
    }
    
    // Update confidence meter
    updateConfidenceMeter(maxCurrentConfidence);
    
    // Check if we should maintain boundary violation
    const timeSinceLastDetection = now - lastHandDetectionTime;
    const shouldMaintainViolation = maxCurrentConfidence > CONFIDENCE_THRESHOLD && 
                                  timeSinceLastDetection < HAND_TIMEOUT;
    
    if (shouldMaintainViolation) {
        // Start or maintain violation
        if (!isBoundaryViolation) {
            isBoundaryViolation = true;
            showAlert();
        }
    } else {
        // End violation
        if (isBoundaryViolation) {
            isBoundaryViolation = false;
            hideTextAlert();
            resetBoundaryTimer();
        }
    }
});

// Handle face mesh results
faceMesh.onResults((results) => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        faceLandmarks = results.multiFaceLandmarks[0];
        boundaryPoints = getBoundaryPoints(faceLandmarks);
        
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
            
            // Draw boundary line
            if (boundaryPoints.length > 0) {
                canvasCtx.beginPath();
                // Use original coordinates for drawing in eye mode
                const firstPoint = currentMode === 'eyes' ? boundaryPoints[0] : boundaryPoints[0];
                canvasCtx.moveTo(
                    (currentMode === 'eyes' ? firstPoint.originalX : firstPoint.x) * canvasElement.width,
                    (currentMode === 'eyes' ? firstPoint.originalY : firstPoint.y) * canvasElement.height
                );
                
                // Use quadratic curves for smoother line
                for (let i = 1; i < boundaryPoints.length; i++) {
                    const current = currentMode === 'eyes' ? boundaryPoints[i] : boundaryPoints[i];
                    const prev = currentMode === 'eyes' ? boundaryPoints[i-1] : boundaryPoints[i-1];
                    
                    const xc = ((currentMode === 'eyes' ? current.originalX : current.x) + 
                               (currentMode === 'eyes' ? prev.originalX : prev.x)) / 2 * canvasElement.width;
                    const yc = ((currentMode === 'eyes' ? current.originalY : current.y) + 
                               (currentMode === 'eyes' ? prev.originalY : prev.y)) / 2 * canvasElement.height;
                    
                    canvasCtx.quadraticCurveTo(
                        (currentMode === 'eyes' ? prev.originalX : prev.x) * canvasElement.width,
                        (currentMode === 'eyes' ? prev.originalY : prev.y) * canvasElement.height,
                        xc,
                        yc
                    );
                }
                
                // Close the path smoothly
                const lastPoint = currentMode === 'eyes' ? boundaryPoints[boundaryPoints.length-1] : boundaryPoints[boundaryPoints.length-1];
                const firstPointClose = currentMode === 'eyes' ? boundaryPoints[0] : boundaryPoints[0];
                
                const xc = ((currentMode === 'eyes' ? firstPointClose.originalX : firstPointClose.x) + 
                           (currentMode === 'eyes' ? lastPoint.originalX : lastPoint.x)) / 2 * canvasElement.width;
                const yc = ((currentMode === 'eyes' ? firstPointClose.originalY : firstPointClose.y) + 
                           (currentMode === 'eyes' ? lastPoint.originalY : lastPoint.y)) / 2 * canvasElement.height;
                
                canvasCtx.quadraticCurveTo(
                    (currentMode === 'eyes' ? lastPoint.originalX : lastPoint.x) * canvasElement.width,
                    (currentMode === 'eyes' ? lastPoint.originalY : lastPoint.y) * canvasElement.height,
                    (currentMode === 'eyes' ? firstPointClose.originalX : firstPointClose.x) * canvasElement.width,
                    (currentMode === 'eyes' ? firstPointClose.originalY : firstPointClose.y) * canvasElement.height
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
            
            // Use offset points for detection in eye mode
            const p1x = currentMode === 'eyes' ? p1.x : p1.x;
            const p1y = currentMode === 'eyes' ? p1.y : p1.y;
            const p2x = currentMode === 'eyes' ? p2.x : p2.x;
            const p2y = currentMode === 'eyes' ? p2.y : p2.y;
            
            // Calculate distance from point to line segment
            const d = pointToLineDistance(fingerTip, {x: p1x, y: p1y}, {x: p2x, y: p2y});
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
