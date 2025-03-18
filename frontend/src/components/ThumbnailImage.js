import React, { useState, useEffect } from 'react';
import { pdfAPI } from '../services/api';

export function ThumbnailImage({ pdfId, title }) {
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
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
        }
      } catch (err) {
        console.error('Error fetching thumbnail:', err);
        if (mounted) {
          setError('Failed to load thumbnail');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchThumbnail();

    // Clean up the created blob URL when component unmounts
    return () => {
      mounted = false;
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [pdfId]);

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
        <span className="material-icons">error_outline</span>
      </div>
    );
  }

  return <img src={thumbnailUrl} alt={title} />;
} 