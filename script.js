const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const nedryPopup = document.getElementById('nedry_popup');
const textAlert = document.getElementById('text_alert');
const nedryAudio = document.getElementById('nedry_audio');
const container = document.querySelector('.container');
const confidenceLevel = document.getElementById('confidence_level');
const confidenceText = document.getElementById('confidence_text');
const countdownContainer = document.getElementById('countdown_container');
const countdownNumber = document.getElementById('countdown_number');

// Configuration for proxy server
const PROXY_URL = "http://localhost:3001";

// Function to send signal to Tasmota relay
function sendSignalToRelay() {
    const url = `${PROXY_URL}/tasmota/cm?cmnd=POWER1%20TOGGLE`;
    console.log('Sending request to:', url);
    
    fetch(url, {
        method: 'GET',
    })
    .then(response => {
        console.log('Response status:', response.status);
        return response.text().then(text => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            }
            return text;
        });
    })
    .then(data => {
        console.log('Signal sent to Tasmota device');
    })
    .catch(error => {
        console.error('Error sending signal to Tasmota:', error);
    });
}

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
let countdownInterval = null;
let timeRemaining = 3;
let webcamRunning = false;

// Handle hands results
hands.onResults((results) => {
    handResults = results;
    if (results.multiHandLandmarks && boundaryPoints.length > 0) {
        let isCrossing = false;
        for (const landmarks of results.multiHandLandmarks) {
            const confidence = calculateFingerFaceConfidence(landmarks, boundaryPoints);
            updateConfidenceMeter(confidence);
            
            if (confidence > 0.8) {
                isCrossing = true;
                handleBoundaryViolation();
            }
        }
        if (isCrossing) {
            showTextAlert();
        } else {
            hideTextAlert();
            resetBoundaryTimer();
        }
    } else {
        updateConfidenceMeter(0);
        hideTextAlert();
        resetBoundaryTimer();
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

// Show text alert
function showTextAlert() {
    if (textAlert.style.display !== 'block') {
        textAlert.style.display = 'block';
        textAlert.classList.add('fade-in');
    }
}

// Hide text alert
function hideTextAlert() {
    if (textAlert.style.display === 'block') {
        textAlert.style.display = 'none';
        textAlert.classList.remove('fade-in');
    }
}

// Handle boundary violation
function handleBoundaryViolation() {
    if (!boundaryTimer && !isNedryShowing) {
        timeRemaining = 3;
        updateCountdown();
        showCountdown();
        boundaryTimer = setTimeout(() => {
            showNedryAlert();
            sendSignalToRelay();
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
        }, 4000);
    }
}

// Check if webcam access is supported
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Enable webcam
async function enableCam() {
    if (!hands || !faceMesh) {
        alert("Please wait for models to load");
        return;
    }

    if (webcamRunning) {
        webcamRunning = false;
        enableWebcamButton.innerText = "ENABLE CAMERA";
        // Stop the video stream
        if (videoElement.srcObject) {
            const tracks = videoElement.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoElement.srcObject = null;
        }
    } else {
        webcamRunning = true;
        enableWebcamButton.innerText = "DISABLE CAMERA";

        // Activate the webcam stream.
        try {
            const constraints = { video: true };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = stream;
            videoElement.addEventListener("loadeddata", predictWebcam);
        } catch (err) {
            console.error("Error accessing webcam:", err);
            alert("Error accessing webcam. Please ensure camera permissions are granted.");
            webcamRunning = false;
            enableWebcamButton.innerText = "ENABLE CAMERA";
        }
    }
}

// Create enable webcam button
const enableWebcamButton = document.createElement('button');
enableWebcamButton.innerText = "ENABLE CAMERA";
enableWebcamButton.style.position = 'absolute';
enableWebcamButton.style.top = '50%';
enableWebcamButton.style.left = '50%';
enableWebcamButton.style.transform = 'translate(-50%, -50%)';
enableWebcamButton.style.zIndex = '9';
enableWebcamButton.classList.add('mdc-button', 'mdc-button--raised');
container.appendChild(enableWebcamButton);

// Check webcam support
if (hasGetUserMedia()) {
    enableWebcamButton.addEventListener("click", enableCam);
} else {
    console.warn("getUserMedia() is not supported by your browser");
    alert("getUserMedia() is not supported by your browser");
}

// Predict webcam
async function predictWebcam() {
    if (webcamRunning) {
        await hands.send({image: videoElement});
        await faceMesh.send({image: videoElement});
        window.requestAnimationFrame(predictWebcam);
    }
}

// Initialize
updateDimensions();
window.addEventListener('resize', updateDimensions);

// Initialize MediaPipe
Promise.all([
    hands.initialize(),
    faceMesh.initialize()
]).catch(error => {
    console.error('Error initializing:', error);
    alert('Error initializing models');
});
