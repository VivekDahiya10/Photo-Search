const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced logging utility
const logger = {
  info: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ℹ️  INFO: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message, error = null) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ ERROR: ${message}`, error ? error.stack || error : '');
  },
  warn: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] ⚠️  WARN: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  success: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ✅ SUCCESS: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  request: (req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl;
    const ip = req.ip || req.connection.remoteAddress;
    
    console.log(`[${timestamp}] 🌐 ${method} ${url} - IP: ${ip}`);
    
    // Log request body for POST/PUT requests (excluding file uploads)
    if ((method === 'POST' || method === 'PUT') && !req.is('multipart/form-data')) {
      if (req.body && Object.keys(req.body).length > 0) {
        console.log(`[${timestamp}] 📝 Request Body:`, JSON.stringify(req.body, null, 2));
      }
    }
    
    // Log response time
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const statusEmoji = status >= 400 ? '❌' : status >= 300 ? '⚠️' : '✅';
      console.log(`[${timestamp}] ${statusEmoji} ${method} ${url} - ${status} - ${duration}ms`);
    });
    
    next();
  }
};

// Add request logging middleware
app.use(logger.request);

// In-memory storage for demo
let photos = [
  {
    _id: '1',
    title: 'Golden Mountain Sunset',
    description: 'Breathtaking sunset over snow-capped mountain peaks with golden light illuminating the landscape. The warm colors create a peaceful and majestic scene.',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
    metadata: {
      author: {
        name: 'Alex Mountain',
        username: '@alexmountain',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50'
      },
      likes: 1234,
      views: 5678,
      downloads: 234,
      tags: ['sunset', 'mountains', 'nature', 'golden hour', 'landscape'],
      category: 'nature',
      colors: ['#FF6B35', '#F7931E', '#FFD23F', '#4A90E2']
    },
    dimensions: { width: 1920, height: 1280 },
    fileSize: 245760,
    source: {
      platform: 'unsplash',
      sourceId: 'photo-1506905925346-21bda4d32df4',
      sourceUrl: 'https://unsplash.com/photos/photo-1506905925346-21bda4d32df4',
      license: 'cc0'
    },
    similarity: 0.95
  },
  {
    _id: '2',
    title: 'Cozy Coffee Shop Interior',
    description: 'Warm and inviting coffee shop interior with wooden tables, soft lighting, and a comfortable atmosphere perfect for reading or working.',
    imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400',
    metadata: {
      author: {
        name: 'Sarah Cafe',
        username: '@sarahcafe',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=50'
      },
      likes: 892,
      views: 3421,
      downloads: 156,
      tags: ['coffee', 'cafe', 'interior', 'cozy', 'warm', 'wooden'],
      category: 'architecture',
      colors: ['#8B4513', '#D2691E', '#F4A460', '#DEB887']
    },
    dimensions: { width: 1600, height: 1067 },
    fileSize: 198432,
    source: {
      platform: 'unsplash',
      sourceId: 'photo-1441986300917-64674bd600d8',
      sourceUrl: 'https://unsplash.com/photos/photo-1441986300917-64674bd600d8',
      license: 'cc0'
    },
    similarity: 0.88
  },
  {
    _id: '3',
    title: 'Person Reading by Window',
    description: 'Someone peacefully reading a book by a large window with natural light streaming in, creating a serene and contemplative atmosphere.',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    metadata: {
      author: {
        name: 'Mike Reader',
        username: '@mikereader',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50'
      },
      likes: 567,
      views: 2134,
      downloads: 89,
      tags: ['reading', 'book', 'window', 'natural light', 'peaceful', 'study'],
      category: 'people',
      colors: ['#F5F5DC', '#E6E6FA', '#B0C4DE', '#778899']
    },
    dimensions: { width: 1440, height: 960 },
    fileSize: 167890,
    source: {
      platform: 'unsplash',
      sourceId: 'photo-1507003211169-0a1dd7228f2d',
      sourceUrl: 'https://unsplash.com/photos/photo-1507003211169-0a1dd7228f2d',
      license: 'cc0'
    },
    similarity: 0.82
  },
  {
    _id: '4',
    title: 'Modern Glass Architecture',
    description: 'Contemporary building with sleek glass facade and geometric design, showcasing modern architectural innovation and urban development.',
    imageUrl: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=400',
    metadata: {
      author: {
        name: 'Urban Architect',
        username: '@urbanarchitect',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50'
      },
      likes: 1456,
      views: 6789,
      downloads: 298,
      tags: ['architecture', 'modern', 'glass', 'building', 'urban', 'geometric'],
      category: 'architecture',
      colors: ['#4682B4', '#87CEEB', '#B0C4DE', '#708090']
    },
    dimensions: { width: 1800, height: 1200 },
    fileSize: 289456,
    source: {
      platform: 'unsplash',
      sourceId: 'photo-1511818966892-d7d671e672a2',
      sourceUrl: 'https://unsplash.com/photos/photo-1511818966892-d7d671e672a2',
      license: 'cc0'
    },
    similarity: 0.79
  },
  {
    _id: '5',
    title: 'Fresh Vegetables on Wooden Table',
    description: 'Colorful array of fresh vegetables beautifully arranged on a rustic wooden table, showcasing healthy organic produce and natural ingredients.',
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400',
    metadata: {
      author: {
        name: 'Chef Maria',
        username: '@chefmaria',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=50'
      },
      likes: 789,
      views: 2456,
      downloads: 123,
      tags: ['vegetables', 'food', 'healthy', 'organic', 'fresh', 'cooking'],
      category: 'food',
      colors: ['#228B22', '#FF6347', '#FFD700', '#8B4513']
    },
    dimensions: { width: 1600, height: 1200 },
    fileSize: 234567,
    source: {
      platform: 'unsplash',
      sourceId: 'photo-1540420773420-3366772f4999',
      sourceUrl: 'https://unsplash.com/photos/photo-1540420773420-3366772f4999',
      license: 'cc0'
    },
    similarity: 0.75
  }
];

// Middleware setup
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'"]
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

app.use('/api/', limiter);

// Multer configuration for multiple file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 20 // Maximum 20 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
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

// Simple text-based search function
function searchPhotos(query, limit = 20) {
  if (!query) return photos.slice(0, limit);
  
  const queryLower = query.toLowerCase();
  const results = photos.filter(photo => {
    const titleMatch = photo.title.toLowerCase().includes(queryLower);
    const descMatch = photo.description.toLowerCase().includes(queryLower);
    const tagMatch = photo.metadata.tags.some(tag => tag.toLowerCase().includes(queryLower));
    const categoryMatch = photo.metadata.category.toLowerCase().includes(queryLower);
    
    return titleMatch || descMatch || tagMatch || categoryMatch;
  });
  
  // Add random similarity scores for demo
  return results.map(photo => ({
    ...photo,
    similarity: Math.round((Math.random() * 0.3 + 0.7) * 100) / 100
  })).slice(0, limit);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: { status: 'demo-mode', photos: photos.length },
    voyage: { status: 'demo-mode' },
    uptime: process.uptime()
  });
});

// Get database statistics
app.get('/api/stats', (req, res) => {
  const categories = {};
  photos.forEach(photo => {
    const cat = photo.metadata.category;
    categories[cat] = (categories[cat] || 0) + 1;
  });
  
  res.json({
    overview: {
      totalPhotos: photos.length,
      totalLikes: photos.reduce((sum, p) => sum + p.metadata.likes, 0),
      totalViews: photos.reduce((sum, p) => sum + p.metadata.views, 0),
      avgLikes: Math.round(photos.reduce((sum, p) => sum + p.metadata.likes, 0) / photos.length),
      avgViews: Math.round(photos.reduce((sum, p) => sum + p.metadata.views, 0) / photos.length)
    },
    categories: Object.entries(categories).map(([name, count]) => ({ _id: name, count }))
  });
});

// Search photos by text
app.post('/api/search/text', (req, res) => {
  try {
    const { query, limit = 20 } = req.body;
    
    logger.info('Text search request received', { query, limit });
    
    if (!query || typeof query !== 'string') {
      logger.warn('Invalid search query provided', { query, type: typeof query });
      return res.status(400).json({
        error: 'Query is required and must be a string'
      });
    }

    const startTime = Date.now();
    const results = searchPhotos(query, parseInt(limit));
    const searchTime = Date.now() - startTime;
    
    logger.success('Text search completed', { 
      query, 
      resultsCount: results.length, 
      searchTime: `${searchTime}ms` 
    });
    
    res.json({
      query,
      results,
      metadata: {
        totalResults: results.length,
        searchTime: `${searchTime}ms`,
        page: 1,
        limit: parseInt(limit),
        mode: 'demo'
      }
    });

  } catch (error) {
    logger.error('Text search failed', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

// Search photos by image (demo mode)
app.post('/api/search/image', (req, res) => {
  try {
    const { limit = 20 } = req.body;
    const startTime = Date.now();
    
    // Return random photos for demo
    const shuffled = [...photos].sort(() => 0.5 - Math.random());
    const results = shuffled.slice(0, parseInt(limit)).map(photo => ({
      ...photo,
      similarity: Math.round((Math.random() * 0.4 + 0.6) * 100) / 100
    }));
    
    const searchTime = Date.now() - startTime;
    
    res.json({
      query: 'Image search (demo mode)',
      results,
      metadata: {
        totalResults: results.length,
        searchTime: `${searchTime}ms`,
        page: 1,
        limit: parseInt(limit),
        mode: 'demo'
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
app.get('/api/photos/:id', (req, res) => {
  try {
    const photo = photos.find(p => p._id === req.params.id);
    
    if (!photo) {
      return res.status(404).json({
        error: 'Photo not found'
      });
    }
    
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
app.get('/api/photos', (req, res) => {
  try {
    const { page = 1, limit = 20, category, sortBy = 'likes', sortOrder = 'desc' } = req.query;
    
    let filteredPhotos = [...photos];
    
    if (category && category !== 'all') {
      filteredPhotos = filteredPhotos.filter(p => p.metadata.category === category);
    }
    
    // Sort photos
    filteredPhotos.sort((a, b) => {
      let aVal, bVal;
      if (sortBy === 'likes') {
        aVal = a.metadata.likes;
        bVal = b.metadata.likes;
      } else if (sortBy === 'views') {
        aVal = a.metadata.views;
        bVal = b.metadata.views;
      } else {
        aVal = a.title;
        bVal = b.title;
      }
      
      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : -1;
      } else {
        return aVal > bVal ? 1 : -1;
      }
    });
    
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedPhotos = filteredPhotos.slice(startIndex, endIndex);

    res.json({
      photos: paginatedPhotos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredPhotos.length,
        pages: Math.ceil(filteredPhotos.length / parseInt(limit))
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

// Get categories
app.get('/api/categories', (req, res) => {
  try {
    const categories = {};
    photos.forEach(photo => {
      const cat = photo.metadata.category;
      categories[cat] = (categories[cat] || 0) + 1;
    });

    res.json(Object.entries(categories).map(([name, count]) => ({
      name,
      count
    })));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      error: 'Failed to get categories',
      message: error.message
    });
  }
});

// Add multiple photos (demo mode)
app.post('/api/photos/bulk', upload.array('images', 20), (req, res) => {
  try {
    logger.info('Bulk photo upload request received', { 
      filesCount: req.files ? req.files.length : 0,
      bodyKeys: Object.keys(req.body)
    });

    if (!req.files || req.files.length === 0) {
      logger.warn('No image files provided in bulk upload request');
      return res.status(400).json({
        error: 'No image files provided'
      });
    }

    const {
      title = '',
      description = '',
      authorName = 'Anonymous',
      authorUsername = '@anonymous',
      category = 'other',
      tags = ''
    } = req.body;

    logger.info('Processing bulk upload with metadata', {
      title: title || 'default',
      description: description || 'default',
      authorName,
      authorUsername,
      category,
      tags: tags || 'none',
      filesCount: req.files.length
    });

    const addedPhotos = [];
    const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
    const startTime = Date.now();

    req.files.forEach((file, index) => {
      const photoId = (photos.length + index + 1).toString();
      const fileName = file.originalname || `photo-${photoId}`;
      const fileTitle = title || `Uploaded Photo ${photoId}`;
      const fileDesc = description || `Photo uploaded from ${fileName}`;
      
      logger.info(`Processing file ${index + 1}/${req.files.length}`, {
        fileName,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        mimeType: file.mimetype,
        photoId
      });
      
      // Convert buffer to base64 for demo storage
      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      
      const newPhoto = {
        _id: photoId,
        title: fileTitle,
        description: fileDesc,
        imageUrl: base64Image,
        thumbnailUrl: base64Image,
        metadata: {
          author: {
            name: authorName,
            username: authorUsername,
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50'
          },
          likes: Math.floor(Math.random() * 100),
          views: Math.floor(Math.random() * 1000),
          downloads: Math.floor(Math.random() * 50),
          tags: tagsArray.length > 0 ? tagsArray : ['uploaded', 'user-content'],
          category: category,
          colors: ['#4A90E2', '#7ED321', '#F5A623', '#D0021B']
        },
        dimensions: { width: 800, height: 600 },
        fileSize: file.size,
        source: {
          platform: 'user-upload',
          sourceId: photoId,
          sourceUrl: '#',
          license: 'user-content'
        },
        createdAt: new Date(),
        similarity: 1.0
      };

      photos.push(newPhoto);
      addedPhotos.push(newPhoto);
    });

    const processingTime = Date.now() - startTime;
    const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);

    logger.success('Bulk photo upload completed successfully', {
      uploadedCount: addedPhotos.length,
      totalPhotosInStorage: photos.length,
      processingTime: `${processingTime}ms`,
      totalUploadSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
      fileNames: req.files.map(f => f.originalname)
    });

    res.status(201).json({
      message: `Successfully added ${addedPhotos.length} photos`,
      uploadedPhotos: addedPhotos.map(photo => ({
        _id: photo._id,
        title: photo.title,
        description: photo.description,
        category: photo.metadata.category,
        tags: photo.metadata.tags,
        fileSize: photo.fileSize,
        createdAt: photo.createdAt
      })),
      totalPhotos: photos.length,
      processingTime: `${processingTime}ms`
    });

  } catch (error) {
    logger.error('Bulk photo upload failed', error);
    res.status(500).json({
      error: 'Failed to upload photos',
      message: error.message
    });
  }
});

// Test connection (demo mode)
app.post('/api/test-voyage', (req, res) => {
  res.json({
    connected: false,
    message: 'Demo mode - Voyage API not connected'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
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

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Demo Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
  console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎯 Demo Mode: Using in-memory storage with ${photos.length} sample photos`);
  
  console.log('\n📋 Available API endpoints:');
  console.log('  GET  /api/health - Health check');
  console.log('  GET  /api/stats - Database statistics');
  console.log('  POST /api/search/text - Search photos by text');
  console.log('  POST /api/search/image - Search photos by image (demo)');
  console.log('  GET  /api/photos - Get all photos');
  console.log('  GET  /api/photos/:id - Get photo by ID');
  console.log('  GET  /api/categories - Get photo categories');
  console.log('  POST /api/test-voyage - Test Voyage API connection');
});
