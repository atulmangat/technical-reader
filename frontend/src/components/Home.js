import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { pdfAPI } from '../services/api';
import { Navbar } from './Navbar';
import '../css/Home.css';
import { ThumbnailImage } from './ThumbnailImage';

export function Home() {
    const [pdfs, setPdfs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated) {
            fetchPdfs();
        }
    }, [isAuthenticated]);

    const fetchPdfs = async () => {
        try {
            setLoading(true);
            const response = await pdfAPI.getAllPdfs();

            if (response.status === 200) {
                setPdfs(response.data);
            }
        } catch (error) {
            console.error('Error fetching PDFs:', error);
            if (error.response?.status === 401) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name);
        formData.append('description', '');

        try {
            const response = await pdfAPI.uploadPdf(formData);

            if (response.status === 201) {
                setPdfs(prev => [...prev, response.data]);
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload PDF: ' + (error.response?.data?.detail || 'Unknown error'));
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading your library...</p>
            </div>
        );
    }

    return (
        <div className="home-page">
            <Navbar />
            <div className="home-container">
                <div className="home-header">
                    <h1>Your Library</h1>
                    <label className="upload-button">
                        {uploading ? 'Uploading...' : 'Upload PDF'}
                        <input
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            disabled={uploading}
                        />
                    </label>
                </div>
                
                {pdfs.length === 0 ? (
                    <div className="empty-library">
                        <p>Your library is empty. Upload a PDF to get started!</p>
                    </div>
                ) : (
                    <div className="pdf-grid">
                        {pdfs.map(pdf => (
                            <Link to={`/pdf/${pdf.id}`} key={pdf.id} className="pdf-card">
                                <div className="pdf-book">
                                    <div className="book-spine">
                                        <span className="book-title">{pdf.title}</span>
                                    </div>
                                    <div className="book-cover">
                                        {pdf.thumbnail_path ? (
                                            <div className="pdf-thumbnail">
                                                <ThumbnailImage pdfId={pdf.id} title={pdf.title} />
                                            </div>
                                        ) : (
                                            <div className="pdf-thumbnail-placeholder">
                                                <span className="material-icons" aria-label="PDF document">
                                                    picture_as_pdf
                                                </span>
                                            </div>
                                        )}
                                        <div className="pdf-info">
                                            <h3>{pdf.title}</h3>
                                            <p>Pages: {pdf.total_pages || 'Unknown'}</p>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
