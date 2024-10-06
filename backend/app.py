import os
import subprocess
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)

# Load environment variables from .env file
load_dotenv()

# MongoDB setup
MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client['video']
overlays_collection = db['overlays']

# Directory where HLS files will be saved
HLS_OUTPUT_DIR = "hls_stream"
os.makedirs(HLS_OUTPUT_DIR, exist_ok=True)

# Route to accept RTSP URL and start streaming
@app.route('/start-stream', methods=['POST'])
def start_stream():
    data = request.get_json()
    rtsp_url = data.get('rtsp_url')

    if not rtsp_url:
        return jsonify({"error": "No RTSP URL provided"}), 400

    # Generate a unique identifier for the stream
    stream_id = str(ObjectId())

    # Use FFmpeg to convert RTSP to HLS
    output_m3u8 = os.path.join(HLS_OUTPUT_DIR, f'{stream_id}.m3u8')
    ffmpeg_command = [
        'ffmpeg',
        '-rtsp_transport', 'tcp',
        '-i', rtsp_url,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-f', 'hls',
        '-hls_time', '2',
        '-hls_list_size', '5',
        '-hls_flags', 'delete_segments',
        output_m3u8
    ]

    try:
        # Start FFmpeg process
        subprocess.Popen(ffmpeg_command)
        print(f"FFmpeg started for stream_id: {stream_id}")
        return jsonify({"message": "Stream started", "stream_id": stream_id}), 200
    except Exception as e:
        print(f"Error starting FFmpeg: {str(e)}")
        return jsonify({"error": str(e)}), 500

# CRUD Operations for Overlays

# Create a new overlay
@app.route('/overlays', methods=['POST'])
def create_overlay():
    data = request.get_json()
    stream_id = data.get('stream_id')
    text = data.get('text')
    position = data.get('position')
    size = data.get('size')

    # Detailed validation
    errors = []
    if not stream_id:
        errors.append("Missing 'stream_id'.")
    if not text:
        errors.append("Missing 'text'.")
    if not position or 'top' not in position or 'left' not in position:
        errors.append("Missing 'position' with 'top' and 'left'.")
    if not size or 'width' not in size or 'height' not in size:
        errors.append("Missing 'size' with 'width' and 'height'.")

    if errors:
        error_message = " ".join(errors)
        print(f"Overlay creation failed: {error_message}")
        return jsonify({"error": error_message}), 400

    overlay_data = {
        'stream_id': stream_id,
        'text': text,
        'position': position,
        'size': size,
        'visible': True
    }

    overlay_id = overlays_collection.insert_one(overlay_data).inserted_id
    return jsonify({"message": "Overlay created", "overlay_id": str(overlay_id)}), 201

# Read all overlays for a specific stream
@app.route('/overlays/<stream_id>', methods=['GET'])
def get_overlays(stream_id):
    overlays = list(overlays_collection.find({'stream_id': stream_id}))
    for overlay in overlays:
        overlay['_id'] = str(overlay['_id'])
    return jsonify(overlays), 200

# Update an existing overlay
@app.route('/overlays/<overlay_id>', methods=['PUT'])
def update_overlay(overlay_id):
    data = request.get_json()
    update_fields = {}

    text = data.get('text')
    position = data.get('position')
    size = data.get('size')
    visible = data.get('visible')

    if text is not None:
        update_fields['text'] = text
    if position is not None:
        if 'top' in position and 'left' in position:
            update_fields['position'] = position
        else:
            return jsonify({"error": "Incomplete 'position' data."}), 400
    if size is not None:
        if 'width' in size and 'height' in size:
            update_fields['size'] = size
        else:
            return jsonify({"error": "Incomplete 'size' data."}), 400
    if visible is not None:
        update_fields['visible'] = visible

    if not update_fields:
        return jsonify({"error": "No fields to update"}), 400

    result = overlays_collection.update_one({'_id': ObjectId(overlay_id)}, {"$set": update_fields})

    if result.matched_count == 0:
        return jsonify({"error": "Overlay not found"}), 404

    return jsonify({"message": "Overlay updated"}), 200

# Delete an overlay
@app.route('/overlays/<overlay_id>', methods=['DELETE'])
def delete_overlay(overlay_id):
    result = overlays_collection.delete_one({'_id': ObjectId(overlay_id)})

    if result.deleted_count == 0:
        return jsonify({"error": "Overlay not found"}), 404

    return jsonify({"message": "Overlay deleted"}), 200

# Serve HLS files
@app.route('/hls/<path:filename>')
def serve_hls(filename):
    return send_from_directory(HLS_OUTPUT_DIR, filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
