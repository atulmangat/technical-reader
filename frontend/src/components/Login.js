import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../css/Login.css';

export function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        username: ''
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const endpoint = isLogin ? '/auth/login' : '/auth/register';
            const response = await fetch(`http://localhost:5000${endpoint}`, {
                method: 'POST',
                credentials: 'include',  // Important for cookies
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            if (isLogin) {
                // Call the login function from AuthContext
                login(data);
                // Navigate to home page
                navigate('/', { replace: true });
            } else {
                setIsLogin(true);
                setFormData(prev => ({ ...prev, username: '' }));
                setError('Registration successful! Please login.');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
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
                    <button type="submit" className="submit-button">
                        {isLogin ? 'Login' : 'Register'}
                    </button>
                </form>
                <p className="toggle-form">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button 
                        className="toggle-button"
                        onClick={() => setIsLogin(!isLogin)}
                    >
                        {isLogin ? 'Register' : 'Login'}
                    </button>
                </p>
            </div>
        </div>
    );
} 