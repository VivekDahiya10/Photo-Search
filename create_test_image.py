#!/usr/bin/env python3
from PIL import Image

# Create a simple test image
img = Image.new('RGB', (100, 100), color='red')
img.save('test_image.jpg')
print('Test image created: test_image.jpg')
