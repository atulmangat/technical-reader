import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalContent, setModalContent] = useState(null);
    const [modalType, setModalType] = useState('');
    const [pdfToDelete, setPdfToDelete] = useState(null);
    const [editingTitleId, setEditingTitleId] = useState(null);
    const [newTitle, setNewTitle] = useState('');
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const titleInputRef = useRef(null);

    const fetchPdfs = useCallback(async () => {
        try {
            setLoading(true);
            const response = await pdfAPI.getAllPdfs();

            if (response.status === 200) {
                // Make sure all PDFs have a valid page count
                const pdfData = response.data.map(pdf => ({
                    ...pdf,
                    total_pages: pdf.total_pages || 'Unknown'
                }));
                setPdfs(pdfData);
            }
        } catch (error) {
            console.error('Error fetching PDFs:', error);
            if (error.response?.status === 401) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchPdfs();
        }
    }, [isAuthenticated, fetchPdfs]);

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
                const uploadedPdf = response.data;
                setPdfs(prev => [...prev, uploadedPdf]);
                
                // Calculate indexing time based on page count (1 sec per 10 pages, minimum 10 seconds)
                const pageCount = uploadedPdf.total_pages || 0;
                const indexingTime = Math.max(10000, Math.ceil(pageCount / 10) * 1500);
                
                // Navigate to PDF viewer with indexing time parameter
                navigate(`/pdf/${uploadedPdf.id}?indexing=${indexingTime}`);
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

    const toggleMenu = (id) => {
        setActiveMenuId(activeMenuId === id ? null : id);
    };

    const handleClickOutside = () => {
        setActiveMenuId(null);
    };
    
    const confirmRename = useCallback(async (id) => {
        try {
            if (!newTitle.trim() || newTitle === pdfs.find(p => p.id === id)?.title) {
                setEditingTitleId(null);
                return;
            }
            
            await pdfAPI.renamePdf(id, newTitle);
            
            // Update pdfs state with the new title
            setPdfs(pdfs.map(pdf => 
                pdf.id === id 
                    ? { ...pdf, title: newTitle } 
                    : pdf
            ));
            
            setEditingTitleId(null);
        } catch (error) {
            console.error('Error renaming PDF:', error);
            alert('Failed to rename PDF: ' + (error.response?.data?.detail || 'Unknown error'));
            setEditingTitleId(null);
        }
    }, [pdfs, newTitle]);
    
    // Separate function for handling clicks outside the editing input
    const handleClickOutsideEdit = useCallback((e) => {
        if (titleInputRef.current && !titleInputRef.current.contains(e.target)) {
            confirmRename(editingTitleId);
        }
    }, [editingTitleId, confirmRename]);
    
    useEffect(() => {
        if (editingTitleId) {
            // Add a global click listener when editing a title
            document.addEventListener('mousedown', handleClickOutsideEdit);
            return () => {
                document.removeEventListener('mousedown', handleClickOutsideEdit);
            };
        }
    }, [editingTitleId, handleClickOutsideEdit]);

    const handleDelete = async (id, event) => {
        event.preventDefault();
        event.stopPropagation();
        
        setPdfToDelete(id);
        setModalType('delete');
        setModalContent({
            title: 'Confirm Deletion',
            message: 'Are you sure you want to delete this PDF? This action cannot be undone.'
        });
        setShowModal(true);
        setActiveMenuId(null);
    };

    const confirmDelete = async () => {
        try {
            await pdfAPI.deletePdf(pdfToDelete);
            
            // Dispatch a custom event to notify the system to clear the thumbnail cache
            window.dispatchEvent(new CustomEvent('thumbnail-cache-clear', {
                detail: { pdfId: pdfToDelete }
            }));
            
            setPdfs(pdfs.filter(pdf => pdf.id !== pdfToDelete));
            setShowModal(false);
        } catch (error) {
            console.error('Error deleting PDF:', error);
            setModalContent({
                ...modalContent,
                message: 'Failed to delete PDF: ' + (error.response?.data?.detail || 'Unknown error')
            });
        }
    };

    const handleShowInfo = (pdf, event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const createdDate = new Date(pdf.uploaded_at).toLocaleDateString();
        const fileSize = (pdf.file_size / (1024 * 1024)).toFixed(2);
        
        setModalType('info');
        setModalContent({
            title: 'PDF Information',
            pdf: {
                title: pdf.title,
                pages: pdf.total_pages || 'Unknown',
                fileSize: `${fileSize} MB`,
                uploadedAt: createdDate
            }
        });
        setShowModal(true);
        setActiveMenuId(null);
    };

    const closeModal = () => {
        setShowModal(false);
        setPdfToDelete(null);
    };

    const handleRename = (pdf, event) => {
        event.preventDefault();
        event.stopPropagation();
        
        setEditingTitleId(pdf.id);
        setNewTitle(pdf.title);
        setActiveMenuId(null);
        
        // Focus the input after it renders
        setTimeout(() => {
            if (titleInputRef.current) {
                titleInputRef.current.focus();
                titleInputRef.current.select();
            }
        }, 50);
    };

    const handleTitleKeyDown = (e, id) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmRename(id);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setEditingTitleId(null);
        }
    };

    // Custom Modal Component
    const Modal = () => {
        if (!showModal) return null;

        return (
            <div className="modal-overlay" onClick={closeModal}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>{modalContent.title}</h3>
                        <button className="modal-close" onClick={closeModal}>×</button>
                    </div>
                    <div className="modal-body">
                        {modalType === 'delete' ? (
                            <p>{modalContent.message}</p>
                        ) : (
                            <div className="pdf-info-details">
                                <p><strong>Title:</strong> {modalContent.pdf.title}</p>
                                <p><strong>Pages:</strong> {modalContent.pdf.pages}</p>
                                <p><strong>File Size:</strong> {modalContent.pdf.fileSize}</p>
                                <p><strong>Uploaded:</strong> {modalContent.pdf.uploadedAt}</p>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        {modalType === 'delete' ? (
                            <>
                                <button className="modal-button cancel" onClick={closeModal}>Cancel</button>
                                <button className="modal-button delete" onClick={confirmDelete}>Delete</button>
                            </>
                        ) : (
                            <button className="modal-button" onClick={closeModal}>Close</button>
                        )}
                    </div>
                </div>
            </div>
        );
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
        <div className="home-page" onClick={handleClickOutside}>
            <Navbar />
            <div className="home-container">
                <div className="home-header">
                    <h1 className="library-heading">Your Library</h1>
                    <label className="upload-button">
                        <span className="material-icons">upload_file</span>
                        <span>{uploading ? 'Uploading...' : 'Upload PDF'}</span>
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
                            <div className="pdf-card-container" key={pdf.id}>
                                <Link 
                                    to={`/pdf/${pdf.id}`} 
                                    className="pdf-card"
                                    onClick={(e) => {
                                        // Prevent navigation when in edit mode
                                        if (editingTitleId === pdf.id) {
                                            e.preventDefault();
                                        }
                                    }}
                                >
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
                                                {editingTitleId === pdf.id ? (
                                                    <div className="title-edit-container">
                                                        <input
                                                            ref={titleInputRef}
                                                            type="text"
                                                            className="title-edit-input"
                                                            value={newTitle}
                                                            onChange={(e) => setNewTitle(e.target.value)}
                                                            onKeyDown={(e) => handleTitleKeyDown(e, pdf.id)}
                                                            onBlur={() => confirmRename(pdf.id)}
                                                        />
                                                    </div>
                                                ) : (
                                                    <h3 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleRename(pdf, e);
                                                        }}
                                                        title="Click to rename"
                                                    >
                                                        {pdf.title}
                                                    </h3>
                                                )}
                                                <div className="pdf-info-footer">
                                                    <p>Pages: {pdf.total_pages}</p>
                                                    <button 
                                                        className="pdf-menu-button" 
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            toggleMenu(pdf.id);
                                                        }}
                                                        aria-label="PDF options"
                                                    >
                                                        <span className="material-icons">more_vert</span>
                                                    </button>
                                                </div>
                                                {activeMenuId === pdf.id && (
                                                    <div className="pdf-menu pdf-menu-bottom">
                                                        <button 
                                                            className="pdf-menu-item" 
                                                            onClick={(e) => handleShowInfo(pdf, e)}
                                                        >
                                                            <span className="material-icons">info</span>
                                                            Info
                                                        </button>
                                                        <button 
                                                            className="pdf-menu-item" 
                                                            onClick={(e) => handleRename(pdf, e)}
                                                        >
                                                            <span className="material-icons">edit</span>
                                                            Rename
                                                        </button>
                                                        <button 
                                                            className="pdf-menu-item pdf-menu-item-delete" 
                                                            onClick={(e) => handleDelete(pdf.id, e)}
                                                        >
                                                            <span className="material-icons">delete</span>
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {showModal && <Modal />}
        </div>
    );
}
