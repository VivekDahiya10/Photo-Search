from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import base64
from datetime import datetime
import numpy as np
from pymongo import MongoClient
from bson import ObjectId
import requests
from PIL import Image
import io
import hashlib
from werkzeug.utils import secure_filename
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set SSL environment variable to bypass certificate issues
os.environ["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Voyage AI configuration
voyage_api_key = os.getenv('VOYAGE_API_KEY')
VOYAGE_API_URL = "https://api.voyageai.com/v1/multimodalembeddings"

if voyage_api_key:
    logger.info("Voyage AI API key configured")
else:
    logger.warning("VOYAGE_API_KEY not found - using demo mode")

# MongoDB connection
mongo_client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/photo_search'))
db = mongo_client.photo_search
photos_collection = db.photos

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def calculate_similarity(embedding1, embedding2):
    """Calculate cosine similarity between two embeddings"""
    if not embedding1 or not embedding2:
        return 0.0
    
    # Convert to numpy arrays
    vec1 = np.array(embedding1)
    vec2 = np.array(embedding2)
    
    # Calculate cosine similarity
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return float(dot_product / (norm1 * norm2))

def generate_mock_embedding(text, dimension=1024):
    """Generate a mock embedding based on text hash for demo purposes"""
    import hashlib
    # Create a deterministic hash-based embedding
    hash_obj = hashlib.md5(text.encode())
    hash_hex = hash_obj.hexdigest()
    
    # Convert hash to numbers and normalize
    embedding = []
    for i in range(0, len(hash_hex), 2):
        val = int(hash_hex[i:i+2], 16) / 255.0 - 0.5  # Normalize to [-0.5, 0.5]
        embedding.append(val)
    
    # Pad or truncate to desired dimension
    while len(embedding) < dimension:
        embedding.extend(embedding[:min(len(embedding), dimension - len(embedding))])
    
    return embedding[:dimension]

def generate_text_embedding(text):
    """Generate embedding for text using Voyage AI API"""
    if not voyage_api_key:
        logger.info("Using mock embedding for demo mode")
        return generate_mock_embedding(text)
    
    headers = {
        "Authorization": f"Bearer {voyage_api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "inputs": [
            {
                "content": [
                    {
                        "type": "text",
                        "text": text
                    }
                ]
            }
        ],
        "model": "voyage-multimodal-3",
        "input_type": "query"
    }
    
    try:
        response = requests.post(VOYAGE_API_URL, headers=headers, json=payload, verify=False)
        response.raise_for_status()
        result = response.json()
        embedding = result["data"][0]["embedding"]
        logger.info(f"Successfully generated Voyage AI text embedding for: {text[:50]}...")
        return embedding
    except Exception as e:
        logger.warning(f"Voyage AI failed, using mock embedding: {e}")
        return generate_mock_embedding(text)

def generate_image_embedding(image_data, description=""):
    """Generate embedding for image using Voyage AI API"""
    if not voyage_api_key:
        logger.info("Using mock embedding for demo mode")
        combined_text = f"{description} [IMAGE_CONTENT]" if description else "[IMAGE_CONTENT]"
        return generate_mock_embedding(combined_text)
    
    headers = {
        "Authorization": f"Bearer {voyage_api_key}",
        "Content-Type": "application/json"
    }
    
    # Create multimodal content
    content = []
    
    if description:
        content.append({
            "type": "text",
            "text": description
        })
    
    content.append({
        "type": "image_base64",
        "image_base64": image_data  # This is already "data:image/jpeg;base64,..."
    })
    
    payload = {
        "inputs": [
            {
                "content": content
            }
        ],
        "model": "voyage-multimodal-3",
        "input_type": "query"
    }
    
    try:
        response = requests.post(VOYAGE_API_URL, headers=headers, json=payload, verify=False)
        response.raise_for_status()
        result = response.json()
        embedding = result["data"][0]["embedding"]
        logger.info(f"Successfully generated Voyage AI image embedding with description: {description[:30]}...")
        return embedding
    except Exception as e:
        logger.warning(f"Voyage AI failed, using mock embedding: {e}")
        combined_text = f"{description} [IMAGE_CONTENT]" if description else "[IMAGE_CONTENT]"
        return generate_mock_embedding(combined_text)

def process_image(image_file):
    """Process uploaded image and return base64 data"""
    try:
        # Open and process image
        image = Image.open(image_file)
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if too large
        max_size = (1024, 1024)
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Convert to base64
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=85)
        image_data = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/jpeg;base64,{image_data}"
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        raise

