const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

// Import services and models
const { connectDB, checkDatabaseHealth, initializeIndexes, getDatabaseStats } = require('./config/database');
const Photo = require('./models/Photo');
const voyageService = require('./services/voyageService');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://api.voyageai.com"]
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

app.use('/api/', limiter);

// Multer configuration for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = process.env.ALLOWED_IMAGE_TYPES?.split(',') || ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const voyageHealth = voyageService.getUsageStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      voyage: voyageHealth,
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Get database statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getDatabaseStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get database statistics',
      message: error.message
    });
  }
});

// Search photos by text
app.post('/api/search/text', async (req, res) => {
  try {
    const { query, limit = 20, page = 1 } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query is required and must be a string'
      });
    }

    const startTime = Date.now();
    
    // Generate embedding for the search query
    console.log(`Generating embedding for text query: "${query}"`);
    const queryEmbedding = await voyageService.generateTextEmbedding(query);
    
    // Find similar photos using MongoDB aggregation
    const results = await Photo.findSimilar(queryEmbedding, parseInt(limit));
    
    // Update search metrics for found photos
    const photoIds = results.map(r => r._id);
    await Photo.updateMany(
      { _id: { $in: photoIds } },
      { 
        $inc: { 'searchMetrics.searchCount': 1 },
        $set: { 'searchMetrics.lastSearched': new Date() }
      }
    );

    const searchTime = Date.now() - startTime;
    
    res.json({
      query,
      results: results.map(photo => ({
        ...photo,
        similarity: Math.round(photo.similarity * 100) / 100 // Round to 2 decimal places
      })),
      metadata: {
        totalResults: results.length,
        searchTime: `${searchTime}ms`,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Text search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

// Search photos by image
app.post('/api/search/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Image file is required'
      });
    }

    const { description = '', limit = 20, page = 1 } = req.body;
    const startTime = Date.now();
    
    // Generate embedding for the uploaded image
    console.log(`Generating embedding for uploaded image (${req.file.size} bytes)`);
    const queryEmbedding = await voyageService.generateImageEmbedding(req.file.buffer, description);
    
    // Find similar photos
    const results = await Photo.findSimilar(queryEmbedding, parseInt(limit));
    
    // Update search metrics
    const photoIds = results.map(r => r._id);
    await Photo.updateMany(
      { _id: { $in: photoIds } },
      { 
        $inc: { 'searchMetrics.searchCount': 1 },
        $set: { 'searchMetrics.lastSearched': new Date() }
      }
    );

    const searchTime = Date.now() - startTime;
    
    res.json({
      query: description || 'Image search',
      results: results.map(photo => ({
        ...photo,
        similarity: Math.round(photo.similarity * 100) / 100
      })),
      metadata: {
        totalResults: results.length,
        searchTime: `${searchTime}ms`,
        page: parseInt(page),
        limit: parseInt(limit),
        imageSize: req.file.size
      }
    });

  } catch (error) {
    console.error('Image search error:', error);
    res.status(500).json({
      error: 'Image search failed',
      message: error.message
    });
  }
});

// Get photo by ID
app.get('/api/photos/:id', async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    
    if (!photo) {
      return res.status(404).json({
        error: 'Photo not found'
      });
    }

    // Increment click count
    await photo.incrementClickCount();
    
    res.json(photo);
  } catch (error) {
    console.error('Get photo error:', error);
    res.status(500).json({
      error: 'Failed to get photo',
      message: error.message
    });
  }
});

