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

// Audio files array
const audioFiles = [
    'audio/capable_of_more_imagine.mp3',
    'audio/cmon_youve_got_this.mp3',
    'audio/dont_beat_yourself_up_get_there_in_time.mp3',
    'audio/each_moment_opportunity_to_grow.mp3',
    'audio/give_another_shot_you_got_it.mp3',
    'audio/growth_within_reach.mp3',
    'audio/hands_up_be_aware_triggers.mp3',
    'audio/i_am_aware_and_in_control.mp3',
    'audio/i_am_resiliant_capable_of_change.mp3',
    'audio/i_choose_treat_myself_care.mp3',
    'audio/i_will_not_let_urge_define_me.mp3',
    'audio/its_okay_pause_refocus.mp3',
    'audio/keep_going_doing_great.mp3',
    'audio/only_you_are_in_control_actions.mp3',
    'audio/pause_take_deep_breath.mp3',
    'audio/remember_how_this_made_you_feel.mp3',
    'audio/remember_someone_thinks_youre_cute.mp3',
    'audio/stay_present_redirect_hands.mp3',
    'audio/strong_mindful_control.mp3',
    'audio/take_moment_notice_hands.mp3',
    'audio/the_power_in_your_hands.mp3',
    'audio/this_is_your_moment_to_take_control.mp3',
    'audio/you_are_beautiful_take_moment.mp3',
    'audio/you_are_more_than_capable_of_beating.mp3',
    'audio/you_got_this_stay_mindful.mp3',
    'audio/you_got_this.mp3',
    'audio/you_have_power_to_stop.mp3',
    'audio/youre_crossing_boundary_refocus.mp3',
    'audio/youre_making_progress_promise.mp3',
    'audio/youre_one_step_closer_beating.mp3',
    'audio/youre_stronger_than_urge.mp3',
    'audio/youve_taken_first_step_dont_get_discouraged.mp3'
];

let currentRandomAudio = null;

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
let currentSound = 'none';
let isAlertVisible = false;

const HAND_TIMEOUT = 150;
const CONFIDENCE_THRESHOLD = 0.8;
const EYE_BOUNDARY_OFFSET = 0.025;
const SCALP_OFFSET = 0.1;

// Function to calculate boundary color based on confidence
function getBoundaryColor(confidence) {
    // Start with light green at 25% opacity
    const baseColor = { r: 0, g: 255, b: 0, a: 0.25 };
    // Target color is bright red at 100% opacity
    const targetColor = { r: 255, g: 0, b: 0, a: 1.0 };
    
    // Interpolate between the colors based on confidence
    const r = baseColor.r + (targetColor.r - baseColor.r) * confidence;
    const g = baseColor.g + (targetColor.g - baseColor.g) * confidence;
    const b = baseColor.b + (targetColor.b - baseColor.b) * confidence;
    const a = baseColor.a + (targetColor.a - baseColor.a) * confidence;
    
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

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

// Function to play random affirmation audio
function playRandomAudio() {
    // Only start new audio if none is currently playing
    if (!currentRandomAudio || currentRandomAudio.ended) {
        const randomIndex = Math.floor(Math.random() * audioFiles.length);
        const audioFile = audioFiles[randomIndex];
        currentRandomAudio = new Audio(audioFile);
        currentRandomAudio.play();
    }
}

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
            // Split eyes into left and right groups
            const leftEyeIndices = [
                33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163
            ];
            
            const rightEyeIndices = [
                362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381
            ];
            
            const leftPoints = leftEyeIndices.map(index => {
                const point = faceLandmarks[index];
                return {
                    x: point.x,
                    y: point.y,
                    originalX: point.x,
                    originalY: point.y,
                    mode: 'eyes',
                    group: 'left'
                };
            });

            const rightPoints = rightEyeIndices.map(index => {
                const point = faceLandmarks[index];
                return {
                    x: point.x,
                    y: point.y,
                    originalX: point.x,
                    originalY: point.y,
                    mode: 'eyes',
                    group: 'right'
                };
            });

            // Apply offset to both eye groups
            [...leftPoints, ...rightPoints].forEach(point => {
                const centerX = 0.5;
                const centerY = 0.5;
                point.x += (point.x - centerX) * EYE_BOUNDARY_OFFSET;
                point.y += (point.y - centerY) * EYE_BOUNDARY_OFFSET;
            });

            // Return both groups separately
            return { leftEye: leftPoints, rightEye: rightPoints };
        }
        case 'scalp': {
            // Updated scalp indices to only include points from mid-ear and above
            const scalpIndices = [
                10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365
            ];

            const points = scalpIndices.map(index => {
                const point = faceLandmarks[index];
                // Always apply the offset for points above the ears
                return {
                    x: point.x,
                    y: point.y - SCALP_OFFSET,
                    mode: 'scalp'
                };
            });

            return points;
        }
        case 'beard': {
            // Updated beard indices to only include points from mid-ear and below
            const beardIndices = [
                365, 397, 288, 361, 323, 454, 356, 389, 251, 284, 332, 297, 338
            ];

            const points = beardIndices.map(index => {
                const point = faceLandmarks[index];
                return {
                    x: point.x,
                    y: point.y + 0.05, // Consistent offset for beard points
                    mode: 'beard'
                };
            });

            return points;
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
        if (mode === 'eyes') {
            // Handle separated eye points
            allPoints.push(...modePoints.leftEye, ...modePoints.rightEye);
        } else {
            allPoints.push(...modePoints);
        }
    });
    
    return allPoints;
}