@app.route('/')
def index():
    """Serve the main HTML file"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory('.', filename)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        db.command('ping')
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status,
        "voyage_api": "configured" if os.getenv('VOYAGE_API_KEY') else "not configured"
    })

@app.route('/api/search/text', methods=['POST'])
def search_by_text():
    """Search photos by text query"""
    try:
        data = request.get_json()
        query = data.get('query', '').strip()
        limit = int(data.get('limit', 20))
        
        if not query:
            return jsonify({"error": "Query is required"}), 400
        
        logger.info(f"Searching for: {query}")
        
        # Generate embedding for query
        query_embedding = generate_text_embedding(query)
        
        # Search in database
        results = []
        photos = photos_collection.find({})
        
        for photo in photos:
            if 'textEmbedding' in photo:
                similarity = calculate_similarity(query_embedding, photo['textEmbedding'])
                if similarity > 0.1:  # Minimum similarity threshold
                    photo_data = {
                        'id': str(photo['_id']),
                        'title': photo.get('title', ''),
                        'description': photo.get('description', ''),
                        'imageUrl': photo.get('imageUrl', ''),
                        'thumbnailUrl': photo.get('thumbnailUrl', ''),
                        'similarity': round(similarity, 3),
                        'metadata': photo.get('metadata', {})
                    }
                    results.append(photo_data)
        
        # Sort by similarity and limit results
        results.sort(key=lambda x: x['similarity'], reverse=True)
        results = results[:limit]
        
        return jsonify({
            "query": query,
            "results": results,
            "metadata": {
                "totalResults": len(results),
                "limit": limit
            }
        })
        
    except Exception as e:
        logger.error(f"Text search error: {e}")
        return jsonify({"error": "Search failed", "message": str(e)}), 500

@app.route('/api/search/image', methods=['POST'])
def search_by_image():
    """Search photos by uploaded image"""
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "No image file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type"}), 400
        
        description = request.form.get('description', '')
        limit = int(request.form.get('limit', 20))
        
        logger.info(f"Image search with description: {description}")
        
        # Process image
        image_data = process_image(file)
        
        # Generate embedding
        query_embedding = generate_image_embedding(image_data, description)
        
        # Search in database
        results = []
        photos = photos_collection.find({})
        
        for photo in photos:
            if 'imageEmbedding' in photo:
                similarity = calculate_similarity(query_embedding, photo['imageEmbedding'])
                if similarity > 0.1:  # Minimum similarity threshold
                    photo_data = {
                        'id': str(photo['_id']),
                        'title': photo.get('title', ''),
                        'description': photo.get('description', ''),
                        'imageUrl': photo.get('imageUrl', ''),
                        'thumbnailUrl': photo.get('thumbnailUrl', ''),
                        'similarity': round(similarity, 3),
                        'metadata': photo.get('metadata', {})
                    }
                    results.append(photo_data)
        
        # Sort by similarity and limit results
        results.sort(key=lambda x: x['similarity'], reverse=True)
        results = results[:limit]
        
        return jsonify({
            "query": description or "Image search",
            "results": results,
            "metadata": {
                "totalResults": len(results),
                "limit": limit
            }
        })
        
    except Exception as e:
        logger.error(f"Image search error: {e}")
        return jsonify({"error": "Image search failed", "message": str(e)}), 500

@app.route('/api/photos', methods=['GET'])
def get_photos():
    """Get all photos with pagination"""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        category = request.args.get('category')
        
        query = {}
        if category and category != 'all':
            query['metadata.category'] = category
        
        skip = (page - 1) * limit
        
        photos = list(photos_collection.find(query).skip(skip).limit(limit))
        total = photos_collection.count_documents(query)
        
        # Format photos for response
        formatted_photos = []
        for photo in photos:
            photo_data = {
                'id': str(photo['_id']),
                'title': photo.get('title', ''),
                'description': photo.get('description', ''),
                'imageUrl': photo.get('imageUrl', ''),
                'thumbnailUrl': photo.get('thumbnailUrl', ''),
                'metadata': photo.get('metadata', {}),
                'createdAt': photo.get('createdAt', datetime.utcnow()).isoformat()
            }
            formatted_photos.append(photo_data)
        
        return jsonify({
            "photos": formatted_photos,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        })
        
    except Exception as e:
        logger.error(f"Get photos error: {e}")
        return jsonify({"error": "Failed to get photos", "message": str(e)}), 500

@app.route('/api/photos', methods=['POST'])
def add_photo():
    """Add new photo with multiple file upload support"""
    try:
        # Handle multiple files
        files = request.files.getlist('photos')
        if not files or all(f.filename == '' for f in files):
            return jsonify({"error": "No photo files provided"}), 400
        
        # Get shared metadata
        title = request.form.get('title', '')
        description = request.form.get('description', '')
        category = request.form.get('category', 'other')
        tags = request.form.get('tags', '').split(',') if request.form.get('tags') else []
        author_name = request.form.get('authorName', 'Unknown')
        
        added_photos = []
        errors = []
        
        for i, file in enumerate(files):
            if file.filename == '' or not allowed_file(file.filename):
                errors.append(f"File {i+1}: Invalid file type")
                continue
            
            try:
                # Process image
                image_data = process_image(file)
                
                # Generate embeddings
                text_content = f"{title}. {description}" if title and description else title or description or "Untitled photo"
                text_embedding = generate_text_embedding(text_content)
                image_embedding = generate_image_embedding(image_data, description)
                
                # Create photo document
                photo_doc = {
                    'title': title or f"Photo {i+1}",
                    'description': description or '',
                    'imageUrl': image_data,
                    'thumbnailUrl': image_data,  # Same as image for now
                    'textEmbedding': text_embedding,
                    'imageEmbedding': image_embedding,
                    'metadata': {
                        'category': category,
                        'tags': [tag.strip() for tag in tags if tag.strip()],
                        'author': {
                            'name': author_name,
                            'username': f"@{author_name.lower().replace(' ', '_')}"
                        },
                        'likes': 0,
                        'views': 0,
                        'downloads': 0
                    },
                    'createdAt': datetime.utcnow(),
                    'updatedAt': datetime.utcnow()
                }
                
                # Insert into database
                result = photos_collection.insert_one(photo_doc)
                added_photos.append({
                    'id': str(result.inserted_id),
                    'title': photo_doc['title'],
                    'filename': file.filename
                })
                
            except Exception as e:
                errors.append(f"File {i+1} ({file.filename}): {str(e)}")
        
        response_data = {
            "message": f"Successfully added {len(added_photos)} photos",
            "added_photos": added_photos
        }
        
        if errors:
            response_data["errors"] = errors
        
        return jsonify(response_data), 201 if added_photos else 400
        
    except Exception as e:
        logger.error(f"Add photo error: {e}")
        return jsonify({"error": "Failed to add photos", "message": str(e)}), 500

@app.route('/api/photos/<photo_id>', methods=['GET'])
def get_photo(photo_id):
    """Get single photo by ID"""
    try:
        photo = photos_collection.find_one({'_id': ObjectId(photo_id)})
        if not photo:
            return jsonify({"error": "Photo not found"}), 404
        
        photo_data = {
            'id': str(photo['_id']),
            'title': photo.get('title', ''),
            'description': photo.get('description', ''),
            'imageUrl': photo.get('imageUrl', ''),
            'thumbnailUrl': photo.get('thumbnailUrl', ''),
            'metadata': photo.get('metadata', {}),
            'createdAt': photo.get('createdAt', datetime.utcnow()).isoformat()
        }
        
        return jsonify(photo_data)
        
    except Exception as e:
        logger.error(f"Get photo error: {e}")
        return jsonify({"error": "Failed to get photo", "message": str(e)}), 500

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get all photo categories"""
    try:
        pipeline = [
            {"$group": {"_id": "$metadata.category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        categories = list(photos_collection.aggregate(pipeline))
        
        formatted_categories = [
            {"name": cat["_id"] or "other", "count": cat["count"]}
            for cat in categories
        ]
        
        return jsonify(formatted_categories)
        
    except Exception as e:
        logger.error(f"Get categories error: {e}")
        return jsonify({"error": "Failed to get categories", "message": str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get database statistics"""
    try:
        total_photos = photos_collection.count_documents({})
        
        # Get category distribution
        category_pipeline = [
            {"$group": {"_id": "$metadata.category", "count": {"$sum": 1}}}
        ]
        categories = list(photos_collection.aggregate(category_pipeline))
        
        return jsonify({
            "totalPhotos": total_photos,
            "categories": len(categories),
            "categoryDistribution": {cat["_id"] or "other": cat["count"] for cat in categories}
        })
        
    except Exception as e:
        logger.error(f"Get stats error: {e}")
        return jsonify({"error": "Failed to get stats", "message": str(e)}), 500

if __name__ == '__main__':
    # Create database indexes for better performance
    try:
        photos_collection.create_index([("metadata.category", 1)])
        photos_collection.create_index([("createdAt", -1)])
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.warning(f"Failed to create indexes: {e}")
    
    # Start the Flask app
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f"Starting Flask app on port {port}")
    logger.info(f"Frontend: http://localhost:{port}")
    logger.info(f"API: http://localhost:{port}/api")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
