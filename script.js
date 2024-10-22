// Copyright 2023 The MediaPipe Authors.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//      http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { GestureRecognizer, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

const demosSection = document.getElementById("demos");
let gestureRecognizer;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
const videoHeight = "360px";
const videoWidth = "480px";

// Configuration for proxy server
const PROXY_URL = "http://localhost:3001"; // Update this if your proxy is running on a different host/port

console.log('Script loaded. PROXY_URL:', PROXY_URL);

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
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
// Check if webcam access is supported.
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
    enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.addEventListener("click", enableCam);
}
else {
    console.warn("getUserMedia() is not supported by your browser");
}
// Enable the live webcam view and start detection.
function enableCam(event) {
    if (!gestureRecognizer) {
        alert("Please wait for gestureRecognizer to load");
        return;
    }
    if (webcamRunning === true) {
        webcamRunning = false;
        enableWebcamButton.innerText = "ENABLE PREDICTIONS";
    }
    else {
        webcamRunning = true;
        enableWebcamButton.innerText = "DISABLE PREDICTIONS";
    }
    // getUsermedia parameters.
    const constraints = {
        video: true
    };
    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    });
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;
        video.addEventListener("loadeddata", function() {
          // Append the enableWebcamButton to the #demos section
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

//function to send signal to WiFi relay
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
let touchingStartTime = null; // Add this line
let soundPlaying = false; // Add this line
const audio = new Audio('alarm.mp3');
async function predictWebcam() {
    const webcamElement = document.getElementById("webcam");
    // Now let's start detecting the stream.
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
    }
    let nowInMs = Date.now();
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        results = gestureRecognizer.recognizeForVideo(video, nowInMs);
    }
    if (results.gestures.length > 0 && results.gestures[0][0].categoryName === "touching") {
        if (!touchingStartTime) {
            touchingStartTime = Date.now();
        } else if (Date.now() - touchingStartTime >= 1000 && !soundPlaying) {
            audio.play();
            sendSignalToRelay();
            soundPlaying = true;
        }
    } else {
        touchingStartTime = null;
        if (soundPlaying) {
            audio.pause(); // Stop the sound if the gesture is not "touching"
            audio.currentTime = 0; // Reset audio playback to the start
            soundPlaying = false;
        }
    }
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
    if (results.gestures.length > 0) {
        gestureOutput.style.display = "block";
        gestureOutput.style.width = videoWidth;
        const categoryName = results.gestures[0][0].categoryName;
        const categoryScore = parseFloat(results.gestures[0][0].score * 100).toFixed(2);
        const handedness = results.handednesses[0][0].displayName;
        gestureOutput.innerText = `GestureRecognizer: ${categoryName}\n Confidence: ${categoryScore} %\n Handedness: ${handedness}`;
    }
    else {
        gestureOutput.style.display = "none";
    }
    // Call this function again to keep predicting when the browser is ready.
    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}

// Add this code to create a stop button and append it to your page
const stopButton = document.createElement("button");
stopButton.innerText = "Stop";
stopButton.addEventListener("click", stopSound);
document.body.appendChild(stopButton); // Append the button to the body or another element of your choice

// Add this function to stop the sound
function stopSound() {
    audio.pause();
    audio.currentTime = 0; // Reset audio playback to the start
    soundPlaying = false;
}

// Check if Picture-in-Picture is supported
if ('pictureInPictureEnabled' in document) {
    const pipButton = document.createElement("button");
    pipButton.innerText = "Minimize Video";
    pipButton.addEventListener("click", togglePiP);
    const demosSection = document.getElementById("demos"); // Get the demos section
    demosSection.appendChild(pipButton); // Append the button to the demos section
} else {
    console.error("Picture-in-Picture is not supported by this browser.");
}

// Function to toggle Picture-in-Picture
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

console.log('Script fully loaded and executed.');
