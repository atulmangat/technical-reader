import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Helper to ensure consistent user object structure
    const normalizeUserData = (data) => {
        // Create a structured user object that contains both direct properties
        // and a nested user object to handle different API response formats
        const normalizedData = { ...data };
        
        // Ensure we have a user object
        if (!normalizedData.user) {
            normalizedData.user = {};
            
            // Copy relevant user fields from top level to user object
            if (normalizedData.email) normalizedData.user.email = normalizedData.email;
            if (normalizedData.username) normalizedData.user.username = normalizedData.username;
            if (normalizedData.id) normalizedData.user.id = normalizedData.id;
            if (normalizedData.avatar_url) normalizedData.user.avatar_url = normalizedData.avatar_url;
        }
        
        // Also ensure top-level properties for backward compatibility
        if (normalizedData.user.email && !normalizedData.email) 
            normalizedData.email = normalizedData.user.email;
        if (normalizedData.user.username && !normalizedData.username) 
            normalizedData.username = normalizedData.user.username;
        if (normalizedData.user.id && !normalizedData.id) 
            normalizedData.id = normalizedData.user.id;
        if (normalizedData.user.avatar_url && !normalizedData.avatar_url) 
            normalizedData.avatar_url = normalizedData.user.avatar_url;
            
        console.log('Normalized user data:', normalizedData);
        return normalizedData;
    };
    
    // Initialize auth state from localStorage on component mount
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                console.log('Parsed user data from localStorage:', userData);
                
                // Normalize the user data to ensure consistent structure
                const normalizedUserData = normalizeUserData(userData);
                setUser(normalizedUserData);
                
                // Store the access token in localStorage for the API interceptor
                if (normalizedUserData.token) {
                    console.log('Initializing with token from localStorage:', normalizedUserData.token.substring(0, 15) + '...');
                    localStorage.setItem('token', normalizedUserData.token);
                    // Set the authorization header for all future axios requests
                    axios.defaults.headers.common['Authorization'] = `Bearer ${normalizedUserData.token}`;
                    
                    // Verify the token is still valid
                    verifyToken();
                }
            } catch (error) {
                console.error('Error parsing stored user data:', error);
                // Clear invalid data
                localStorage.removeItem('user');
                localStorage.removeItem('token');
            }
        }
        setLoading(false);
    }, []);
    
    // Verify that the token is still valid
    const verifyToken = async () => {
        try {
            // Call the check-auth endpoint to verify the token
            const result = await authAPI.checkAuth();
            console.log('Token verification result:', result.data);
            
            // Update user data from the verification response if available
            if (result.data && result.data.user) {
                const updatedUserData = normalizeUserData({
                    ...user,
                    ...result.data.user,
                    user: {
                        ...user.user,
                        ...result.data.user
                    }
                });
                
                setUser(updatedUserData);
                localStorage.setItem('user', JSON.stringify(updatedUserData));
                console.log('Updated user data from token verification:', updatedUserData);
            }
            
            return true;
        } catch (error) {
            console.error('Token verification failed:', error);
            // If the token is invalid, log the user out
            if (error.response?.status === 401) {
                console.log('Token is invalid, logging out');
                logout();
            }
            return false;
        }
    };
    
    const login = async (credentials) => {
        try {
            const response = await authAPI.login(credentials);
            console.log('Login response:', response.data);
            
            // Make sure we have an access_token in the response
            if (!response.data.access_token) {
                console.error('No access_token in login response:', response.data);
                return { 
                    success: false, 
                    error: 'Invalid login response format' 
                };
            }
            
            // Create user data with both direct and nested structure
            const rawUserData = {
                ...response.data,
                token: response.data.access_token
            };
            
            // Normalize the user data
            const userData = normalizeUserData(rawUserData);
            
            // Store the raw access token for API interceptor
            console.log('Storing token in localStorage:', response.data.access_token);
            localStorage.setItem('token', response.data.access_token);
            
            // Also set the default Authorization header for axios
            axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
            
            // Store user data in localStorage
            localStorage.setItem('user', JSON.stringify(userData));
            
            setUser(userData);
            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            return { 
                success: false, 
                error: error.response?.data?.detail || 'Login failed' 
            };
        }
    };
    
    const googleLogin = async (token) => {
        try {
            const response = await authAPI.googleLogin(token);
            console.log('Google login response:', response.data);
            
            // Make sure we have an access_token in the response
            if (!response.data.access_token) {
                console.error('No access_token in Google login response:', response.data);
                return { 
                    success: false, 
                    error: 'Invalid login response format' 
                };
            }
            
            // Create user data with both direct and nested structure
            const rawUserData = {
                ...response.data,
                token: response.data.access_token
            };
            
            // Normalize the user data
            const userData = normalizeUserData(rawUserData);
            
            // Store the raw access token for API interceptor
            console.log('Storing token in localStorage:', response.data.access_token);
            localStorage.setItem('token', response.data.access_token);
            
            // Also set the default Authorization header for axios
            axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
            
            // Store user data in localStorage
            localStorage.setItem('user', JSON.stringify(userData));
            
            setUser(userData);
            return { success: true };
        } catch (error) {
            console.error('Google login error:', error);
            return { 
                success: false, 
                error: error.response?.data?.detail || 'Google login failed' 
            };
        }
    };
    
    const register = async (userData) => {
        try {
            const response = await authAPI.register(userData);
            console.log('Registration response:', response);
            return { success: true };
        } catch (error) {
            console.error('Registration error:', error);
            return { 
                success: false, 
                error: error.response?.data?.detail || 'Registration failed' 
            };
        }
    };
    
    const logout = (navigate) => {
        // Remove user from localStorage
        localStorage.removeItem('user');
        // Also remove token from localStorage
        localStorage.removeItem('token');
        // Remove Authorization header
        delete axios.defaults.headers.common['Authorization'];
        // Reset user state
        setUser(null);
        
        // If navigate function is provided, redirect to login page
        if (navigate) {
            navigate('/login');
        }
    };

    // Simple check if user is authenticated based on token existence
    const checkAuth = () => {
        return { success: !!user, user };
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            login,
            googleLogin,
            logout, 
            register,
            loading, 
            isAuthenticated: !!user,
            checkAuth,
            verifyToken
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
