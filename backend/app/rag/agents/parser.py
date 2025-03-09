import re
from typing import List, Dict, Any, Tuple
import json
import logging
from .prompt import get_available_tools

logger = logging.getLogger(__name__)


class ToolParser:
    """
    Parser for LLM responses that contain tool calls.
    Extracts tool calls, executes them, and returns the results.
    """

    def __init__(self):
        self.tools = {tool.__class__.__name__: tool for tool in get_available_tools()}
        logger.info(f"Initialized ToolParser with tools: {list(self.tools.keys())}")

    def extract_tool_calls(self, llm_response: str) -> List[Dict[str, Any]]:
        """
        Extract tool calls from an LLM response.

        Args:
            llm_response: The response from the LLM

        Returns:
            List of dictionaries with tool name and parameters
        """
        # Regular expression to match tool blocks
        tool_pattern = r"<tool>(.*?)</tool>"
        tool_blocks = re.findall(tool_pattern, llm_response, re.DOTALL)

        tool_calls = []
        for block in tool_blocks:
            # Extract tool name
            name_match = re.search(r"name:\s*(.*?)(?:\n|$)", block)
            if not name_match:
                logger.warning(f"Could not find tool name in block: {block}")
                continue

            tool_name = name_match.group(1).strip()

            # Extract parameters
            params_section = re.search(r"parameters:(.*?)(?=\n\n|$)", block, re.DOTALL)
            params = {}

            if params_section:
                param_lines = params_section.group(1).strip().split("\n")
                for line in param_lines:
                    # Skip empty lines
                    if not line.strip():
                        continue

                    # Match parameter name and value
                    param_match = re.match(r"\s*([^:]+):\s*(.*)", line)
                    if param_match:
                        param_name = param_match.group(1).strip()
                        param_value = param_match.group(2).strip()

                        # Try to parse as JSON if it looks like a list or dict
                        if (
                            param_value.startswith("[") and param_value.endswith("]")
                        ) or (
                            param_value.startswith("{") and param_value.endswith("}")
                        ):
                            try:
                                param_value = json.loads(param_value)
                            except json.JSONDecodeError:
                                # Keep as string if JSON parsing fails
                                pass

                        params[param_name] = param_value

            tool_calls.append({"name": tool_name, "parameters": params})

        return tool_calls

    def execute_tool(
        self, tool_name: str, parameters: Dict[str, Any]
    ) -> Tuple[bool, Any]:
        """
        Execute a tool with the given parameters.

        Args:
            tool_name: Name of the tool to execute
            parameters: Parameters to pass to the tool

        Returns:
            Tuple of (success, result)
        """
        if tool_name not in self.tools:
            logger.warning(f"Tool {tool_name} not found")
            return False, f"Error: Tool '{tool_name}' not found"

        tool = self.tools[tool_name]

        # Find the appropriate method to call
        # By default, we'll look for an 'execute' method or a method with the same name as the tool
        method_name = "execute"
        if not hasattr(tool, method_name):
            # Try to find a method that matches the tool name (without 'Tool' suffix)
            base_name = tool_name.replace("Tool", "").lower()
            for m in dir(tool):
                if m.lower() == base_name and callable(getattr(tool, m)):
                    method_name = m
                    break

        if not hasattr(tool, method_name):
            # Look for any public method that isn't a dunder method
            methods = [
                m
                for m in dir(tool)
                if not m.startswith("_") and callable(getattr(tool, m))
            ]
            if methods:
                method_name = methods[0]  # Use the first available method

        if not hasattr(tool, method_name) or not callable(getattr(tool, method_name)):
            logger.warning(f"No executable method found for tool {tool_name}")
            return False, f"Error: No executable method found for tool '{tool_name}'"

        try:
            method = getattr(tool, method_name)
            result = method(**parameters)
            return True, result
        except Exception as e:
            logger.exception(f"Error executing tool {tool_name}: {e}")
            return False, f"Error executing tool '{tool_name}': {str(e)}"

    def process_llm_response(self, llm_response: str) -> Dict[str, Any]:
        """
        Process an LLM response, execute any tool calls, and return the results.

        Args:
            llm_response: The response from the LLM

        Returns:
            Dictionary with processed response and tool results
        """
        tool_calls = self.extract_tool_calls(llm_response)

        # Extract the text before, between, and after tool calls
        text_parts = re.split(r"<tool>.*?</tool>", llm_response, flags=re.DOTALL)

        tool_results = []
        for tool_call in tool_calls:
            success, result = self.execute_tool(
                tool_call["name"], tool_call["parameters"]
            )
            tool_results.append(
                {
                    "name": tool_call["name"],
                    "parameters": tool_call["parameters"],
                    "success": success,
                    "result": result,
                }
            )

        return {
            "original_response": llm_response,
            "text_parts": [part.strip() for part in text_parts if part.strip()],
            "tool_calls": tool_calls,
            "tool_results": tool_results,
        }

    def format_response_with_results(self, processed_response: Dict[str, Any]) -> str:
        """
        Format the processed response with tool results for display to the user.

        Args:
            processed_response: The processed response from process_llm_response

        Returns:
            Formatted response string
        """
        text_parts = processed_response["text_parts"]
        tool_results = processed_response["tool_results"]

        # Start with the first text part
        formatted_response = text_parts[0] if text_parts else ""

        # Add each tool result followed by the next text part
        for i, result in enumerate(tool_results):
            formatted_response += f"\n\n[Tool: {result['name']}]\n"

            if result["success"]:
                # Format the result based on its type
                if isinstance(result["result"], dict):
                    formatted_response += json.dumps(result["result"], indent=2)
                elif isinstance(result["result"], list):
                    if all(isinstance(item, dict) for item in result["result"]):
                        formatted_response += json.dumps(result["result"], indent=2)
                    else:
                        formatted_response += "\n".join(
                            [f"- {item}" for item in result["result"]]
                        )
                else:
                    formatted_response += str(result["result"])
            else:
                formatted_response += f"Error: {result['result']}"

            # Add the next text part if available
            if i + 1 < len(text_parts):
                formatted_response += f"\n\n{text_parts[i + 1]}"

        return formatted_response


def parse_and_execute(llm_response: str) -> str:
    """
    Parse an LLM response, execute any tool calls, and return a formatted response.

    Args:
        llm_response: The response from the LLM

    Returns:
        Formatted response string with tool results
    """
    parser = ToolParser()
    processed_response = parser.process_llm_response(llm_response)
    return parser.format_response_with_results(processed_response)
