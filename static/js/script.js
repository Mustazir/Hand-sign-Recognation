let stream = null;

// Switch between tabs
function switchTab(tab) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Add active class to selected tab
    if (tab === 'upload') {
        document.querySelector('.tab:nth-child(1)').classList.add('active');
        document.getElementById('upload-tab').classList.add('active');
        stopWebcam();
    } else {
        document.querySelector('.tab:nth-child(2)').classList.add('active');
        document.getElementById('webcam-tab').classList.add('active');
    }

    // Hide results when switching tabs
    hideResults();
    hideError();
}

// File input handler
document.getElementById('file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('preview-image').src = e.target.result;
            document.getElementById('preview-container').style.display = 'block';
            hideResults();
            hideError();
        };
        reader.readAsDataURL(file);
    }
});

// Predict from uploaded image
async function predictImage() {
    const fileInput = document.getElementById('file-input');
    if (!fileInput.files[0]) {
        showError('Please select an image first!');
        return;
    }

    showLoading();
    hideError();
    hideResults();

    const formData = new FormData();
    formData.append('image', fileInput.files[0]);

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            displayResults(data.predictions);
        } else {
            showError(data.error || 'Prediction failed. Please try again.');
        }
    } catch (error) {
        showError('Network error: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Start webcam
async function startWebcam() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });

        document.getElementById('webcam').srcObject = stream;
        document.getElementById('start-webcam').style.display = 'none';
        document.getElementById('capture-btn').style.display = 'inline-block';
        document.getElementById('stop-webcam').style.display = 'inline-block';

        hideError();
    } catch (error) {
        showError('Camera access denied. Please allow camera permission and try again.');
        console.error('Camera error:', error);
    }
}

// Stop webcam
function stopWebcam() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        document.getElementById('webcam').srcObject = null;
        document.getElementById('start-webcam').style.display = 'inline-block';
        document.getElementById('capture-btn').style.display = 'none';
        document.getElementById('stop-webcam').style.display = 'none';
        stream = null;
    }
}

// Capture frame and predict
async function captureFrame() {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0);

    // Convert canvas to base64 image
    const imageData = canvas.toDataURL('image/jpeg', 0.95);

    showLoading();
    hideError();
    hideResults();

    try {
        const response = await fetch('/predict_webcam', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: imageData })
        });

        const data = await response.json();

        if (data.success) {
            displayResults(data.predictions);
        } else {
            showError(data.error || 'Prediction failed. Please try again.');
        }
    } catch (error) {
        showError('Network error: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Display prediction results
function displayResults(predictions) {
    const container = document.getElementById('predictions');
    container.innerHTML = '';

    predictions.forEach((pred, index) => {
        const item = document.createElement('div');
        item.className = 'prediction-item';

        // Create medal emoji for top 3
        const medals = ['🥇', '🥈', '🥉'];
        const rank = index < 3 ? medals[index] : `#${index + 1}`;

        item.innerHTML = `
            <div class="prediction-rank">${rank}</div>
            <div class="prediction-class">${pred.class}</div>
            <div class="prediction-confidence">${pred.confidence.toFixed(2)}%</div>
        `;

        // Add confidence bar
        const barContainer = document.createElement('div');
        barContainer.className = 'confidence-bar';
        barContainer.innerHTML = `
            <div class="confidence-fill" style="width: 0%"></div>
        `;
        item.appendChild(barContainer);

        container.appendChild(item);

        // Animate confidence bar
        setTimeout(() => {
            const fill = barContainer.querySelector('.confidence-fill');
            fill.style.width = pred.confidence + '%';
        }, 100 * index);
    });

    document.getElementById('results').classList.add('show');

    // Scroll to results
    document.getElementById('results').scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
    });
}

// Helper functions
function showLoading() {
    document.getElementById('loading').classList.add('show');
}

function hideLoading() {
    document.getElementById('loading').classList.remove('show');
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = '⚠️ ' + message;
    errorDiv.classList.add('show');

    // Scroll to error
    errorDiv.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
    });
}

function hideError() {
    document.getElementById('error').classList.remove('show');
}

function hideResults() {
    document.getElementById('results').classList.remove('show');
}

// Clean up webcam on page unload
window.addEventListener('beforeunload', function() {
    stopWebcam();
});