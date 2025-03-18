import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import { Navbar } from './Navbar';
import '../css/Profile.css';

export function Profile() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isUpdating, setIsUpdating] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [uploadError, setUploadError] = useState(null);
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    
    useEffect(() => {
        // Debug logged in user data
        console.log('Current user data in Profile:', user);
    }, [user]);

    // Helper function to get display name
    const getDisplayName = () => {
        if (user?.username) return user.username;
        if (user?.user?.username) return user.user.username;
        if (user?.email) return user.email;
        if (user?.user?.email) return user.user.email;
        return 'User';
    };

    // Helper function to get email
    const getEmail = () => {
        if (user?.email) return user.email;
        if (user?.user?.email) return user.user.email;
        return 'Not available';
    };

    const handleLogout = () => {
        logout(navigate);
    };

    const handleAvatarClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setUploadError("File is too large. Maximum size is 5MB.");
                return;
            }
            
            // Check file type
            if (!file.type.match('image.*')) {
                setUploadError("Please select an image file.");
                return;
            }
            
            setSelectedFile(file);
            setUploadError(null);
            
            // Preview the selected image
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result);
                setIsUpdating(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveAvatar = async () => {
        if (!selectedFile) return;
        
        setIsUpdating(true);
        setUploadError(null);
        
        try {
            const formData = new FormData();
            formData.append('avatar', selectedFile);
            
            const response = await userAPI.uploadAvatar(formData);
            
            // Update the user state with the new avatar URL
            // In a real implementation, this would update the user context or trigger a refresh
            if (response && response.data && response.data.avatar_url) {
                // Here we would update the user context with the new avatar URL
                alert('Avatar uploaded successfully!');
                // Refresh the page or update user context
                window.location.reload();
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            setUploadError(error.response?.data?.detail || 'Failed to upload avatar. Please try again.');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCancelUpdate = () => {
        setAvatarPreview(null);
        setSelectedFile(null);
        setUploadError(null);
        setIsUpdating(false);
    };

    return (
        <div className="profile-page">
            <Navbar />
            <div className="profile-container">
                <div className="profile-card">
                    <div className="profile-header">
                        <div 
                            className="profile-avatar-container" 
                            onClick={handleAvatarClick}
                            title="Click to change avatar"
                        >
                            {avatarPreview ? (
                                <img 
                                    src={avatarPreview} 
                                    alt="Avatar preview" 
                                    className="profile-avatar-image" 
                                />
                            ) : user?.avatar_url || user?.user?.avatar_url ? (
                                <img 
                                    src={user?.avatar_url || user?.user?.avatar_url} 
                                    alt={`${getDisplayName()}'s avatar`} 
                                    className="profile-avatar-image" 
                                />
                            ) : (
                                <div className="profile-avatar-placeholder">
                                    {getDisplayName().charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="avatar-overlay">
                                <span className="avatar-change-text">Change</span>
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                accept="image/*" 
                                style={{ display: 'none' }} 
                            />
                        </div>
                        <h1>{getDisplayName()}</h1>
                    </div>
                    
                    {isUpdating && (
                        <div className="avatar-update-actions">
                            {uploadError && <div className="error-message">{uploadError}</div>}
                            <button 
                                className="save-button" 
                                onClick={handleSaveAvatar}
                                disabled={!avatarPreview || !selectedFile}
                            >
                                Save Avatar
                            </button>
                            <button 
                                className="cancel-button" 
                                onClick={handleCancelUpdate}
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                    
                    <div className="profile-details">
                        <div className="profile-info-item">
                            <span className="label">Email:</span>
                            <span className="value">{getEmail()}</span>
                        </div>
                        
                        {(user?.full_name || user?.user?.full_name) && (
                            <div className="profile-info-item">
                                <span className="label">Full Name:</span>
                                <span className="value">{user?.full_name || user?.user?.full_name}</span>
                            </div>
                        )}
                        
                        <div className="profile-info-item">
                            <span className="label">Username:</span>
                            <span className="value">{getDisplayName()}</span>
                        </div>
                    </div>
                    
                    <div className="profile-actions">
                        <button 
                            className="logout-button" 
                            onClick={handleLogout}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
} 