// Draw boundary areas with color based on confidence
function drawBoundaryLines(ctx, points, mode, confidence = 0) {
    if (points.length === 0) return;

    // Set up dashed line style
    ctx.setLineDash([5, 5]); // 5px dash, 5px gap
    ctx.lineWidth = 2; // Thin line
    ctx.strokeStyle = getBoundaryColor(confidence);
    
    if (mode === 'eyes') {
        // Group points by eye
        const leftEyePoints = points.filter(p => p.group === 'left');
        const rightEyePoints = points.filter(p => p.group === 'right');
        
        // Draw left eye
        if (leftEyePoints.length > 0) {
            drawEyeBoundary(ctx, leftEyePoints);
        }
        
        // Draw right eye
        if (rightEyePoints.length > 0) {
            drawEyeBoundary(ctx, rightEyePoints);
        }
    } else {
        // Draw other boundaries
        ctx.beginPath();
        ctx.moveTo(points[0].x * canvasElement.width, points[0].y * canvasElement.height);
        
        // Draw smooth curve through all points
        for (let i = 1; i < points.length; i++) {
            const current = points[i];
            const prev = points[i-1];
            const xc = (current.x + prev.x) / 2 * canvasElement.width;
            const yc = (current.y + prev.y) / 2 * canvasElement.height;
            ctx.quadraticCurveTo(
                prev.x * canvasElement.width,
                prev.y * canvasElement.height,
                xc,
                yc
            );
        }
        
        // Close the path smoothly back to the start
        const lastPoint = points[points.length-1];
        const firstPoint = points[0];
        const xc = (firstPoint.x + lastPoint.x) / 2 * canvasElement.width;
        const yc = (firstPoint.y + lastPoint.y) / 2 * canvasElement.height;
        ctx.quadraticCurveTo(
            lastPoint.x * canvasElement.width,
            lastPoint.y * canvasElement.height,
            xc,
            yc
        );
        
        ctx.closePath();
        ctx.stroke();
    }
    
    ctx.setLineDash([]); // Reset line style for other drawings
}

// Helper function to draw individual eye boundaries
function drawEyeBoundary(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x * canvasElement.width, points[0].y * canvasElement.height);
    
    // Draw smooth curve through all points
    for (let i = 1; i < points.length; i++) {
        const current = points[i];
        const prev = points[i-1];
        const xc = (current.x + prev.x) / 2 * canvasElement.width;
        const yc = (current.y + prev.y) / 2 * canvasElement.height;
        ctx.quadraticCurveTo(
            prev.x * canvasElement.width,
            prev.y * canvasElement.height,
            xc,
            yc
        );
    }
    
    // Close the path smoothly back to the start
    const lastPoint = points[points.length-1];
    const firstPoint = points[0];
    const xc = (firstPoint.x + lastPoint.x) / 2 * canvasElement.width;
    const yc = (firstPoint.y + lastPoint.y) / 2 * canvasElement.height;
    ctx.quadraticCurveTo(
        lastPoint.x * canvasElement.width,
        lastPoint.y * canvasElement.height,
        xc,
        yc
    );
    
    ctx.closePath();
    ctx.stroke();
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

            // Calculate current confidence for coloring
            let currentConfidence = 0;
            if (handResults && handResults.multiHandLandmarks && handResults.multiHandLandmarks.length > 0) {
                for (const landmarks of handResults.multiHandLandmarks) {
                    const confidence = calculateFingerFaceConfidence(landmarks, boundaryPoints);
                    currentConfidence = Math.max(currentConfidence, confidence);
                }
            }

            Object.entries(pointsByMode).forEach(([mode, points]) => {
                drawBoundaryLines(canvasCtx, points, mode, currentConfidence);
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
                } else if (currentSound === 'random') {
                    playRandomAudio();
                }
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
            if (!isAlertVisible) {
                textAlert.style.display = 'none';
            }
        }, 200);
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
