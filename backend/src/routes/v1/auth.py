from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from ...utils.database import get_db
from ...models.user import User
from ...utils.auth import (
    create_access_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from pydantic import BaseModel
from datetime import datetime
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

router = APIRouter()


class UserCreate(BaseModel):
    email: str
    username: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class GoogleLogin(BaseModel):
    token: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    created_at: datetime

    class Config:
        from_attributes = True



@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(email=user_data.email, username=user_data.username)
    user.set_password(user_data.password)

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/token")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not user.check_password(form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=dict)
def login_with_email(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()

    if not user or not user.check_password(user_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "username": user.username},
    }


@router.get("/check-auth", response_model=UserResponse)
def check_auth(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/google-login", response_model=dict)
async def google_login(google_data: GoogleLogin, db: Session = Depends(get_db)):
    try:
        # Verify the Google token
        idinfo = id_token.verify_oauth2_token(
            google_data.token, 
            google_requests.Request(), 
            "320322566426-ke7dlukqjv1rucn27c0l68cbe6kgvu3v.apps.googleusercontent.com"
        )
        
        # Check if the token is issued for our app
        if idinfo['aud'] != "320322566426-ke7dlukqjv1rucn27c0l68cbe6kgvu3v.apps.googleusercontent.com":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google token: Wrong audience",
            )
            
        # Get user info from the token
        google_id = idinfo['sub']
        email = idinfo['email']
        name = idinfo.get('name', email.split('@')[0])
        
        # Check if user exists with this Google ID
        user = db.query(User).filter(User.google_id == google_id).first()
        
        # If not, check if user exists with this email
        if not user:
            user = db.query(User).filter(User.email == email).first()
            
            # If user exists with this email but not linked to Google
            if user:
                # Link the Google account to the existing user
                user.google_id = google_id
                user.is_google_account = True
                db.commit()
            else:
                # Create a new user
                username = name
                base_username = username
                counter = 1
                
                # Make sure username is unique
                while db.query(User).filter(User.username == username).first():
                    username = f"{base_username}{counter}"
                    counter += 1
                
                user = User(
                    email=email,
                    username=username,
                    google_id=google_id,
                    is_google_account=True
                )
                
                # Set a random password (user won't use it)
                import secrets
                random_password = secrets.token_hex(16)
                user.set_password(random_password)
                
                db.add(user)
                db.commit()
                db.refresh(user)
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id)}, expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {"id": user.id, "email": user.email, "username": user.username},
        }
        
    except ValueError as e:
        # Invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during Google authentication: {str(e)}",
        )
