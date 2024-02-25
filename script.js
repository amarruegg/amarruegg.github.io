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
import { GestureRecognizer, FilesetResolver, DrawingUtils, FaceLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const demosSection = document.getElementById("demos");
let gestureRecognizer;
let faceLandmarker;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
const imageBlendShapes = document.getElementById("image-blend-shapes");
const videoBlendShapes = document.getElementById("video-blend-shapes");
const videoHeight = "360px";
const videoWidth = "480px";
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

const createFaceLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "face_landmarker.task",
            delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: runningMode,
        numFaces: 1
    });
    demosSection.classList.remove("invisible");
};
createFaceLandmarker();
/********************************************************************
// Demo 2: Continuously grab image from webcam stream and detect it.
********************************************************************/
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
    if (!gestureRecognizer || !faceLandmarker) {
        alert("Please wait for gestureRecognizer and faceLandmarker to load");
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
        enableWebcamButton.style.position = 'relative';
        enableWebcamButton.style.top = 'initial';
        enableWebcamButton.style.left = 'initial';
        enableWebcamButton.style.transform = 'initial';
        enableWebcamButton.style.zIndex = 'initial';
        document.getElementById("demos").appendChild(enableWebcamButton);
        predictWebcam();
    });
});

let lastVideoTime = -1;
let results = undefined;
let faceLandmarkResults;
let gestureResults;
let touchingStartTime = null;
let soundPlaying = false;
const drawingUtils = new DrawingUtils(canvasCtx);
const audio = new Audio('alarm.mp3');

async function predictWebcam() {
    const webcamElement = document.getElementById("webcam");
    const radio = video.videoHeight / video.videoWidth;
    video.style.width = videoWidth + "px";
    video.style.height = videoWidth * radio + "px";
    canvasElement.style.width = videoWidth + "px";
    canvasElement.style.height = videoWidth * radio + "px";
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
        await faceLandmarker.setOptions({ runningMode: "VIDEO" });
    }

    let nowInMs = Date.now();
    let startTimeMs = performance.now();

    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        gestureResults = await gestureRecognizer.recognizeForVideo(video, nowInMs);
        faceLandmarkResults = await faceLandmarker.detectForVideo(video, startTimeMs);
    }

    function handIsTouchingFace(gestureResults, faceLandmarkResults) {
        // Check if the necessary objects exist
        if (!faceLandmarkResults.multiFaceLandmarks || !faceLandmarkResults.multiFaceLandmarks[0]) {
            return false;
        }
    
        // Check if the necessary objects exist
        if (!gestureResults.multiHandLandmarks || !gestureResults.multiHandLandmarks[0]) {
            return false;
        }
    
        const handLandmarks = gestureResults.multiHandLandmarks[0].landmark;
        const faceLandmarks = faceLandmarkResults.multiFaceLandmarks[0].landmark;
    
        // Define a threshold for proximity (adjust as needed)
        const proximityThreshold = 0.05; // Example threshold, adjust as needed
    
        // Check if any hand landmark is close to any face landmark
        for (const handLandmark of handLandmarks) {
            for (const faceLandmark of faceLandmarks) {
                const distance = Math.sqrt(
                    Math.pow(handLandmark.x - faceLandmark.x, 2) +
                    Math.pow(handLandmark.y - faceLandmark.y, 2)
                );
    
                if (distance < proximityThreshold) {
                    return true; // Hand is close to face, consider it as touching
                }
            }
        }
    
        return false; // No hand landmark is close to any face landmark
    }

    if (gestureResults.gestures.length > 0) {
        const categoryName = gestureResults.gestures[0][0].categoryName;
        const categoryScore = parseFloat(gestureResults.gestures[0][0].score * 100).toFixed(2);
        const handedness = gestureResults.handednesses[0][0].displayName;

        let overlayText;

        // Check if both "handIsTouchingFace" and "Touching" gestures are recognized
        if (categoryName === "touching" && handIsTouchingFace(gestureResults, faceLandmarkResults)) {
            overlayText = "Gesture: Touching FACE";

            if (!touchingStartTime) {
                touchingStartTime = Date.now();
            } else if (Date.now() - touchingStartTime >= 1000 && !soundPlaying) {
                audio.play();
                soundPlaying = true;
            }
        } else {
            overlayText = `Gesture: ${categoryName}\n Confidence: ${categoryScore} %\n Handedness: ${handedness}`;
            touchingStartTime = null;
            if (soundPlaying) {
                audio.pause();
                audio.currentTime = 0;
                soundPlaying = false;
            }
        }

        gestureOutput.style.display = "block";
        gestureOutput.style.width = videoWidth;
        gestureOutput.innerText = overlayText;
    } else {
        gestureOutput.style.display = "none";
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    const drawingUtils = new DrawingUtils(canvasCtx);
    canvasElement.style.height = videoHeight;
    webcamElement.style.height = videoHeight;
    canvasElement.style.width = videoWidth;
    webcamElement.style.width = videoWidth;

    if (gestureResults.landmarks) {
        for (const landmarks of gestureResults.landmarks) {
            drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
                color: "#ffffff",
                lineWidth: 4
            });
            drawingUtils.drawLandmarks(landmarks, {
                color: "#9031d4",
                lineWidth: 2
            });
            drawingUtils.drawBoundingBox(boundingBox, { 
                color: "#30FF30",
                lineWidth: 2
            });
        }
    }

    canvasCtx.restore();

    if (faceLandmarkResults.faceLandmarks) {
        for (const landmarks of faceLandmarkResults.faceLandmarks) {
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: "#FF3030" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: "#30FF30" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: "#E0E0E0" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: "#E0E0E0" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: "#FF3030" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, { color: "#30FF30" });
        }
    }

    // Call this function again to keep predicting when the browser is ready.
    window.requestAnimationFrame(predictWebcam);
}
}

function drawBlendShapes(el, blendShapes) {
    if (!blendShapes.length) {
        return;
    }
    console.log(blendShapes[0]);
    let htmlMaker = "";
    blendShapes[0].categories.map((shape) => {
        htmlMaker += `
      <li class="blend-shapes-item">
        <span class="blend-shapes-label">${shape.displayName || shape.categoryName}</span>
        <span class="blend-shapes-value" style="width: calc(${+shape.score * 100}% - 120px)">${(+shape.score).toFixed(4)}</span>
      </li>
    `;
    });
    el.innerHTML = htmlMaker;
}

// Add this code to create a stop button and append it to your page
const stopButton = document.createElement("button");
stopButton.innerText = "Stop audio";
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
    pipButton.style.marginTop = "20px";
    pipButton.style.marginBottom = "20px";
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
