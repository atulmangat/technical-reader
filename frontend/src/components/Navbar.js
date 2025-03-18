import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../css/Navbar.css';

export function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    
    useEffect(() => {
        // Debug log user data
        console.log('Current user data in Navbar:', user);
    }, [user]);

    // Function to get display name - extract username from email if no username present
    const getDisplayName = () => {
        // Check for username in all possible locations
        if (user?.username) return user.username;
        if (user?.user?.username) return user.user.username;
        
        // If no username, try to extract from email
        if (user?.email) return user.email.split('@')[0];
        if (user?.user?.email) return user.user.email.split('@')[0];
        
        return 'User';
    };
    
    // Function to get user email
    const getEmail = () => {
        if (user?.email) return user.email;
        if (user?.user?.email) return user.user.email;
        return 'No email available';
    };
    
    // Function to get avatar URL
    const getAvatarUrl = () => {
        return user?.avatar_url || user?.user?.avatar_url;
    };

    const handleLogout = () => {
        logout(navigate);
    };

    const toggleProfileMenu = () => {
        setShowProfileMenu(!showProfileMenu);
    };

    // Navigate to profile page
    const goToProfile = () => {
        navigate('/profile');
        setShowProfileMenu(false);
    };

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/">Tech Reader</Link>
            </div>
            <div className="navbar-menu">
                <div className="user-info">
                    <span className="username">{getDisplayName()}</span>
                </div>
                <div className="profile-dropdown">
                    <button 
                        className="profile-button" 
                        onClick={toggleProfileMenu}
                        aria-expanded={showProfileMenu}
                        title="Profile Menu"
                    >
                        <div className="avatar-container">
                            {getAvatarUrl() ? (
                                <img 
                                    src={getAvatarUrl()} 
                                    alt={`${getDisplayName()}'s avatar`} 
                                    className="avatar-image" 
                                />
                            ) : (
                                <div className="avatar-placeholder">
                                    {getDisplayName().charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                    </button>
                    
                    {showProfileMenu && (
                        <div className="dropdown-menu">
                            <div className="dropdown-header">
                                <div className="dropdown-avatar">
                                    {getAvatarUrl() ? (
                                        <img 
                                            src={getAvatarUrl()} 
                                            alt={`${getDisplayName()}'s avatar`} 
                                            className="dropdown-avatar-image" 
                                        />
                                    ) : (
                                        <div className="dropdown-avatar-placeholder">
                                            {getDisplayName().charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="dropdown-user-info">
                                    <div className="dropdown-username">{getDisplayName()}</div>
                                    <div className="dropdown-email">{getEmail()}</div>
                                </div>
                            </div>
                            <div className="dropdown-content">
                                <button onClick={goToProfile} className="dropdown-item">
                                    Profile
                                </button>
                                <button 
                                    className="dropdown-item" 
                                    onClick={goToProfile}
                                >
                                    Change Avatar
                                </button>
                                <button 
                                    className="dropdown-item logout-button" 
                                    onClick={handleLogout}
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
} 