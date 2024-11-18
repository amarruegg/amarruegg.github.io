const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const textAlert = document.getElementById('text_alert');
const nedryPopup = document.getElementById('nedry_popup');
const nedryAudio = document.getElementById('nedry_audio');
const alarmAudio = document.getElementById('alarm');
const container = document.querySelector('.container');
const confidenceLevel = document.getElementById('confidence_level');
const confidenceText = document.getElementById('confidence_text');
const countdownContainer = document.getElementById('countdown_container');
const countdownNumber = document.getElementById('countdown_number');
const modeButtons = document.querySelectorAll('.mode-button');
const soundButtons = document.querySelectorAll('.sound-button');
const initializationNotice = document.getElementById('initialization_notice');

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
let activeModes = new Set();
let isInitialized = false;
let currentSound = 'none'; // Default to no sound
let isAlertVisible = false;

const HAND_TIMEOUT = 150;
const CONFIDENCE_THRESHOLD = 0.8;
const EYE_BOUNDARY_OFFSET = 0.025;
const SCALP_OFFSET = 0.1;

// Mode selector handler
modeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const mode = button.dataset.mode;
        if (activeModes.has(mode)) {
            activeModes.delete(mode);
            button.classList.remove('active');
        } else {
            activeModes.add(mode);
            button.classList.add('active');
        }
    });
});

// Sound selector handler
soundButtons.forEach(button => {
    button.addEventListener('click', () => {
        const sound = button.dataset.sound;
        soundButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentSound = sound;
    });
});

// Get boundary points for a specific mode
function getBoundaryPointsForMode(faceLandmarks, mode) {
    if (!faceLandmarks) return [];

    switch (mode) {
        case 'mouth': {
            const mouthIndices = [
                61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
                291, 375, 321, 405, 314, 17, 84, 181, 91, 146
            ];

            return mouthIndices.map(index => {
                const point = faceLandmarks[index];
                return {
                    x: point.x,
                    y: point.y,
                    mode: 'mouth'
                };
            });
        }
        case 'eyes': {
            const eyeIndices = [
                33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7,
                362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382
            ];
            
            const points = eyeIndices.map(index => {
                const point = faceLandmarks[index];
                return {
                    x: point.x,
                    y: point.y,
                    originalX: point.x,
                    originalY: point.y,
                    mode: 'eyes'
                };
            });

            points.forEach(point => {
                const centerX = 0.5;
                const centerY = 0.5;
                point.x += (point.x - centerX) * EYE_BOUNDARY_OFFSET;
                point.y += (point.y - centerY) * EYE_BOUNDARY_OFFSET;
            });

            return points;
        }
        case 'scalp': {
            const scalpIndices = [
                234, 127, 162, 21,
                54, 103, 67, 109, 10, 338, 297, 332, 284,
                251, 389, 356, 454
            ];

            const offsetPoints = new Set([54, 103, 67, 109, 10, 338, 297, 332, 284]);

            return scalpIndices.map(index => {
                const point = faceLandmarks[index];
                if (offsetPoints.has(index)) {
                    return {
                        x: point.x,
                        y: point.y - SCALP_OFFSET,
                        mode: 'scalp'
                    };
                }
                return {
                    x: point.x,
                    y: point.y,
                    mode: 'scalp'
                };
            });
        }
        case 'beard': {
            const lowerFaceIndices = [
                234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
                377, 400, 378, 379, 365, 397, 288, 361, 447
            ];

            const offsetIndices = new Set([172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365]);

            return lowerFaceIndices.map(index => {
                const point = faceLandmarks[index];
                return {
                    x: point.x,
                    y: point.y + (offsetIndices.has(index) ? 0.05 : 0),
                    mode: 'beard'
                };
            });
        }
        default:
            return [];
    }
}

// Get all active boundary points
function getBoundaryPoints(faceLandmarks) {
    if (!faceLandmarks || activeModes.size === 0) return [];
    
    const allPoints = [];
    activeModes.forEach(mode => {
        const modePoints = getBoundaryPointsForMode(faceLandmarks, mode);
        allPoints.push(...modePoints);
    });
    
    return allPoints;
}

// Handle hands results
hands.onResults((results) => {
    handResults = results;
    const now = Date.now();
    let maxCurrentConfidence = 0;
    
    if (results.multiHandLandmarks && 
        results.multiHandLandmarks.length > 0 && 
        boundaryPoints.length > 0) {
        
        for (const landmarks of results.multiHandLandmarks) {
            const confidence = calculateFingerFaceConfidence(landmarks, boundaryPoints);
            maxCurrentConfidence = Math.max(maxCurrentConfidence, confidence);
        }
        
        if (maxCurrentConfidence > CONFIDENCE_THRESHOLD) {
            lastHandDetectionTime = now;
        }
    }
    
    updateConfidenceMeter(maxCurrentConfidence);
    
    const timeSinceLastDetection = now - lastHandDetectionTime;
    const shouldMaintainViolation = maxCurrentConfidence > CONFIDENCE_THRESHOLD && 
                                  timeSinceLastDetection < HAND_TIMEOUT;
    
    if (shouldMaintainViolation) {
        if (!isBoundaryViolation) {
            isBoundaryViolation = true;
            showAlert();
        }
    } else {
        if (isBoundaryViolation) {
            isBoundaryViolation = false;
            hideAlert();
            resetBoundaryTimer();
        }
    }
});

