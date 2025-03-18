import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './components/Login';
import { Home } from './components/Home';
import { PdfViewer } from './components/PdfViewer';
import { Profile } from './components/Profile';
import './css/App.css';

function App() {
    return (
        <GoogleOAuthProvider clientId="320322566426-ke7dlukqjv1rucn27c0l68cbe6kgvu3v.apps.googleusercontent.com">
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={
                            <ProtectedRoute>
                                <Home />
                            </ProtectedRoute>
                        } />
                        <Route path="/pdf/:id" element={
                            <ProtectedRoute>
                                <PdfViewer />
                            </ProtectedRoute>
                        } />
                        <Route path="/profile" element={
                            <ProtectedRoute>
                                <Profile />
                            </ProtectedRoute>
                        } />
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </GoogleOAuthProvider>
    );
}

export default App;
