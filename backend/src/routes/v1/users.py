from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ...utils.database import get_db
from ...models.user import User
from ...utils.auth import get_current_user
from pydantic import BaseModel
from typing import Dict, Any, Optional

router = APIRouter()

class UserPreferences(BaseModel):
    preferences: Dict[str, Any]

class ChatSettings(BaseModel):
    detailedResponse: Optional[bool] = False
    useTools: Optional[bool] = True

@router.get("/preferences", response_model=Dict[str, Any])
def get_user_preferences(current_user: User = Depends(get_current_user)):
    """
    Get user preferences including chat settings
    """
    # Return empty dict if no preferences are set
    return current_user.preferences or {}

@router.put("/preferences", response_model=Dict[str, Any])
def update_user_preferences(
    preferences: UserPreferences, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update user preferences
    """
    # Merge with existing preferences if any
    if current_user.preferences:
        # Deep merge existing settings with new settings
        updated_preferences = current_user.preferences.copy()
        for key, value in preferences.preferences.items():
            if isinstance(value, dict) and key in updated_preferences and isinstance(updated_preferences[key], dict):
                # Deep merge nested dicts
                updated_preferences[key].update(value)
            else:
                # Replace or add non-dict values
                updated_preferences[key] = value
    else:
        # No existing preferences, just use the new ones
        updated_preferences = preferences.preferences
    
    # Update the user model
    current_user.preferences = updated_preferences
    db.commit()
    
    return updated_preferences

@router.put("/preferences/chat-settings", response_model=Dict[str, Any])
def update_chat_settings(
    settings: ChatSettings,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update chat settings specifically
    """
    # Initialize preferences if not set
    if not current_user.preferences:
        current_user.preferences = {}
    
    # Make sure chat settings key exists
    if 'chatSettings' not in current_user.preferences:
        current_user.preferences['chatSettings'] = {}
    
    # Update chat settings
    chat_settings = current_user.preferences['chatSettings']
    
    # Only update the fields that were provided
    if settings.detailedResponse is not None:
        chat_settings['detailedResponse'] = settings.detailedResponse
    
    if settings.useTools is not None:
        chat_settings['useTools'] = settings.useTools
    
    db.commit()
    
    return current_user.preferences 