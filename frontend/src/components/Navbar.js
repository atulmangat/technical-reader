import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BiLibrary } from 'react-icons/bi';
import { BiUserCircle } from 'react-icons/bi';
import { FiLogOut } from 'react-icons/fi';
import '../css/Navbar.css';

export function Navbar() {
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const profileRef = useRef(null);

    // User profile helper functions
    const getDisplayName = () => {
        // Check for username in all possible locations
        if (user?.username) return user.username;
        if (user?.user?.username) return user.user.username;
        
        // If no username, try to extract from email
        if (user?.email) return user.email.split('@')[0];
        if (user?.user?.email) return user.user.email.split('@')[0];
        
        return 'User';
    };
    
    const getEmail = () => {
        if (user?.email) return user.email;
        if (user?.user?.email) return user.user.email;
        return 'No email available';
    };
    
    const getAvatarUrl = () => {
        return user?.avatar_url || user?.user?.avatar_url;
    };

    const handleLogout = () => {
        logout(navigate);
    };

    const toggleProfileMenu = () => {
        setShowProfileMenu(!showProfileMenu);
    };

    const goToProfile = () => {
        navigate('/profile');
        setShowProfileMenu(false);
    };

    // Close profile menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
        }
        
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className="navbar">
            <div className="navbar-left">
                <button className="library-button" onClick={() => navigate('/')}>
                    <div className="library-icon">
                        <BiLibrary />
                    </div>
                    <span className="library-text">Tech-Reader</span>
                </button>
            </div>
            <div className="navbar-right">
                <div className="profile-section" ref={profileRef}>
                    <span className="username">{getDisplayName()}</span>
                    <div className="avatar-container" onClick={toggleProfileMenu}>
                        {getAvatarUrl() ? (
                            <img className="avatar-image" src={getAvatarUrl()} alt="User avatar" />
                        ) : (
                            <div className="avatar-placeholder">
                                {getDisplayName().charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    
                    {/* Profile dropdown menu */}
                    {showProfileMenu && (
                        <div className="dropdown-menu">
                            <div className="dropdown-header">
                                <div className="dropdown-avatar">
                                    {getAvatarUrl() ? (
                                        <img className="dropdown-avatar-image" src={getAvatarUrl()} alt="User avatar" />
                                    ) : (
                                        <div className="dropdown-avatar-placeholder">
                                            {getDisplayName().charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="dropdown-user-info">
                                    <span className="dropdown-username">{getDisplayName()}</span>
                                    <span className="dropdown-email">{getEmail()}</span>
                                </div>
                            </div>
                            <div className="dropdown-content">
                                <button className="dropdown-item" onClick={goToProfile}>
                                    <BiUserCircle className="dropdown-icon" />
                                    Profile Settings
                                </button>
                                <button className="dropdown-item logout-button" onClick={handleLogout}>
                                    <FiLogOut className="dropdown-icon" />
                                    Logout
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 