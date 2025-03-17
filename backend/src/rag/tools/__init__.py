"""
Tool interfaces for the RAG system.
"""
from typing import Dict, Optional

from .tool_interface import ToolInterface
from .embeddings import embeddings_tool
from .highlights import highlights_tool
from .notes import notes_tool
from .summary import summary_tool
from .content import content_tool

# Collection of all available tool interfaces
TOOL_INTERFACES = {
    embeddings_tool.name: embeddings_tool,
    highlights_tool.name: highlights_tool,
    notes_tool.name: notes_tool,
    summary_tool.name: summary_tool,
    content_tool.name: content_tool,
}

def get_all_tool_interfaces() -> Dict[str, ToolInterface]:
    """
    Get all available tool interfaces.
    
    Returns:
        Dictionary mapping tool names to tool interfaces
    """
    return TOOL_INTERFACES

def _get_tool_interface(name: str) -> ToolInterface:
    """
    Get a tool interface by name.
    
    Args:
        name: Name of the tool interface
        
    Returns:
        Tool interface if found, None otherwise
    """
    return TOOL_INTERFACES.get(name)

def get_function_descriptions(tool_name: Optional[str] = None) -> Dict[str, Dict[str, str]]:
    """
    Get descriptions for all functions in all tools or a specific tool.
    
    Args:
        tool_name: Name of the tool to get function descriptions for (optional)
        
    Returns:
        Dictionary mapping tool names to dictionaries of function names and descriptions,
        or a single dictionary of function names and descriptions if tool_name is provided
    """
    if tool_name:
        tool = _get_tool_interface(tool_name)
        if not tool:
            return {}
        return tool.get_function_descriptions()
    
    return {
        name: tool.get_function_descriptions()
        for name, tool in TOOL_INTERFACES.items()
    }
