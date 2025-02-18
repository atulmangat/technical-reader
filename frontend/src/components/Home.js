import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../css/Home.css';

export function Home() {
    const [pdfs, setPdfs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchPdfs();
    }, []);

    const fetchPdfs = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/pdfs', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 401) {
                // Handle unauthorized access
                navigate('/login');
                return;
            }
            
            if (!response.ok) throw new Error('Failed to fetch PDFs');
            
            const data = await response.json();
            setPdfs(data);
        } catch (error) {
            console.error('Error fetching PDFs:', error);
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

        try {
            const response = await fetch('http://localhost:5000/api/pdfs', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const result = await response.json();
            setPdfs(prev => [...prev, result]);
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload PDF');
        } finally {
            setUploading(false);
        }
    };

    return (
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
                                        <img 
                                            src={`http://localhost:5000/thumbnails/${pdf.thumbnail_path.split('/').pop()}`}
                                            alt={pdf.title}
                                        />
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
                                    <p>Uploaded: {new Date(pdf.uploaded_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
} 