import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import '../css/Login.css';

export function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        username: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login, register, googleLogin } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                // Login
                const { email, password } = formData;
                const result = await login({ email, password });
                
                if (result.success) {
                    // Navigate to home page
                    navigate('/', { replace: true });
                } else {
                    setError(result.error);
                }
            } else {
                // Register
                const result = await register(formData);
                
                if (result.success) {
                    // Auto login after successful registration
                    try {
                        const { email, password } = formData;
                        const loginResult = await login({ email, password });
                        
                        if (loginResult.success) {
                            // Navigate to home page
                            navigate('/', { replace: true });
                        } else {
                            setIsLogin(true);
                            setFormData(prev => ({ ...prev, username: '' }));
                            setError('Registration successful! Please login manually: ' + loginResult.error);
                        }
                    } catch (loginErr) {
                        console.error('Auto-login error:', loginErr);
                        setIsLogin(true);
                        setFormData(prev => ({ ...prev, username: '' }));
                        setError('Registration successful! Please login manually.');
                    }
                } else {
                    setError(result.error);
                }
            }
        } catch (err) {
            console.error('Form submission error:', err);
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setError('');
        setLoading(true);
        
        try {
            const result = await googleLogin(credentialResponse.credential);
            
            if (result.success) {
                // Navigate to home page
                navigate('/', { replace: true });
            } else {
                setError(result.error);
            }
        } catch (err) {
            console.error('Google login error:', err);
            setError(err.message || 'An error occurred during Google login');
        } finally {
            setLoading(false);
        }
    };
    
    const handleGoogleError = () => {
        setError('Google login failed. Please try again or use email login.');
    };

    return (
        <div className="login-container">
            <div className="login-layout">
                {/* Left info panel (hidden on mobile) */}
                <div className="login-info-panel">
                    <div className="login-info-content">
                        <h1>Your Assistant<br/>for PDFs</h1>
                        <p className="login-subtitle">Upload your documents and get instant AI-powered insights, summaries, and answers</p>
                        
                        <div className="features-grid">
                            <div className="feature-item">
                                <span className="material-icons feature-icon">upload_file</span>
                                <div className="feature-text">
                                    <h3>Upload Your PDF</h3>
                                    <p>Drag and drop your file here or click to browse</p>
                                </div>
                            </div>

                            <div className="feature-item">
                                <span className="material-icons feature-icon">question_answer</span>
                                <div className="feature-text">
                                    <h3>Ask Questions</h3>
                                    <p>Get instant answers from your PDFs with AI assistance</p>
                                </div>
                            </div>

                            <div className="feature-item">
                                <span className="material-icons feature-icon">auto_stories</span>
                                <div className="feature-text">
                                    <h3>Easy Reading</h3>
                                    <p>Smooth navigation and reader-friendly interface</p>
                                </div>
                            </div>

                            <div className="feature-item">
                                <span className="material-icons feature-icon">highlight_alt</span>
                                <div className="feature-text">
                                    <h3>Highlight</h3>
                                    <p>Mark important passages and add your own notes</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right form panel */}
                <div className="login-form-panel">
                    <div className="login-form-container">
                        {/* Mobile-only logo and title */}
                        <div className="mobile-header">
                            <h1>Your Assistant for PDFs</h1>
                            <p>Upload documents and get AI-powered insights</p>
                        </div>

                        <h2>{isLogin ? 'Log in' : 'Create an account'}</h2>
                        {error && <div className="error-message">{error}</div>}
                        
                        {/* Google login button */}
                        <div className="google-login-container">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={handleGoogleError}
                                useOneTap
                                theme="filled_blue"
                                text={isLogin ? "signin_with" : "signup_with"}
                                shape="rectangular"
                                logo_alignment="center"
                                width="100%"
                                size="large"
                            />
                        </div>
                        
                        <div className="divider">
                            <span>or continue with email</span>
                        </div>
                        
                        {/* Email login form */}
                        <form onSubmit={handleSubmit}>
                            {!isLogin && (
                                <div className="form-group">
                                    <label>Username</label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        required
                                        placeholder="Your username"
                                    />
                                </div>
                            )}
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    placeholder="Your email address"
                                />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    placeholder="Your password"
                                />
                            </div>
                            <button 
                                type="submit" 
                                className="submit-button"
                                disabled={loading}
                            >
                                {loading 
                                    ? (isLogin ? 'Logging in...' : 'Creating account...') 
                                    : (isLogin ? 'Log in' : 'Create account')
                                }
                            </button>
                        </form>
                        
                        <p className="toggle-form">
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                            <button
                                className="toggle-button"
                                onClick={() => setIsLogin(!isLogin)}
                                disabled={loading}
                            >
                                {isLogin ? 'Sign up' : 'Log in'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
