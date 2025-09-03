# Voyage Photo Search App

A semantic photo search application powered by Voyage AI's multimodal embeddings. This app allows users to search for photos using natural language descriptions or by uploading similar images, and also enables users to upload their own photos to the searchable database.

## Features

- **Semantic Text Search**: Search photos using natural language descriptions
- **Image-based Search**: Upload an image to find visually similar photos
- **Photo Upload**: Add new photos with automatic embedding generation
- **Similarity Scoring**: See how closely photos match your search query
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Results**: Fast search with similarity percentages

## Technology Stack

- **Backend**: Node.js, Express.js, MongoDB/MongoDB Atlas
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **AI/ML**: Voyage AI multimodal embeddings (voyage-multimodal-3)
- **Database**: MongoDB with vector similarity search / MongoDB Atlas Vector Search
- **Image Processing**: Sharp for image optimization
- **Vector Search**: Custom aggregation (local) / Atlas Vector Search (cloud)

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local installation or MongoDB Atlas)
- Voyage AI API key

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd voyage-photo-search
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy the `.env` file and update with your credentials:
   ```bash
   # Voyage AI Configuration
   VOYAGE_API_KEY=your_voyage_api_key_here
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/voyage-photo-search
   # For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/voyage-photo-search
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   ```

4. **Start MongoDB**
   
   If using local MongoDB:
   ```bash
   mongod
   ```

5. **Start the application**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

6. **Access the application**
   
   Open your browser and navigate to: `http://localhost:3000`

## MongoDB Configuration

This application supports both **local MongoDB** and **MongoDB Atlas** with automatic switching capabilities.

### Environment Variables

The `.env` file contains the following MongoDB configuration:

```bash
# Switch between 'local' and 'atlas'
MONGODB_MODE=local

# Local MongoDB
MONGODB_LOCAL_URI=mongodb://localhost:27017/voyage-photo-search

# Atlas MongoDB (update with your Atlas connection string)
MONGODB_ATLAS_URI=mongodb+srv://username:password@cluster.mongodb.net/voyage-photo-search

# Auto-selected based on MONGODB_MODE (don't modify this line)
MONGODB_URI=mongodb://localhost:27017/voyage-photo-search
```

### Switching Between Local and Atlas

Use the built-in utility script to easily switch between MongoDB modes:

```bash
# Switch to local MongoDB
node scripts/switch-mongodb-mode.js local

# Switch to MongoDB Atlas
node scripts/switch-mongodb-mode.js atlas

# Check current status
node scripts/switch-mongodb-mode.js status

# Validate Atlas configuration
node scripts/switch-mongodb-mode.js validate
```

### MongoDB Atlas Setup

