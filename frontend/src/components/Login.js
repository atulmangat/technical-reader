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
            <div className="login-card">
                <h2>{isLogin ? 'Login' : 'Register'}</h2>
                {error && <div className="error-message">{error}</div>}
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
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="submit-button"
                        disabled={loading}
                    >
                        {loading 
                            ? (isLogin ? 'Logging in...' : 'Registering...') 
                            : (isLogin ? 'Login' : 'Register')
                        }
                    </button>
                </form>
                
                <div className="social-login">
                    <p>Or {isLogin ? 'login' : 'register'} with:</p>
                    <div className="google-login-container">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            useOneTap
                            theme="filled_blue"
                            text={isLogin ? "signin_with" : "signup_with"}
                            shape="rectangular"
                            logo_alignment="center"
                            width="280"
                        />
                    </div>
                </div>
                
                <p className="toggle-form">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        className="toggle-button"
                        onClick={() => setIsLogin(!isLogin)}
                        disabled={loading}
                    >
                        {isLogin ? 'Register' : 'Login'}
                    </button>
                </p>
            </div>
        </div>
    );
}
