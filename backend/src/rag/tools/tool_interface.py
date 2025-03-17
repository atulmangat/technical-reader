from typing import List, Dict, Any, Callable, Optional, Set
import inspect


class ToolInterface:
    """
    A tool interface that LLMs can use to call functions.
    This interface doesn't require an execute method, instead exposing functions directly.
    """
    
    def __init__(self, name: str, description: str):
        """
        Initialize a tool interface with a name and description.
        
        Args:
            name: Name of the tool interface
            description: Description of what the tool interface does
        """
        self.name = name
        self.description = description
        self._functions = {}
        self._injectable_param_types = {"db", "vector_db"}  # Default injectable parameter names
        
    def register_function(self, func: Callable) -> Callable:
        """
        Register a function with this tool interface.
        Can be used as a decorator.
        
        Args:
            func: The function to register
            
        Returns:
            The original function (for decorator usage)
        """
        self._functions[func.__name__] = func
        return func
    
    def set_injectable_params(self, param_names: Set[str]):
        """
        Set the parameter names that should be injected rather than provided by the LLM.
        
        Args:
            param_names: Set of parameter names to be injected
        """
        self._injectable_param_types = param_names
        
    def get_function(self, function_name: str) -> Optional[Callable]:
        """
        Get a registered function by name.
        
        Args:
            function_name: Name of the function to get
            
        Returns:
            The function if found, None otherwise
        """
        return self._functions.get(function_name)
    
    def list_functions(self) -> List[str]:
        """
        List all registered function names.
        
        Returns:
            List of function names
        """
        return list(self._functions.keys())
    
    def get_function_descriptions(self) -> Dict[str, str]:
        """
        Get descriptions for all registered functions.
        
        Returns:
            Dictionary mapping function names to their descriptions
        """
        return {
            func_name: self._functions[func_name].__doc__ or "No description available"
            for func_name in self._functions
        }
    
    def _extract_main_description(self, docstring: str) -> Optional[str]:
        """
        Extract only the main description from a function docstring,
        excluding parameter information.
        
        Args:
            docstring: The function docstring
            
        Returns:
            The main description or None if docstring is None
        """
        if not docstring:
            return None
            
        # Split by the first occurrence of "Args:" or "Returns:" or similar sections
        for section_marker in ["Args:", "Parameters:", "Returns:", "Raises:", "Yields:", "Examples:"]:
            if section_marker in docstring:
                main_desc = docstring.split(section_marker)[0].strip()
                return main_desc
                
        # If no section markers found, return the whole docstring
        return docstring.strip()
    
    def get_schema(self) -> Dict[str, Any]:
        """
        Get a schema description of this tool interface and its functions.
        Excludes injectable parameters from the schema.
        
        Returns:
            Dictionary with tool name, description, and functions
        """
        schema = {
            "name": self.name,
            "description": self.description,
            "functions": []
        }
        
        for func_name, func in self._functions.items():
            func_schema = {
                "name": func_name,
                "description": func.__doc__ or "No description available",
                "parameters": []
            }
            
            # Extract parameter information from the function signature
            sig = inspect.signature(func)
            for param_name, param in sig.parameters.items():
                # Skip injectable parameters - don't expose them to the LLM
                if param_name in self._injectable_param_types:
                    continue
                    
                param_info = {
                    "name": param_name,
                    "type": str(param.annotation).replace("<class '", "").replace("'>", ""),
                    "required": param.default == inspect.Parameter.empty,
                }
                
                # Try to extract description from docstring
                if func.__doc__ and f"{param_name}:" in func.__doc__:
                    param_desc = (
                        func.__doc__.split(f"{param_name}:")[1].split("\n")[0].strip()
                    )
                    param_info["description"] = param_desc
                
                func_schema["parameters"].append(param_info)
            
            schema["functions"].append(func_schema)
        
        return schema
        
    def get_injectable_params(self, function_name: str) -> List[str]:
        """
        Get the list of injectable parameter names for a specific function.
        
        Args:
            function_name: Name of the function
            
        Returns:
            List of parameter names that should be injected
        """
        func = self.get_function(function_name)
        if not func:
            return []
            
        sig = inspect.signature(func)
        return [
            param_name for param_name in sig.parameters
            if param_name in self._injectable_param_types
        ]


# Example usage:
"""
# Create a tool interface
pdf_tool = ToolInterface(
    name="pdf_tool",
    description="Tool for working with PDF documents"
)

# Register functions with the tool interface
@pdf_tool.register_function
def get_pdf_metadata(pdf_id: int) -> Dict[str, Any]:
    '''
    Get metadata for a PDF document
    
    Args:
        pdf_id: ID of the PDF document
        
    Returns:
        Dictionary with PDF metadata
    '''
    # Implementation here
    pass

@pdf_tool.register_function
def search_pdf_content(pdf_id: int, query: str, max_results: int = 10) -> List[Dict[str, Any]]:
    '''
    Search for content in a PDF document
    
    Args:
        pdf_id: ID of the PDF document
        query: Search query
        max_results: Maximum number of results to return
        
    Returns:
        List of matching content items
    '''
    # Implementation here
    pass

# Get the schema for the tool interface
schema = pdf_tool.get_schema()

# Call a function through the tool interface
metadata = pdf_tool.get_function("get_pdf_metadata")(pdf_id=123)
""" 