1. **Create Atlas Cluster**
   - Go to [MongoDB Atlas](https://cloud.mongodb.com)
   - Create a new cluster (M10+ required for Vector Search)
   - Get your connection string

2. **Update Environment Variables**
   ```bash
   MONGODB_ATLAS_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/voyage-photo-search
   ```

3. **Switch to Atlas Mode**
   ```bash
   node scripts/switch-mongodb-mode.js atlas
   ```

4. **Setup Atlas Vector Search** (Optional - for 10-100x faster search)
   ```bash
   node config/atlas-vector-setup.js setup
   ```

### Vector Search Performance

| Feature | Local MongoDB | MongoDB Atlas |
|---------|---------------|---------------|
| Search Method | Custom Aggregation | Atlas Vector Search |
| Performance | Good for small datasets | 10-100x faster |
| Scalability | Limited | Millions of vectors |
| Setup | Automatic | Requires M10+ cluster |
| Cost | Free | Paid service |

## Getting a Voyage AI API Key

1. Visit [Voyage AI](https://www.voyageai.com/)
2. Sign up for an account
3. Navigate to the API section
4. Generate a new API key
5. Copy the key and add it to your `.env` file

## Usage

### Searching Photos

1. **Text Search**: Enter a description like "sunset over mountains" in the search box
2. **Image Search**: Click "Search by Image" and upload a photo to find similar images
3. **Suggestions**: Use the suggested search terms for quick searches

### Adding Photos

1. Click the "Add New Photo" button
2. Upload an image (JPEG, PNG, WebP up to 10MB)
3. Fill in the title and description (required for good search results)
4. Add optional metadata like author, category, and tags
5. Submit to add the photo to the searchable database

### Viewing Results

- Photos are displayed in a responsive grid
- Click any photo to view details and similarity score
- Use "Load More" to see additional results

## API Endpoints

### Search Endpoints
- `POST /api/search/text` - Search photos by text description
- `POST /api/search/image` - Search photos by uploaded image

### Photo Management
- `GET /api/photos` - Get all photos with pagination
- `GET /api/photos/:id` - Get specific photo details
- `POST /api/photos` - Add new photo with embedding generation
- `DELETE /api/photos/:id` - Delete photo (admin)

### Utility Endpoints
- `GET /api/health` - Health check and system status
- `GET /api/stats` - Database statistics
- `GET /api/categories` - Get photo categories
- `POST /api/test-voyage` - Test Voyage API connection

## Database Schema

Photos are stored with the following structure:

```javascript
{
  title: String,           // Photo title
  description: String,     // Detailed description
  imageUrl: String,        // Image URL
  embedding: [Number],     // 1024-dimensional vector from Voyage AI
  metadata: {
    author: { name, username, avatar },
    likes: Number,
    views: Number,
    tags: [String],
    category: String,
    colors: [String]
  },
  dimensions: { width, height },
  source: { platform, license },
  searchMetrics: { searchCount, clickCount }
}
```

## How It Works

1. **Photo Upload**: When a photo is uploaded, the system:
   - Processes the image with Sharp
   - Generates a multimodal embedding using Voyage AI
   - Stores the photo metadata and embedding in MongoDB

2. **Text Search**: When searching with text:
   - Generates an embedding for the search query
   - Uses MongoDB aggregation to find similar embeddings
   - Calculates cosine similarity scores
   - Returns ranked results

3. **Image Search**: When searching with an image:
   - Processes the uploaded image
   - Generates a multimodal embedding
   - Finds visually similar photos in the database
   - Returns results with similarity percentages

## Performance Considerations

- **Embedding Storage**: 1024-dimensional vectors are stored efficiently in MongoDB
- **Similarity Search**: Uses MongoDB's aggregation pipeline for fast vector similarity
- **Image Processing**: Sharp optimizes images before embedding generation
- **Caching**: Results can be cached for frequently searched terms
- **Rate Limiting**: API calls are rate-limited to prevent abuse

## Troubleshooting

### Common Issues

1. **Voyage API Key Issues**
   - Ensure your API key is valid and has sufficient credits
   - Check the `.env` file configuration
   - Test the connection using `/api/test-voyage`

2. **MongoDB Connection Issues**
   - Verify MongoDB is running
   - Check the connection string in `.env`
   - Ensure database permissions are correct

3. **Image Upload Issues**
   - Check file size (max 10MB)
   - Ensure supported formats (JPEG, PNG, WebP)
   - Verify Sharp installation

4. **Search Not Working**
   - Ensure photos have been uploaded with embeddings
   - Check browser console for JavaScript errors
   - Verify API endpoints are responding

### Debug Mode

Enable debug logging by setting:
```bash
NODE_ENV=development
```

Check logs for:
- Voyage API responses
- MongoDB queries
- Image processing status
- Embedding generation progress

## Development

### Project Structure
```
voyage-photo-search/
├── config/
│   ├── database.js                    # MongoDB connection with mode switching
│   └── atlas-vector-setup.js          # Atlas Vector Search setup utility
├── models/
│   ├── Photo.js                       # Original Photo schema
│   ├── Photo_AtlasVectorSearch.js     # Atlas Vector Search optimized schema
│   └── Photo_Smart.js                 # Smart schema with auto-detection
├── services/
│   ├── voyageService.js               # Voyage AI integration
│   └── voyage_python_service.py       # Python Voyage service (alternative)
├── scripts/
│   ├── seedDatabase.js                # Database seeding
│   └── switch-mongodb-mode.js         # MongoDB mode switching utility
├── uploads/                           # Uploaded images directory
├── index.html                         # Frontend HTML
├── styles.css                         # Frontend CSS
├── script.js                          # Frontend JavaScript
├── server.js                          # Express server
├── package.json                       # Dependencies
├── .env                               # Environment variables (private repo)
├── README.md                          # Documentation
├── MONGODB_ATLAS_VECTOR_SEARCH_MIGRATION.md  # Atlas migration guide
└── requirements.txt                   # Python dependencies
```

### Adding New Features

1. **New Search Filters**: Modify the MongoDB aggregation pipeline
2. **Additional Metadata**: Update the Photo schema
3. **New Image Formats**: Extend Sharp processing
4. **Custom Embeddings**: Modify the Voyage service

### Testing

Run the application in development mode:
```bash
npm run dev
```

Test API endpoints:
```bash
# Health check
curl http://localhost:3000/api/health

# Test Voyage connection
curl -X POST http://localhost:3000/api/test-voyage
```

## Deployment

### Production Setup

1. **Environment Variables**
   ```bash
   NODE_ENV=production
   VOYAGE_API_KEY=your_production_key
   MONGODB_URI=your_production_mongodb_uri
   ```

2. **Process Management**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start server.js --name "voyage-photo-search"
   ```

3. **Reverse Proxy** (Nginx example)
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### Scaling Considerations

- **Database Indexing**: Ensure proper indexes on search fields
- **Image Storage**: Consider cloud storage (AWS S3, Cloudinary)
- **Caching**: Implement Redis for embedding caching
- **Load Balancing**: Use multiple server instances
- **CDN**: Serve static assets via CDN

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section
- Review the API documentation
- Open an issue on GitHub

## Acknowledgments

- [Voyage AI](https://www.voyageai.com/) for multimodal embeddings
- [Unsplash](https://unsplash.com/) for sample images
- [MongoDB](https://www.mongodb.com/) for vector search capabilities
- [Sharp](https://sharp.pixelplumbing.com/) for image processing
