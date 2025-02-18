from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from .models import db, User

auth = Blueprint('auth', __name__)

@auth.route('/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already taken'}), 400
    
    user = User(
        email=data['email'],
        username=data['username']
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'User registered successfully'}), 201

@auth.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data['email']).first()
    
    if user and user.check_password(data['password']):
        login_user(user, remember=True)
        return jsonify({
            'id': user.id,
            'email': user.email,
            'username': user.username
        })
    
    return jsonify({'error': 'Invalid credentials'}), 401

@auth.route('/logout')
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'})

@auth.route('/check-auth', methods=['GET'])
def check_auth():
    if current_user.is_authenticated:
        return jsonify({
            'id': current_user.id,
            'email': current_user.email,
            'username': current_user.username
        })
    return jsonify({'error': 'Not authenticated'}), 401 