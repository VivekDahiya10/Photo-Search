class VoyagePhotoSearch {
    constructor() {
        this.apiBaseUrl = '/api';
        this.currentQuery = '';
        this.currentResults = [];
        this.isLoading = false;
        this.currentPage = 1;
        this.totalResults = 0;
        
        this.initializeElements();
        this.bindEvents();
        this.loadInitialPhotos();
    }

    initializeElements() {
        this.elements = {
            searchInput: document.getElementById('searchInput'),
            searchBtn: document.getElementById('searchBtn'),
            imageUpload: document.getElementById('imageUpload'),
            uploadPreview: document.getElementById('uploadPreview'),
            addPhotoBtn: document.getElementById('addPhotoBtn'),
            addPhotoModal: document.getElementById('addPhotoModal'),
            closeAddPhotoModal: document.getElementById('closeAddPhotoModal'),
            addPhotoForm: document.getElementById('addPhotoForm'),
            fileUploadArea: document.getElementById('fileUploadArea'),
            photoFile: document.getElementById('photoFile'),
            photoPreview: document.getElementById('photoPreview'),
            photoTitle: document.getElementById('photoTitle'),
            photoDescription: document.getElementById('photoDescription'),
            authorName: document.getElementById('authorName'),
            authorUsername: document.getElementById('authorUsername'),
            photoCategory: document.getElementById('photoCategory'),
            photoTags: document.getElementById('photoTags'),
            cancelAddPhoto: document.getElementById('cancelAddPhoto'),
            submitPhoto: document.getElementById('submitPhoto'),
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('errorMessage'),
            errorText: document.getElementById('errorText'),
            resultsCount: document.getElementById('resultsCount'),
            searchTime: document.getElementById('searchTime'),
            photosGrid: document.getElementById('photosGrid'),
            loadMoreBtn: document.getElementById('loadMoreBtn'),
            photoModal: document.getElementById('photoModal'),
            closeModal: document.getElementById('closeModal'),
            modalImage: document.getElementById('modalImage'),
            modalTitle: document.getElementById('modalTitle'),
            modalDescription: document.getElementById('modalDescription'),
            scoreValue: document.getElementById('scoreValue'),
            modalLikes: document.getElementById('modalLikes'),
            modalViews: document.getElementById('modalViews'),
            modalAuthorAvatar: document.getElementById('authorAvatar'),
            modalAuthorName: document.getElementById('authorName'),
            modalAuthorUsername: document.getElementById('authorUsername'),
            downloadLink: document.getElementById('downloadLink'),
            modalErrorMessage: document.getElementById('modalErrorMessage'),
            modalErrorText: document.getElementById('modalErrorText'),
            modalSuccessMessage: document.getElementById('modalSuccessMessage'),
            modalSuccessText: document.getElementById('modalSuccessText')
        };
    }

    bindEvents() {
        // Search functionality
        this.elements.searchBtn.addEventListener('click', () => this.performTextSearch());
        this.elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performTextSearch();
        });

        // Image upload
        this.elements.imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));

        // Suggestion buttons
        document.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const query = e.target.getAttribute('data-query');
                this.elements.searchInput.value = query;
                this.performTextSearch();
            });
        });

        // Modal functionality
        this.elements.closeModal.addEventListener('click', () => this.closeModal());
        this.elements.photoModal.addEventListener('click', (e) => {
            if (e.target === this.elements.photoModal) this.closeModal();
        });

        // Add photo functionality
        this.elements.addPhotoBtn.addEventListener('click', () => this.openAddPhotoModal());
        this.elements.closeAddPhotoModal.addEventListener('click', () => this.closeAddPhotoModal());
        this.elements.cancelAddPhoto.addEventListener('click', () => this.closeAddPhotoModal());
        this.elements.addPhotoModal.addEventListener('click', (e) => {
            if (e.target === this.elements.addPhotoModal) this.closeAddPhotoModal();
        });

        // Photo upload form
        this.elements.addPhotoForm.addEventListener('submit', (e) => this.handlePhotoSubmit(e));
        this.elements.photoFile.addEventListener('change', (e) => this.handlePhotoFileChange(e));
        
        // Drag and drop functionality
        this.elements.fileUploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.elements.fileUploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.elements.fileUploadArea.addEventListener('drop', (e) => this.handleDrop(e));

        // Load more button
        this.elements.loadMoreBtn.addEventListener('click', () => this.loadMorePhotos());

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeAddPhotoModal();
            }
        });
    }

    async loadInitialPhotos() {
        try {
            this.showLoading();
            const response = await fetch(`${this.apiBaseUrl}/photos?limit=12`);
            const data = await response.json();
            
            if (response.ok) {
                this.currentResults = data.photos;
                this.displayResults(data.photos, 'Recent Photos');
                this.updateResultsInfo(data.photos.length, 'Recent photos loaded');
            } else {
                this.showError(data.message || 'Failed to load photos');
            }
        } catch (error) {
            console.error('Error loading initial photos:', error);
            this.showError('Failed to load photos. Please check your connection.');
        } finally {
            this.hideLoading();
        }
    }

    async performTextSearch() {
        const query = this.elements.searchInput.value.trim();
        if (!query) {
            this.showError('Please enter a search query');
            return;
        }

        try {
            this.showLoading();
            this.currentQuery = query;
            this.currentPage = 1;

            const response = await fetch(`${this.apiBaseUrl}/search/text`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: query,
                    limit: 20,
                    page: 1
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentResults = data.results;
                this.totalResults = data.metadata.totalResults;
                this.displayResults(data.results, `Search results for "${query}"`);
                this.updateResultsInfo(data.metadata.totalResults, data.metadata.searchTime);
                
                if (data.results.length === 0) {
                    this.showError('No photos found for your search. Try different keywords.');
                }
            } else {
                this.showError(data.message || 'Search failed');
            }
        } catch (error) {
            console.error('Text search error:', error);
            this.showError('Search failed. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file');
            return;
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('Image file size must be less than 10MB');
            return;
        }

        // Show preview
        this.showImagePreview(file);

        try {
            this.showLoading();
            
            const formData = new FormData();
            formData.append('image', file);
            formData.append('description', '');
            formData.append('limit', '20');
            formData.append('page', '1');

            const response = await fetch(`${this.apiBaseUrl}/search/image`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                this.currentResults = data.results;
                this.totalResults = data.metadata.totalResults;
                this.displayResults(data.results, 'Similar images found');
                this.updateResultsInfo(data.metadata.totalResults, data.metadata.searchTime);
                
                if (data.results.length === 0) {
                    this.showError('No similar images found. Try a different image.');
                }
            } else {
                this.showError(data.message || 'Image search failed');
            }
        } catch (error) {
            console.error('Image search error:', error);
            this.showError('Image search failed. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    showImagePreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.elements.uploadPreview.innerHTML = `
                <img src="${e.target.result}" alt="Upload preview">
                <p>Searching for similar images...</p>
            `;
        };
        reader.readAsDataURL(file);
    }

    displayResults(results, title) {
        this.elements.photosGrid.innerHTML = '';
        
        if (results.length === 0) {
            this.elements.photosGrid.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <h3>No photos found</h3>
                    <p>Try different search terms or upload a different image</p>
                </div>
            `;
            return;
        }

        results.forEach(photo => {
            const photoCard = this.createPhotoCard(photo);
            this.elements.photosGrid.appendChild(photoCard);
        });

        // Show load more button if there might be more results
        if (results.length >= 20) {
            this.elements.loadMoreBtn.classList.add('show');
        } else {
            this.elements.loadMoreBtn.classList.remove('show');
        }
    }

    createPhotoCard(photo) {
        const card = document.createElement('div');
        card.className = 'photo-card';
        card.onclick = () => this.openModal(photo);

        const similarityScore = photo.similarity ? Math.round(photo.similarity * 100) : null;
        
        card.innerHTML = `
            <img src="${photo.imageUrl}" alt="${photo.title}" loading="lazy">
            <div class="photo-info">
                <h3 class="photo-title">${this.escapeHtml(photo.title)}</h3>
                <p class="photo-description">${this.escapeHtml(photo.description.substring(0, 100))}${photo.description.length > 100 ? '...' : ''}</p>
                <div class="photo-stats">
                    <span><i class="fas fa-heart"></i> ${this.formatNumber(photo.metadata.likes)}</span>
                    <span><i class="fas fa-eye"></i> ${this.formatNumber(photo.metadata.views)}</span>
                    ${similarityScore ? `<span class="similarity-badge">${similarityScore}% match</span>` : ''}
                </div>
            </div>
        `;

        return card;
    }

    async openModal(photo) {
        try {
            // Fetch full photo details
            const response = await fetch(`${this.apiBaseUrl}/photos/${photo._id}`);
            const fullPhoto = await response.json();

            if (response.ok) {
                this.showModal(fullPhoto, photo.similarity);
            } else {
                this.showError('Failed to load photo details');
            }
        } catch (error) {
            console.error('Error loading photo details:', error);
            this.showError('Failed to load photo details');
        }
    }

    showModal(photo, similarity = null) {
        this.elements.modalImage.src = photo.imageUrl;
        this.elements.modalTitle.textContent = photo.title;
        this.elements.modalDescription.textContent = photo.description;
        
        if (similarity) {
            this.elements.scoreValue.textContent = `${Math.round(similarity * 100)}%`;
        } else {
            this.elements.scoreValue.textContent = 'N/A';
        }

        this.elements.modalLikes.innerHTML = `<i class="fas fa-heart"></i> ${this.formatNumber(photo.metadata.likes)}`;
        this.elements.modalViews.innerHTML = `<i class="fas fa-eye"></i> ${this.formatNumber(photo.metadata.views)}`;

        if (photo.metadata.author) {
            this.elements.authorAvatar.src = photo.metadata.author.avatar || 'https://via.placeholder.com/50';
            this.elements.authorName.textContent = photo.metadata.author.name;
            this.elements.authorUsername.textContent = photo.metadata.author.username;
        }

        this.elements.downloadLink.href = photo.source?.sourceUrl || photo.imageUrl;
        this.elements.downloadLink.target = '_blank';

        this.elements.photoModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.elements.photoModal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    async loadMorePhotos() {
        if (this.isLoading || !this.currentQuery) return;

        try {
            this.isLoading = true;
            this.elements.loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

            this.currentPage++;
            
            const response = await fetch(`${this.apiBaseUrl}/search/text`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: this.currentQuery,
                    limit: 20,
                    page: this.currentPage
                })
            });

            const data = await response.json();

            if (response.ok && data.results.length > 0) {
                data.results.forEach(photo => {
                    const photoCard = this.createPhotoCard(photo);
                    this.elements.photosGrid.appendChild(photoCard);
                });

                this.currentResults.push(...data.results);

                if (data.results.length < 20) {
                    this.elements.loadMoreBtn.classList.remove('show');
                }
            } else {
                this.elements.loadMoreBtn.classList.remove('show');
            }
        } catch (error) {
            console.error('Load more error:', error);
            this.showError('Failed to load more photos');
        } finally {
            this.isLoading = false;
            this.elements.loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Load More Photos';
        }
    }

    updateResultsInfo(count, searchTime) {
        this.elements.resultsCount.textContent = `${count} photos found`;
        this.elements.searchTime.textContent = searchTime;
    }

    showLoading() {
        this.isLoading = true;
        this.elements.loading.classList.add('show');
        this.elements.errorMessage.classList.remove('show');
        this.elements.searchBtn.disabled = true;
    }

    hideLoading() {
        this.isLoading = false;
        this.elements.loading.classList.remove('show');
        this.elements.searchBtn.disabled = false;
    }

    showError(message) {
        this.elements.errorText.textContent = message;
        this.elements.errorMessage.classList.add('show');
        
        // Auto-hide error after 5 seconds
        setTimeout(() => {
            this.elements.errorMessage.classList.remove('show');
        }, 5000);
    }

    hideError() {
        this.elements.errorMessage.classList.remove('show');
    }

    // Modal-specific error and success methods
    showModalError(message) {
        this.elements.modalErrorText.textContent = message;
        this.elements.modalErrorMessage.classList.add('show');
        
        // Auto-hide error after 5 seconds
        setTimeout(() => {
            this.elements.modalErrorMessage.classList.remove('show');
        }, 5000);
    }

    hideModalError() {
        this.elements.modalErrorMessage.classList.remove('show');
    }

    showModalSuccess(message) {
        this.elements.modalSuccessText.textContent = message;
        this.elements.modalSuccessMessage.classList.add('show');
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
            this.elements.modalSuccessMessage.classList.remove('show');
        }, 3000);
    }

    hideModalSuccess() {
        this.elements.modalSuccessMessage.classList.remove('show');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // Utility method to check if API is available
    async checkApiHealth() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/health`);
            const data = await response.json();
            return response.ok && data.status === 'healthy';
        } catch (error) {
            console.error('API health check failed:', error);
            return false;
        }
    }

    // Method to clear upload preview
    clearUploadPreview() {
        this.elements.uploadPreview.innerHTML = '';
        this.elements.imageUpload.value = '';
    }

    // Method to reset search
    resetSearch() {
        this.currentQuery = '';
        this.currentResults = [];
        this.currentPage = 1;
        this.totalResults = 0;
        this.elements.searchInput.value = '';
        this.clearUploadPreview();
        this.loadInitialPhotos();
    }

    // Photo upload modal methods
    openAddPhotoModal() {
        this.elements.addPhotoModal.classList.add('show');
        document.body.style.overflow = 'hidden';
        this.resetAddPhotoForm();
    }

    closeAddPhotoModal() {
        this.elements.addPhotoModal.classList.remove('show');
        document.body.style.overflow = 'auto';
        this.resetAddPhotoForm();
    }

    resetAddPhotoForm() {
        this.elements.addPhotoForm.reset();
        this.elements.photoPreview.classList.remove('show');
        this.elements.photoPreview.innerHTML = '';
        this.elements.fileUploadArea.classList.remove('dragover');
        this.elements.submitPhoto.disabled = false;
        this.elements.submitPhoto.classList.remove('loading');
        this.elements.submitPhoto.innerHTML = '<i class="fas fa-upload"></i> Add Photo';
        this.hideModalError();
        this.hideModalSuccess();
    }

    handlePhotoFileChange(event) {
        const files = event.target.files;
        if (files.length > 0) {
            this.validateAndPreviewFiles(files);
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        this.elements.fileUploadArea.classList.add('dragover');
    }

    handleDragLeave(event) {
        event.preventDefault();
        this.elements.fileUploadArea.classList.remove('dragover');
    }

    handleDrop(event) {
        event.preventDefault();
        this.elements.fileUploadArea.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.elements.photoFile.files = files;
            this.validateAndPreviewFiles(files);
        }
    }

    validateAndPreviewFiles(files) {
        const validFiles = [];
        let totalSize = 0;
        
        // Clear any previous errors
        this.hideModalError();
        
        // Validate each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
                this.showModalError(`${file.name} is not a valid image file. Only JPEG, PNG, and WebP are supported.`);
                continue;
            }

            // Validate file size (10MB limit per file)
            if (file.size > 10 * 1024 * 1024) {
                this.showModalError(`${file.name} is too large. Maximum file size is 10MB per image.`);
                continue;
            }

            validFiles.push(file);
            totalSize += file.size;
        }

        if (validFiles.length === 0) {
            this.showModalError('No valid image files selected.');
            return;
        }

        // Check total upload limit (100MB total)
        if (totalSize > 100 * 1024 * 1024) {
            this.showModalError('Total file size exceeds 100MB limit. Please select fewer or smaller images.');
            return;
        }

        // Show preview for multiple files
        this.showMultipleFilePreviews(validFiles);
    }

    showMultipleFilePreviews(files) {
        this.elements.photoPreview.innerHTML = '';
        
        if (files.length === 1) {
            // Single file preview (existing behavior)
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                this.elements.photoPreview.innerHTML = `
                    <img src="${e.target.result}" alt="Photo preview">
                    <p><i class="fas fa-check-circle"></i> ${file.name} (${this.formatFileSize(file.size)})</p>
                `;
                this.elements.photoPreview.classList.add('show');
            };
            reader.readAsDataURL(file);
        } else {
            // Multiple files preview
            const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
            
            this.elements.photoPreview.innerHTML = `
                <div class="multiple-files-preview">
                    <div class="files-summary">
                        <i class="fas fa-images"></i>
                        <h4>${files.length} photos selected</h4>
                        <p>Total size: ${this.formatFileSize(totalSize)}</p>
                    </div>
                    <div class="files-list">
                        ${Array.from(files).map(file => `
                            <div class="file-item">
                                <i class="fas fa-image"></i>
                                <span class="file-name">${file.name}</span>
                                <span class="file-size">${this.formatFileSize(file.size)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            this.elements.photoPreview.classList.add('show');
        }
    }

    validateAndPreviewFile(file) {
        // Legacy method for single file - redirect to new method
        this.validateAndPreviewFiles([file]);
    }

    async handlePhotoSubmit(event) {
        event.preventDefault();
        console.log('Upload form submitted!');
        
        const files = this.elements.photoFile.files;
        console.log('Files selected:', files.length);
        
        if (!files || files.length === 0) {
            console.log('No files selected');
            this.showModalError('Please select at least one image');
            return;
        }

        try {
            console.log('Starting upload process...');
            // Clear any previous errors/success messages
            this.hideModalError();
            this.hideModalSuccess();
            
            // Show loading state
            this.elements.submitPhoto.disabled = true;
            this.elements.submitPhoto.classList.add('loading');
            this.elements.submitPhoto.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

            // Use the photos endpoint for multiple files
            const formData = new FormData();
            
            // Add all selected files with the correct field name
            for (let i = 0; i < files.length; i++) {
                formData.append('photos', files[i]);
                console.log(`Added file ${i + 1}: ${files[i].name}`);
            }

            // No additional form data needed - just upload the files

            console.log('Making POST request to:', `${this.apiBaseUrl}/photos`);
            const response = await fetch(`${this.apiBaseUrl}/photos`, {
                method: 'POST',
                body: formData
            });

            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);

            if (response.ok) {
                const uploadedCount = data.added_photos ? data.added_photos.length : files.length;
                this.showModalSuccess(`${uploadedCount} photo${uploadedCount > 1 ? 's' : ''} uploaded successfully! They will appear in search results.`);
                
                // Close modal after showing success message briefly
                setTimeout(() => {
                    this.closeAddPhotoModal();
                    // Refresh the photos grid to show the new photos
                    this.loadInitialPhotos();
                }, 2000);
            } else {
                this.showModalError(data.message || 'Failed to upload photos');
            }
        } catch (error) {
            console.error('Photo upload error:', error);
            this.showModalError('Failed to upload photos. Please try again.');
        } finally {
            this.elements.submitPhoto.disabled = false;
            this.elements.submitPhoto.classList.remove('loading');
            this.elements.submitPhoto.innerHTML = '<i class="fas fa-upload"></i> Add Photos';
        }
    }

    showSuccessMessage(message) {
        // Create success message element if it doesn't exist
        let successElement = document.getElementById('successMessage');
        if (!successElement) {
            successElement = document.createElement('div');
            successElement.id = 'successMessage';
            successElement.className = 'success-message';
            successElement.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <p id="successText"></p>
            `;
            this.elements.errorMessage.parentNode.insertBefore(successElement, this.elements.errorMessage);
        }

        const successText = document.getElementById('successText');
        successText.textContent = message;
        successElement.classList.add('show');
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
            successElement.classList.remove('show');
        }, 5000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.photoSearchApp = new VoyagePhotoSearch();
});

// Add some CSS for no-results state
const style = document.createElement('style');
style.textContent = `
    .no-results {
        grid-column: 1 / -1;
        text-align: center;
        padding: 60px 20px;
        color: #6c757d;
    }

    .no-results i {
        font-size: 4rem;
        margin-bottom: 20px;
        opacity: 0.5;
    }

    .no-results h3 {
        font-size: 1.5rem;
        margin-bottom: 10px;
        color: #495057;
    }

    .no-results p {
        font-size: 1rem;
        opacity: 0.8;
    }

    .photo-card {
        cursor: pointer;
        transition: transform 0.2s ease;
    }

    .photo-card:hover {
        transform: translateY(-2px);
    }

    .photo-card img {
        transition: transform 0.3s ease;
    }

    .photo-card:hover img {
        transform: scale(1.05);
    }

    .similarity-badge {
        font-weight: 600;
        font-size: 0.75rem;
    }

    @media (max-width: 768px) {
        .no-results {
            padding: 40px 15px;
        }
        
        .no-results i {
            font-size: 3rem;
        }
        
        .no-results h3 {
            font-size: 1.25rem;
        }
    }
`;
document.head.appendChild(style);
