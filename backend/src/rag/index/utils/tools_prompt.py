import os
import importlib
import inspect
from typing import Dict, Any


def get_available_tools():
    """
    Dynamically discover and load all available tools from the tools directory.

    Returns:
        List of tool instances
    """
    tools = []
    tools_dir = os.path.join(os.path.dirname(__file__), "tools")

    # Skip these files when looking for tools
    skip_files = ["__init__.py", "__pycache__", "tool.py", "index.py"]

    for filename in os.listdir(tools_dir):
        if filename.endswith(".py") and filename not in skip_files:
            module_name = filename[:-3]  # Remove .py extension
            try:
                # Import the module
                module_path = f"backend.rag.tools_use.tools.{module_name}"
                module = importlib.import_module(module_path)

                # Look for classes that end with 'Tool'
                for name, obj in inspect.getmembers(module):
                    if inspect.isclass(obj) and name.endswith("Tool"):
                        # Instantiate the tool
                        tool_instance = obj()
                        tools.append(tool_instance)
                        break
            except Exception as e:
                print(f"Error loading tool from {filename}: {e}")

    return tools


def generate_tool_description(tool) -> Dict[str, Any]:
    """
    Generate a description of a tool for the LLM prompt.

    Args:
        tool: Tool instance

    Returns:
        Dictionary with tool name, description, and parameters
    """
    tool_desc = {
        "name": tool.__class__.__name__,
        "description": tool.__doc__ or "No description available",
        "parameters": [],
    }

    # Get the public methods that aren't dunder methods
    methods = [
        m for m in dir(tool) if not m.startswith("_") and callable(getattr(tool, m))
    ]

    for method_name in methods:
        method = getattr(tool, method_name)
        if method.__doc__:
            # Extract parameter information from the method signature
            sig = inspect.signature(method)
            params = []

            for param_name, param in sig.parameters.items():
                if param_name == "self":
                    continue

                param_info = {
                    "name": param_name,
                    "type": str(param.annotation)
                    .replace("<class '", "")
                    .replace("'>", ""),
                    "required": param.default == inspect.Parameter.empty,
                }

                # Try to extract description from docstring
                if method.__doc__ and f"{param_name}:" in method.__doc__:
                    param_desc = (
                        method.__doc__.split(f"{param_name}:")[1].split("\n")[0].strip()
                    )
                    param_info["description"] = param_desc

                params.append(param_info)

            tool_desc["parameters"].extend(params)

    return tool_desc


def generate_prompt(system_message: str = None) -> str:
    """
    Generate a prompt for the LLM that includes information about available tools.

    Args:
        system_message: Optional system message to include in the prompt

    Returns:
        Formatted prompt string
    """
    tools = get_available_tools()
    tool_descriptions = [generate_tool_description(tool) for tool in tools]

    # Default system message if none provided
    if not system_message:
        system_message = """You are an AI assistant with access to a set of tools
        to help answer user questions. When a user asks a question, you should
        determine which tool(s) would be most helpful and use them.
        Format your response using the following syntax when you want to use a tool:
        <tool>
        name: [tool name]
        parameters:
        [parameter name]: [parameter value]
        [parameter name]: [parameter value]
        ...
        </tool>

        You can use multiple tools by including multiple tool blocks.
        After using tools, provide a helpful response based on the tool results."""

    # Format the tool descriptions for the prompt
    tools_section = "Available tools:\n\n"

    for tool in tool_descriptions:
        tools_section += f"Tool: {tool['name']}\n"
        tools_section += f"Description: {tool['description']}\n"

        if tool["parameters"]:
            tools_section += "Parameters:\n"
            for param in tool["parameters"]:
                required = " (required)" if param.get("required", False) else ""
                tools_section += (
                    f"  - {param['name']}: "
                    f"{param.get('description', 'No description')} "
                    f"Type: {param.get('type', 'any')}{required}\n"
                )

        tools_section += "\n"

    # Combine everything into the final prompt
    final_prompt = f"{system_message}\n\n{tools_section}"
    return final_prompt
