from flask import Flask, render_template, request, jsonify
import tensorflow as tf
import numpy as np
import cv2
from PIL import Image
import io
import base64
import os

app = Flask(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================
MODEL_PATH = 'custom_model_temp.h5'  # Your model file
IMG_SIZE = (224, 224)

# IMPORTANT: Update these with your actual class names from the notebook
CLASS_NAMES = [
    'অনুরোধ', 'আজ', 'আমি', 'খারাপ', 'গরু',
    'গৃহ', 'ঘর', 'ঘুম', 'জুতা', 'তুমি',
    'ত্বক', 'বন্ধু', 'বাটি', 'ভালো', 'মুরগী',
    'সাহায্য'
]

# ============================================================================
# LOAD MODEL
# ============================================================================
print("\n" + "="*60)
print("LOADING MODEL...")
print("="*60)

try:
    model = tf.keras.models.load_model(MODEL_PATH)
    print(f"✓ Model loaded successfully from: {MODEL_PATH}")
    print(f"✓ Number of classes: {len(CLASS_NAMES)}")
except Exception as e:
    print(f"✗ ERROR loading model: {e}")
    print(f"✗ Make sure '{MODEL_PATH}' is in the same folder as app.py")
    model = None

# ============================================================================
# PREPROCESSING FUNCTION
# ============================================================================
def preprocess_image(image):
    """Preprocess image for model prediction"""
    # Convert to RGB if needed
    if len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
    elif image.shape[2] == 4:
        image = cv2.cvtColor(image, cv2.COLOR_BGRA2RGB)

    # Resize to model input size
    image = cv2.resize(image, IMG_SIZE)

    # Normalize pixel values to [0, 1]
    image = image.astype('float32') / 255.0

    # Add batch dimension
    image = np.expand_dims(image, axis=0)

    return image

# ============================================================================
# PREDICTION FUNCTION
# ============================================================================
def predict_sign(image):
    """Predict sign language from image"""
    if model is None:
        return {"error": "Model not loaded. Please check server logs."}

    try:
        # Preprocess image
        processed = preprocess_image(image)

        # Make prediction
        predictions = model.predict(processed, verbose=0)[0]

        # Get top 5 predictions
        top_indices = np.argsort(predictions)[-5:][::-1]

        results = []
        for idx in top_indices:
            results.append({
                'class': CLASS_NAMES[idx],
                'confidence': float(predictions[idx] * 100)
            })

        return results

    except Exception as e:
        return {"error": f"Prediction error: {str(e)}"}

# ============================================================================
# ROUTES
# ============================================================================

@app.route('/')
def index():
    """Home page"""
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    """Handle image upload and prediction"""
    try:
        # Check if image is in request
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400

        file = request.files['image']

        # Check if file is selected
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Read and convert image
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        image = np.array(image.convert('RGB'))

        # Get predictions
        results = predict_sign(image)

        # Check for errors
        if isinstance(results, dict) and 'error' in results:
            return jsonify(results), 500

        return jsonify({
            'success': True,
            'predictions': results
        })

    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/predict_webcam', methods=['POST'])
def predict_webcam():
    """Handle webcam frame prediction"""
    try:
        # Get JSON data
        data = request.get_json()

        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400

        # Decode base64 image
        image_data = data['image'].split(',')[1] if ',' in data['image'] else data['image']
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        image = np.array(image.convert('RGB'))

        # Get predictions
        results = predict_sign(image)

        # Check for errors
        if isinstance(results, dict) and 'error' in results:
            return jsonify(results), 500

        return jsonify({
            'success': True,
            'predictions': results
        })

    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'num_classes': len(CLASS_NAMES)
    })

# ============================================================================
# RUN SERVER
# ============================================================================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)