// Get all photos with pagination
app.get('/api/photos', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = {};
    if (category && category !== 'all') {
      query['metadata.category'] = category;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const photos = await Photo.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('-embedding'); // Exclude embedding from response

    const total = await Photo.countDocuments(query);

    res.json({
      photos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({
      error: 'Failed to get photos',
      message: error.message
    });
  }
});

// Add new photos (supports multiple file uploads)
app.post('/api/photos', upload.array('photos', 10), async (req, res) => {
  try {
    const { title } = req.body;

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'At least one photo file is required'
      });
    }

    console.log(`Processing ${req.files.length} uploaded files`);
    
    const addedPhotos = [];
    const errors = [];

    // Process each uploaded file
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      
      try {
        console.log(`Processing file ${i + 1}/${req.files.length}: ${file.originalname}`);
        
        // Extract image metadata
        const metadata = await voyageService.extractImageMetadata(file.buffer);
        
        // Use provided title or generate from filename
        const photoTitle = title || file.originalname.replace(/\.[^/.]+$/, "");
        const photoDescription = `Uploaded photo: ${file.originalname}`;
        
        // Generate embedding from uploaded image
        const embedding = await voyageService.generatePhotoEmbedding(photoTitle, photoDescription, file.buffer);
        
        // Create base64 data URL for the image
        const finalImageUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

        const photo = new Photo({
          title: photoTitle,
          description: photoDescription,
          imageUrl: finalImageUrl,
          embeddings: {
            textEmbedding: undefined,
            imageEmbedding: voyageService.formatEmbedding(embedding)
          },
          metadata: {
            author: {
              name: 'Anonymous',
              username: '@anonymous',
              avatar: null
            },
            likes: 0,
            views: 0,
            downloads: 0,
            tags: [],
            category: 'other',
            colors: []
          },
          dimensions: {
            width: metadata.width,
            height: metadata.height
          },
          fileSize: metadata.size,
          source: {
            platform: 'custom',
            sourceId: null,
            sourceUrl: null,
            license: 'custom'
          }
        });

        await photo.save();
        console.log(`Successfully saved photo: ${photoTitle}`);
        
        addedPhotos.push({
          ...photo.toObject(),
          embedding: undefined // Don't return embedding in response
        });

      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        errors.push({
          filename: file.originalname,
          error: fileError.message
        });
      }
    }

    // Return response based on results
    if (addedPhotos.length === 0) {
      return res.status(400).json({
        error: 'Failed to process any photos',
        details: errors
      });
    }

    const response = {
      message: `Successfully uploaded ${addedPhotos.length} photo${addedPhotos.length > 1 ? 's' : ''}`,
      added_photos: addedPhotos
    };

    if (errors.length > 0) {
      response.warnings = `${errors.length} file${errors.length > 1 ? 's' : ''} failed to process`;
      response.failed_files = errors;
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('Add photos error:', error);
    res.status(500).json({
      error: 'Failed to add photos',
      message: error.message
    });
  }
});

// Delete photo (admin only)
app.delete('/api/photos/:id', async (req, res) => {
  try {
    const photo = await Photo.findByIdAndDelete(req.params.id);
    
    if (!photo) {
      return res.status(404).json({
        error: 'Photo not found'
      });
    }

    res.json({
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      error: 'Failed to delete photo',
      message: error.message
    });
  }
});

// Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Photo.aggregate([
      {
        $group: {
          _id: '$metadata.category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json(categories.map(cat => ({
      name: cat._id,
      count: cat.count
    })));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      error: 'Failed to get categories',
      message: error.message
    });
  }
});

// Test Voyage API connection
app.post('/api/test-voyage', async (req, res) => {
  try {
    const isConnected = await voyageService.testConnection();
    
    res.json({
      connected: isConnected,
      message: isConnected ? 'Voyage API connection successful' : 'Voyage API connection failed'
    });
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Image file size must be less than 10MB'
      });
    }
    return res.status(400).json({
      error: 'File upload error',
      message: error.message
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('✅ Database connected successfully');

    // Initialize database indexes
    await initializeIndexes();
    console.log('✅ Database indexes initialized');

    // Test Voyage API connection
    const voyageConnected = await voyageService.testConnection();
    if (voyageConnected) {
      console.log('✅ Voyage AI API connected successfully');
    } else {
      console.warn('⚠️  Voyage AI API connection failed - check your API key');
    }

    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Frontend: http://localhost:${PORT}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('\n📋 Available API endpoints:');
        console.log('  GET  /api/health - Health check');
        console.log('  GET  /api/stats - Database statistics');
        console.log('  POST /api/search/text - Search photos by text');
        console.log('  POST /api/search/image - Search photos by image');
        console.log('  GET  /api/photos - Get all photos');
        console.log('  GET  /api/photos/:id - Get photo by ID');
        console.log('  POST /api/photos - Add new photo');
        console.log('  DELETE /api/photos/:id - Delete photo');
        console.log('  GET  /api/categories - Get photo categories');
        console.log('  POST /api/test-voyage - Test Voyage API connection');
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();
