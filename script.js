import { GestureRecognizer, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

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

let gestureRecognizer;
let runningMode = "IMAGE";
let webcamRunning = false;
let boundaryTimer = null;
let isNedryShowing = false;
let countdownInterval = null;
let timeRemaining = 3;

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

// Initialize the GestureRecognizer
const createGestureRecognizer = async () => {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
        },
        runningMode: runningMode,
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
};

// Initialize MediaPipe
createGestureRecognizer();

// Set initial dimensions
function updateDimensions() {
    canvasElement.width = container.offsetWidth;
    canvasElement.height = container.offsetHeight;
    videoElement.width = container.offsetWidth;
    videoElement.height = container.offsetHeight;
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
    if (!gestureRecognizer) {
        alert("Please wait for model to load");
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

let lastVideoTime = -1;
let results = undefined;
const drawingUtils = new DrawingUtils(canvasCtx);

// Function to check if hand is near face area
function isHandNearFace(landmarks) {
    if (!landmarks || landmarks.length === 0) return false;
    
    // Define face area boundaries (relative coordinates)
    const faceArea = {
        top: 0.6,    // Approximately mouth level
        bottom: 0.8, // Lower chin/neck
        left: 0.3,   // Left side of face
        right: 0.7   // Right side of face
    };

    // Check if any landmarks are in the face area
    return landmarks.some(point => {
        return point.y >= faceArea.top &&
               point.y <= faceArea.bottom &&
               point.x >= faceArea.left &&
               point.x <= faceArea.right;
    });
}

// Draw face boundary box
function drawFaceBoundary(ctx, width, height) {
    const faceArea = {
        top: 0.6,
        bottom: 0.8,
        left: 0.3,
        right: 0.7
    };

    ctx.beginPath();
    ctx.strokeStyle = '#8e7af7';
    ctx.lineWidth = 2;
    ctx.rect(
        faceArea.left * width,
        faceArea.top * height,
        (faceArea.right - faceArea.left) * width,
        (faceArea.bottom - faceArea.top) * height
    );
    ctx.stroke();
}

// Predict webcam
async function predictWebcam() {
    const webcamElement = videoElement;
    
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
    }
    
    let nowInMs = Date.now();
    if (videoElement.currentTime !== lastVideoTime) {
        lastVideoTime = videoElement.currentTime;
        results = gestureRecognizer.recognizeForVideo(videoElement, nowInMs);
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks) {
        for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
                color: "#8e7af7",
                lineWidth: 2
            });
            drawingUtils.drawLandmarks(landmarks, {
                color: "#8e7af7",
                lineWidth: 1
            });

            if (isHandNearFace(landmarks)) {
                showTextAlert();
                handleBoundaryViolation();
                updateConfidenceMeter(1.0);
            } else {
                hideTextAlert();
                resetBoundaryTimer();
                updateConfidenceMeter(0);
            }
        }
    } else {
        hideTextAlert();
        resetBoundaryTimer();
        updateConfidenceMeter(0);
    }

    // Draw face boundary
    drawFaceBoundary(canvasCtx, canvasElement.width, canvasElement.height);

    canvasCtx.restore();

    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
}

// Initialize
updateDimensions();
window.addEventListener('resize', updateDimensions);
