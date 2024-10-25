import { GestureRecognizer, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

const demosSection = document.getElementById("demos");
let gestureRecognizer;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
const videoHeight = "360px";
const videoWidth = "480px";

// Configuration for proxy server
const PROXY_URL = "http://localhost:3001";

console.log('Script loaded. PROXY_URL:', PROXY_URL);

// Initialize the GestureRecognizer with specific focus on face/beard area
const createGestureRecognizer = async () => {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "face_gesture_recognizer.task",
            delegate: "GPU"
        },
        runningMode: runningMode
    });
    demosSection.classList.remove("invisible");
};
createGestureRecognizer();

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const gestureOutput = document.getElementById("gesture_output");

// Check if webcam access is supported
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

if (hasGetUserMedia()) {
    enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.addEventListener("click", enableCam);
} else {
    console.warn("getUserMedia() is not supported by your browser");
}

function enableCam(event) {
    if (!gestureRecognizer) {
        alert("Please wait for gestureRecognizer to load");
        return;
    }
    if (webcamRunning === true) {
        webcamRunning = false;
        enableWebcamButton.innerText = "ENABLE BEARD TOUCH DETECTION";
    } else {
        webcamRunning = true;
        enableWebcamButton.innerText = "DISABLE BEARD TOUCH DETECTION";
    }

    const constraints = {
        video: true
    };

    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;
        video.addEventListener("loadeddata", function() {
            enableWebcamButton.style.position = 'relative';
            enableWebcamButton.style.top = 'initial';
            enableWebcamButton.style.left = 'initial';
            enableWebcamButton.style.transform = 'initial';
            enableWebcamButton.style.zIndex = 'initial';
            document.getElementById("demos").appendChild(enableWebcamButton);
            predictWebcam();
        });
    });
}

window.sendSignalToRelay = function() {
    const url = `${PROXY_URL}/tasmota/cm?cmnd=POWER1%20TOGGLE`;
    console.log('Sending request to:', url);
    
    fetch(url, {
        method: 'GET',
    })
    .then(response => {
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        return response.text().then(text => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
            }
            return text;
        });
    })
    .then(data => {
        console.log('Response data:', data);
        console.log('Signal sent to Tasmota device');
    })
    .catch(error => {
        console.error('Error:', error);
        console.error('Error details:', error.message);
    });
}

let lastVideoTime = -1;
let results = undefined;
let beardTouchingStartTime = null;
let soundPlaying = false;
const audio = new Audio('alarm.mp3');

// Function to check if hand landmarks are in beard area
function isHandNearBeard(landmarks) {
    if (!landmarks || landmarks.length === 0) return false;
    
    // Expanded beard area boundaries with better chin/neck coverage
    const beardArea = {
        top: 0.55,    // Slightly higher to catch upper beard
        bottom: 0.85, // Lower to better detect neck/chin touches
        left: 0.3,    // Left side of face
        right: 0.7,   // Right side of face
    };

    // Check index finger tip and middle finger tip (most common touching points)
    const primaryFingerIndices = [8, 12]; 
    const primaryTouch = primaryFingerIndices.some(index => {
        const point = landmarks[index];
        return point.y >= beardArea.top &&
               point.y <= beardArea.bottom &&
               point.x >= beardArea.left &&
               point.x <= beardArea.right;
    });

    // Additional check for chin/neck area with wider horizontal range
    const chinArea = {
        top: 0.75,    // Lower chin area
        bottom: 0.85, // Neck area
        left: 0.25,   // Wider range for chin
        right: 0.75   // Wider range for chin
    };

    const chinTouch = landmarks.some(point => {
        return point.y >= chinArea.top &&
               point.y <= chinArea.bottom &&
               point.x >= chinArea.left &&
               point.x <= chinArea.right;
    });

    return primaryTouch || chinTouch;
}

async function predictWebcam() {
    const webcamElement = document.getElementById("webcam");
    
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
    }
    
    let nowInMs = Date.now();
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        results = gestureRecognizer.recognizeForVideo(video, nowInMs);
    }

    // Check for beard touching gesture
    const isBeardTouching = results.landmarks && 
                           results.landmarks.length > 0 && 
                           isHandNearBeard(results.landmarks[0]);

    if (isBeardTouching) {
        if (!beardTouchingStartTime) {
            beardTouchingStartTime = Date.now();
        } else if (Date.now() - beardTouchingStartTime >= 1000 && !soundPlaying) {
            audio.play();
            sendSignalToRelay();
            soundPlaying = true;
        }
    } else {
        beardTouchingStartTime = null;
        if (soundPlaying) {
            audio.pause();
            audio.currentTime = 0;
            soundPlaying = false;
        }
    }

    // Draw landmarks and update canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    const drawingUtils = new DrawingUtils(canvasCtx);
    
    canvasElement.style.height = videoHeight;
    webcamElement.style.height = videoHeight;
    canvasElement.style.width = videoWidth;
    webcamElement.style.width = videoWidth;

    if (results.landmarks) {
        for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
                color: "#00FF00",
                lineWidth: 5
            });
            drawingUtils.drawLandmarks(landmarks, {
                color: "#FF0000",
                lineWidth: 2
            });
        }
    }
    canvasCtx.restore();

    // Update gesture output display
    if (results.landmarks && results.landmarks.length > 0) {
        gestureOutput.style.display = "block";
        gestureOutput.style.width = videoWidth;
        const handedness = results.handednesses[0][0].displayName;
        gestureOutput.innerText = `Status: ${isBeardTouching ? 'Beard Touch Detected!' : 'No Beard Touch'}\n` +
                                 `Hand: ${handedness}`;
    } else {
        gestureOutput.style.display = "none";
    }

    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}

// Stop button functionality
const stopButton = document.createElement("button");
stopButton.innerText = "Stop Alert";
stopButton.addEventListener("click", stopSound);
document.body.appendChild(stopButton);

function stopSound() {
    audio.pause();
    audio.currentTime = 0;
    soundPlaying = false;
}

// Picture-in-Picture functionality
if ('pictureInPictureEnabled' in document) {
    const pipButton = document.createElement("button");
    pipButton.innerText = "Minimize Video";
    pipButton.addEventListener("click", togglePiP);
    const demosSection = document.getElementById("demos");
    demosSection.appendChild(pipButton);
}

async function togglePiP() {
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else {
            const videoElement = document.getElementById("webcam");
            if (videoElement) {
                await videoElement.requestPictureInPicture();
            }
        }
    } catch (error) {
        console.error("Error trying to toggle Picture-in-Picture:", error);
    }
}

console.log('Beard touch detection script fully loaded and executed.');
