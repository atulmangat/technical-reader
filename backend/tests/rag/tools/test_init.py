import unittest
import json
import sys

# Import the actual modules
from src.rag.tools import (
    get_all_tool_interfaces,
    get_tool_interface,
    get_all_schemas,
    get_function_descriptions,
    TOOL_INTERFACES
)


class TestToolsInit(unittest.TestCase):
    """Test the functions in the tools/__init__.py file."""

    def test_get_all_tool_interfaces(self):
        """Print the output of get_all_tool_interfaces."""
        # Call the function
        result = get_all_tool_interfaces()
        
        # Print the result
        print("\n=== get_all_tool_interfaces() ===")
        for name, tool in result.items():
            print(f"Tool: {name}")
            print(f"  Description: {tool.description}")
            print(f"  Functions: {list(tool._functions.keys())}")
            print()

    def test_get_tool_interface(self):
        """Print the output of get_tool_interface for each tool."""
        print("\n=== get_tool_interface() ===")
        
        # Test with each tool name
        for tool_name in TOOL_INTERFACES:
            result = get_tool_interface(tool_name)
            print(f"Tool: {tool_name}")
            print(f"  Description: {result.description}")
            print(f"  Functions: {list(result._functions.keys())}")
            print()
        
        # Test with an invalid tool name
        result = get_tool_interface("non_existent_tool")
        print(f"Non-existent tool: {result}")

    def test_get_function_descriptions(self):
        """Print the output of get_function_descriptions."""
        # Call the function for all tools
        all_descriptions = get_function_descriptions()
        
        # Print the result
        print("\n=== get_function_descriptions() ===")
        for tool_name, func_descriptions in all_descriptions.items():
            print(f"Tool: {tool_name}")
            for func_name, description in func_descriptions.items():
                print(f"  Function: {func_name}")
                print(f"    Description: {description}")
            print()
        
        # Test with a specific tool
        tool_name = next(iter(TOOL_INTERFACES.keys()))
        tool_descriptions = get_function_descriptions(tool_name)
        print(f"\n=== get_function_descriptions('{tool_name}') ===")
        for func_name, description in tool_descriptions.items():
            print(f"  Function: {func_name}")
            print(f"    Description: {description}")
        
        # Test with an invalid tool name
        invalid_descriptions = get_function_descriptions("non_existent_tool")
        print(f"\n=== get_function_descriptions('non_existent_tool') ===")
        print(f"  Result: {invalid_descriptions}")

    def test_get_all_schemas(self):
        """Print the output of get_all_schemas."""
        # Call the function
        result = get_all_schemas()
        
        # Print the result
        print("\n=== get_all_schemas() ===")
        for i, schema in enumerate(result):
            print(f"Schema {i+1}:")
            # Pretty print the schema with indentation
            print(json.dumps(schema, indent=2))
            print()


if __name__ == "__main__":
    # Run just this test file
    unittest.main(verbosity=2) 