// Handle face mesh results
faceMesh.onResults((results) => {
    if (!isInitialized && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        isInitialized = true;
        initializationNotice.style.display = 'none';
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        faceLandmarks = results.multiFaceLandmarks[0];
        boundaryPoints = getBoundaryPoints(faceLandmarks);
        
        if (boundaryPoints.length > 0) {
            const pointsByMode = {};
            boundaryPoints.forEach(point => {
                if (!pointsByMode[point.mode]) {
                    pointsByMode[point.mode] = [];
                }
                pointsByMode[point.mode].push(point);
            });

            Object.entries(pointsByMode).forEach(([mode, points]) => {
                canvasCtx.beginPath();
                const firstPoint = points[0];
                canvasCtx.moveTo(
                    (mode === 'eyes' ? firstPoint.originalX : firstPoint.x) * canvasElement.width,
                    (mode === 'eyes' ? firstPoint.originalY : firstPoint.y) * canvasElement.height
                );
                
                for (let i = 1; i < points.length; i++) {
                    const current = points[i];
                    const prev = points[i-1];
                    
                    const xc = ((mode === 'eyes' ? current.originalX : current.x) + 
                              (mode === 'eyes' ? prev.originalX : prev.x)) / 2 * canvasElement.width;
                    const yc = ((mode === 'eyes' ? current.originalY : current.y) + 
                              (mode === 'eyes' ? prev.originalY : prev.y)) / 2 * canvasElement.height;
                    
                    canvasCtx.quadraticCurveTo(
                        (mode === 'eyes' ? prev.originalX : prev.x) * canvasElement.width,
                        (mode === 'eyes' ? prev.originalY : prev.y) * canvasElement.height,
                        xc,
                        yc
                    );
                }
                
                const lastPoint = points[points.length-1];
                const firstPointClose = points[0];
                
                const xc = ((mode === 'eyes' ? firstPointClose.originalX : firstPointClose.x) + 
                           (mode === 'eyes' ? lastPoint.originalX : lastPoint.x)) / 2 * canvasElement.width;
                const yc = ((mode === 'eyes' ? firstPointClose.originalY : firstPointClose.y) + 
                           (mode === 'eyes' ? lastPoint.originalY : lastPoint.y)) / 2 * canvasElement.height;
                
                canvasCtx.quadraticCurveTo(
                    (mode === 'eyes' ? lastPoint.originalX : lastPoint.x) * canvasElement.width,
                    (mode === 'eyes' ? lastPoint.originalY : lastPoint.y) * canvasElement.height,
                    xc,
                    yc
                );
                
                canvasCtx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                canvasCtx.lineWidth = 2;
                canvasCtx.stroke();
            });
        }
    }

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

function calculateFingerFaceConfidence(handLandmarks, boundaryPoints) {
    if (boundaryPoints.length === 0) return 0;

    const fingerTips = [4, 8, 12, 16, 20];
    let maxConfidence = 0;

    for (const tipIndex of fingerTips) {
        const fingerTip = handLandmarks[tipIndex];
        let minDist = Infinity;
        
        for (let i = 0; i < boundaryPoints.length - 1; i++) {
            const p1 = boundaryPoints[i];
            const p2 = boundaryPoints[i + 1];
            
            const p1x = p1.mode === 'eyes' ? p1.x : p1.x;
            const p1y = p1.mode === 'eyes' ? p1.y : p1.y;
            const p2x = p2.mode === 'eyes' ? p2.x : p2.x;
            const p2y = p2.mode === 'eyes' ? p2.y : p2.y;
            
            const d = pointToLineDistance(fingerTip, {x: p1x, y: p1y}, {x: p2x, y: p2y});
            minDist = Math.min(minDist, d);
        }

        const confidence = Math.max(0, Math.min(1, 1 - (minDist / 0.1)));
        maxConfidence = Math.max(maxConfidence, confidence);
    }

    return maxConfidence;
}

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

function updateConfidenceMeter(confidence) {
    const percentage = Math.round(confidence * 100);
    confidenceLevel.style.width = `${percentage}%`;
    confidenceText.textContent = `${percentage}%`;
}

function showAlert() {
    if (!isAlertVisible) {
        isAlertVisible = true;
        textAlert.style.display = 'block';
        // Force a reflow to ensure the transition works
        textAlert.offsetHeight;
        textAlert.classList.add('visible');
        showCountdown();
        
        if (!boundaryTimer && !isNedryShowing) {
            timeRemaining = 3;
            updateCountdown();
            
            boundaryTimer = setTimeout(() => {
                if (currentSound === 'nedry') {
                    showNedryAlert();
                } else if (currentSound === 'alarm') {
                    playAlarmSound();
                }
                // Send signal to Tasmota
                fetch('http://localhost:3001/tasmota/cm?cmnd=POWER1%20TOGGLE')
                    .catch(err => console.log('Proxy communication error:', err));
            }, 3000);

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
}

function hideAlert() {
    if (isAlertVisible) {
        isAlertVisible = false;
        textAlert.classList.remove('visible');
        setTimeout(() => {
            if (!isAlertVisible) { // Check again in case alert was shown again
                textAlert.style.display = 'none';
            }
        }, 200); // Match the CSS transition duration
    }
}

function playAlarmSound() {
    alarmAudio.currentTime = 0;
    alarmAudio.play();
}

function showCountdown() {
    countdownContainer.style.display = 'flex';
}

function hideCountdown() {
    countdownContainer.style.display = 'none';
}

function updateCountdown() {
    countdownNumber.textContent = timeRemaining;
}

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

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
        await faceMesh.send({image: videoElement});
    },
    width: container.offsetWidth,
    height: container.offsetHeight
});

updateDimensions();
window.addEventListener('resize', updateDimensions);

camera.start();
hands.initialize();
faceMesh.initialize();
