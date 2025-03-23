import React, { useState, useEffect } from 'react';
import { pdfAPI } from '../services/api';

export function ThumbnailImage({ pdfId, title }) {
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;

  useEffect(() => {
    let mounted = true;
    let retryTimeout = null;
    
    const fetchThumbnail = async () => {
      try {
        setIsLoading(true);
        // Use the API call that includes auth headers
        const response = await pdfAPI.getThumbnail(pdfId);
        
        // Create a blob URL from the response data
        const blob = new Blob([response.data], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        
        if (mounted) {
          setThumbnailUrl(url);
          setError(null);
          setRetryCount(0); // Reset retry count on success
        }
      } catch (err) {
        console.error('Error fetching thumbnail:', err);
        if (mounted) {
          setError('Failed to load thumbnail');
          
          // Retry logic for transient errors
          if (retryCount < MAX_RETRIES) {
            const nextRetry = retryCount + 1;
            setRetryCount(nextRetry);
            
            // Exponential backoff for retries
            const backoffTime = Math.pow(2, nextRetry) * 1000;
            console.log(`Retrying thumbnail fetch (${nextRetry}/${MAX_RETRIES}) in ${backoffTime}ms`);
            
            retryTimeout = setTimeout(() => {
              if (mounted) {
                fetchThumbnail();
              }
            }, backoffTime);
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchThumbnail();

    // Listen for the custom event to clear thumbnail cache
    const handleCacheClear = (event) => {
      if (event.detail.pdfId === pdfId && thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
        setThumbnailUrl('');
        setError('Thumbnail was deleted');
      }
    };

    window.addEventListener('thumbnail-cache-clear', handleCacheClear);

    // Clean up the created blob URL when component unmounts
    return () => {
      mounted = false;
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      window.removeEventListener('thumbnail-cache-clear', handleCacheClear);
    };
  }, [pdfId]);

  // Function to generate a placeholder with the first letter of the title
  const generatePlaceholder = () => {
    const firstLetter = title?.charAt(0)?.toUpperCase() || '?';
    const colors = [
      '#4285F4', '#EA4335', '#FBBC05', '#34A853', // Google colors
      '#1976D2', '#E53935', '#FFB300', '#43A047'  // Material colors
    ];
    
    // Generate a consistent color based on the title
    const colorIndex = title ? title.charCodeAt(0) % colors.length : 0;
    const bgColor = colors[colorIndex];
    
    return (
      <div 
        className="thumbnail-placeholder" 
        style={{ 
          backgroundColor: bgColor,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          fontSize: '2rem',
          fontWeight: 'bold'
        }}
      >
        {firstLetter}
      </div>
    );
  };

  const handleRetry = () => {
    setRetryCount(0);
    setError(null);
    setIsLoading(true);
  };

  if (isLoading) {
    return (
      <div className="thumbnail-loading">
        <div className="loading-spinner-small"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="thumbnail-error">
        {generatePlaceholder()}
        {retryCount >= MAX_RETRIES && (
          <button 
            className="retry-button"
            onClick={handleRetry}
            style={{
              position: 'absolute',
              bottom: '5px',
              right: '5px',
              background: 'rgba(255,255,255,0.8)',
              border: 'none',
              borderRadius: '4px',
              padding: '2px 5px',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="thumbnail-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <img 
        src={thumbnailUrl} 
        alt={title} 
        onError={() => {
          setError('Image failed to load');
        }}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
} 