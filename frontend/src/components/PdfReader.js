import React, { useState } from 'react';
import PdfUploader from './PdfUploader';
import PdfViewer from './PdfViewer';
import '../css/PdfReader.css';

const PdfReader = () => {
  const [pdfUrl, setPdfUrl] = useState(null);

  const handlePdfLoad = (url) => {
    setPdfUrl(url);
  };

  return (
    <div className="pdf-reader-container">
      <h2 className="pdf-reader-title">PDF Reader with Search</h2>
      
      {!pdfUrl ? (
        <PdfUploader onPdfLoad={handlePdfLoad} />
      ) : (
        <div className="pdf-reader-content">
          <div className="pdf-reader-actions">
            <button 
              className="new-pdf-button"
              onClick={() => setPdfUrl(null)}
            >
              Upload Different PDF
            </button>
          </div>
          <PdfViewer pdfUrl={pdfUrl} />
        </div>
      )}
    </div>
  );
};

export default PdfReader; 