# MongoDB Atlas Vector Search Migration Guide

## Overview
Upgrade from custom MongoDB aggregation to MongoDB Atlas Vector Search for better performance and scalability.

## Step 1: Setup MongoDB Atlas

### 1.1 Create Atlas Cluster
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a new cluster (M10+ required for Vector Search)
3. Enable Vector Search in cluster settings
4. Get your connection string

### 1.2 Update Environment Variables
```bash
# Replace your current MONGODB_URI with Atlas connection string
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/photo_search?retryWrites=true&w=majority
```

## Step 2: Create Vector Search Index

### 2.1 Atlas UI Method
1. Go to Atlas Dashboard → Search → Create Search Index
2. Choose "JSON Editor"
3. Use this configuration:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embeddings.imageEmbedding",
      "numDimensions": 1024,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "metadata.category"
    },
    {
      "type": "filter", 
      "path": "metadata.tags"
    }
  ]
}
```

### 2.2 Programmatic Method (Alternative)
```javascript
// Add to your database initialization
const createVectorSearchIndex = async () => {
  try {
    const Photo = require('../models/Photo');
    
    await Photo.collection.createSearchIndex({
      name: "photo_vector_search",
      definition: {
        fields: [
          {
            type: "vector",
            path: "embeddings.imageEmbedding", 
            numDimensions: 1024,
            similarity: "cosine"
          },
          {
            type: "filter",
            path: "metadata.category"
          },
          {
            type: "filter",
            path: "metadata.tags"
          }
        ]
      }
    });
    
    console.log('Vector search index created successfully');
  } catch (error) {
    console.error('Error creating vector search index:', error);
  }
};
```

## Step 3: Update Photo Model

### 3.1 Replace findSimilar Method
Replace the current aggregation-based method with Atlas Vector Search:

```javascript
// Static method to find similar photos using Atlas Vector Search
photoSchema.statics.findSimilar = function(queryEmbedding, limit = 20, excludeId = null, category = null) {
  const pipeline = [
    {
      $vectorSearch: {
        index: "photo_vector_search",
        path: "embeddings.imageEmbedding",
        queryVector: queryEmbedding,
        numCandidates: Math.max(limit * 10, 100), // Search more candidates for better results
        limit: limit,
        filter: {
          ...(excludeId && { _id: { $ne: excludeId } }),
          ...(category && { "metadata.category": category })
        }
      }
    },
    {
      $addFields: {
        similarity: { $meta: "vectorSearchScore" }
      }
    },
    {
      $match: {
        similarity: { $gte: 0.22 } // Only show results with >22% similarity
      }
    },
    {
      $sort: { similarity: -1 }
    }
  ];

  return this.aggregate(pipeline);
};
```

## Step 4: Update Search Endpoints

### 4.1 Enhanced Text Search
```javascript
// Enhanced text search with hybrid capabilities
app.post('/api/search/text', async (req, res) => {
  try {
    const { query, limit = 20, page = 1, category } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query is required and must be a string'
      });
    }

    const startTime = Date.now();
    
    // Generate embedding for the search query
    console.log(`Generating embedding for text query: "${query}"`);
    const queryEmbedding = await voyageService.generateTextEmbedding(query);
    
    // Use Atlas Vector Search
    const results = await Photo.findSimilar(queryEmbedding, parseInt(limit), null, category);
    
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
        similarity: Math.round(photo.similarity * 100) / 100
      })),
      metadata: {
        totalResults: results.length,
        searchTime: `${searchTime}ms`,
        page: parseInt(page),
        limit: parseInt(limit),
        vectorSearch: true // Indicate this used vector search
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
```

## Step 5: Performance Benefits

### Before (Custom Aggregation):
- ❌ Brute force similarity calculation
- ❌ No vector indexing
- ❌ Slower with large datasets
- ❌ High memory usage

### After (Atlas Vector Search):
- ✅ HNSW approximate nearest neighbor
- ✅ Optimized vector indexing
- ✅ Sub-second search on millions of vectors
- ✅ Efficient memory usage
- ✅ Built-in filtering capabilities
- ✅ Automatic scaling

## Step 6: Migration Checklist

- [ ] Create MongoDB Atlas cluster (M10+)
- [ ] Update MONGODB_URI environment variable
- [ ] Create vector search index
- [ ] Update Photo model with new findSimilar method
- [ ] Test vector search functionality
- [ ] Monitor performance improvements
- [ ] Update documentation

## Step 7: Testing

```javascript
// Test vector search functionality
const testVectorSearch = async () => {
  try {
    // Generate a test embedding
    const testEmbedding = await voyageService.generateTextEmbedding("sunset mountain");
    
    // Search using new vector search
    const results = await Photo.findSimilar(testEmbedding, 10);
    
    console.log(`Found ${results.length} similar photos`);
    console.log('Similarity scores:', results.map(r => r.similarity));
    
    return results.length > 0;
  } catch (error) {
    console.error('Vector search test failed:', error);
    return false;
  }
};
```

## Expected Performance Improvements

- **Search Speed**: 10-100x faster for large datasets
- **Scalability**: Handle millions of vectors efficiently  
- **Accuracy**: Better similarity matching with HNSW
- **Resource Usage**: Lower CPU and memory consumption
- **Filtering
