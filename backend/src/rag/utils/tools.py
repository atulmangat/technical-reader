"""
Utility functions for working with tools in the RAG system.
"""
from typing import Dict, List, Any, AsyncGenerator, Optional, Tuple
import json
import logging
from ..tools import get_function_descriptions, get_all_tool_interfaces

from ..llms.prompts import (
    TOOLS_SYSTEM_PROMPT,
    INITIAL_TOOLS_USE_TEMPLATE,
    INITIAL_NO_TOOLS_USE_PROMPT,
    TOOL_RESULTS_TEMPLATE,
    TOOL_RESULT_TEMPLATE,
    format_prompt_template,
)
from ..llms.client import stream_llm, call_llm
from ...models.pdf import PDF

logger = logging.getLogger(__name__)

# Global dependency instances
_db_instance = None
_vector_db_instance = None


def set_db_instance(db):
    """
    Set the global database instance for tool execution.
    
    Args:
        db: Database instance
    """
    global _db_instance
    _db_instance = db
    
def set_vector_db_instance(vector_db):
    """
    Set the global vector database instance for tool execution.
    
    Args:
        vector_db: Vector database instance
    """
    global _vector_db_instance
    _vector_db_instance = vector_db

def generate_tools_prompt() -> str:
    """
    Generate a prompt that describes all available tools and their functions.
    
    Returns:
        A formatted string describing all tools and their functions
    """
    # Get all tool descriptions
    all_tool_descriptions = get_function_descriptions()
    
    # Format the tools prompt
    tools_prompt = "Available tools:\n\n"
    
    for tool_name, functions in all_tool_descriptions.items():
        # Get the tool interface to access its description
        tool_interface = get_all_tool_interfaces().get(tool_name)
        if not tool_interface:
            continue
            
        tools_prompt += f"Tool: {tool_name}\n"
        tools_prompt += f"Description: {tool_interface.description}\n"
        tools_prompt += "Functions:\n"
        
        for func_name, description in functions.items():
            tools_prompt += f"  - {func_name}: {description}\n"
        
        tools_prompt += "\n"
    
    return tools_prompt

def generate_tools_use_prompt(context: str = "", query: str = "", table_of_contents: str = "") -> str:
    """
    Generate a complete prompt for the LLM with tools information.
    
    Args:
        context: Optional context to include in the prompt
        query: The user's query
        table_of_contents: Optional table of contents to include

    Returns:
        A formatted prompt string
    """
    
    tools_prompt = TOOLS_SYSTEM_PROMPT + "\n\n" + generate_tools_prompt()
        
    # Format the complete prompt using the new format_prompt_template function
    prompt = format_prompt_template(
        INITIAL_TOOLS_USE_TEMPLATE,
        tools_prompt=tools_prompt,
        context=context,
        query=query,
        table_of_contents=table_of_contents
    )
    
    return prompt


def generate_no_tools_prompt(user_query: str, context: str = "", conversation_history: List[Dict[str, str]] = [], detailed_response: bool = False) -> str:
    """
    Generate a prompt for the LLM without tools.
    
    Args:
        user_query: The user's query
        context: Optional context to include
        conversation_history: List of previous conversation turns
        detailed_response: Flag indicating whether to generate a detailed response
        
    Returns:
        A formatted prompt string
    """
    
    # Add detailed response instruction if requested
    additional_instructions = ""
    if detailed_response:
        additional_instructions = "Provide a detailed and comprehensive response. Include in-depth explanations, examples, and context where appropriate."
    else:
        additional_instructions = "Provide a concise and to-the-point response. Focus on clarity and brevity while still answering the question completely."
    
    # Format using the new format_prompt_template function
    return format_prompt_template(
        INITIAL_NO_TOOLS_USE_PROMPT,
        context=context,
        query=user_query,
        conversation_history=conversation_history,
        additional_instructions=additional_instructions
    )
    
def generate_tool_results_prompt(user_query: str, context: str = "", tool_results: List[Dict[str, Any]] = [], conversation_history: List[Dict[str, str]] = [], table_of_contents: str = "", detailed_response: bool = False) -> str:
    """
    Generate a prompt for the second LLM call with tool results and conversation history.
    
    Args:
        user_query: The user's query
        context: Optional context to include
        tool_results: Results from tool executions
        conversation_history: List of previous conversation turns
        table_of_contents: Optional table of contents to include
        detailed_response: Flag indicating whether to generate a detailed response
        
    Returns:
        A formatted prompt string
    """
    # Format tool results
    formatted_results = ""
    for result in tool_results:
        formatted_result = TOOL_RESULT_TEMPLATE.format(
            tool_name=result.get("tool", ""),
            parameters=json.dumps(result.get("parameters", {}), indent=2),
            success=result.get("success", False),
            result=result.get("result", "")
        )
        formatted_results += formatted_result
    
    # Add detailed response instruction if requested
    additional_instructions = ""
    if detailed_response:
        additional_instructions = "Provide a detailed and comprehensive response. Include in-depth explanations, examples, and context where appropriate."
    else:
        additional_instructions = "Provide a concise and to-the-point response. Focus on clarity and brevity while still answering the question completely."
    
    # Format the complete prompt using the new format_prompt_template function
    return format_prompt_template(
        TOOL_RESULTS_TEMPLATE,
        context=context,
        user_query=user_query,
        tool_results=formatted_results,
        conversation_history=conversation_history,
        table_of_contents=table_of_contents,
        additional_instructions=additional_instructions
    )

def parse_tool_calls(llm_response: str) -> List[Dict[str, Any]]:
    """
    Parse tool calls from an LLM response.
    
    Args:
        llm_response: The LLM's response text
        
    Returns:
        A list of parsed tool calls
    """
    tool_calls = []
    
    # First, log the response for debugging
    logger.debug(f"Parsing tool calls from response: {llm_response}")
    
    # Try to parse the response as JSON first (for the new format)
    try:
        # Check if the response contains a JSON object
        json_start = llm_response.find('{')
        json_end = llm_response.rfind('}')
        
        
        if json_start >= 0 and json_end > json_start:
            json_str = llm_response[json_start:json_end+1]
            response_json = json.loads(json_str)
            print(f"Response JSON: {response_json}")
            # Check if the response contains tool_calls
            if 'tool_calls' in response_json and isinstance(response_json['tool_calls'], list):
                for tool_call in response_json['tool_calls']:
                    # Handle the new format with capitalized keys
                    if 'tool' in tool_call and 'function' in tool_call and 'parameters' in tool_call:
                        tool_calls.append({
                            "tool": tool_call['tool'],
                            "function": tool_call['function'],
                            "parameters": tool_call['parameters']
                        })
                
                # If we successfully parsed tool calls in the new format, return them
                if tool_calls:
                    logger.info(f"Found {len(tool_calls)} tool calls in JSON format")
                    return tool_calls
    except (json.JSONDecodeError, ValueError) as e:
        logger.debug(f"Failed to parse response as JSON: {str(e)}. Falling back to text parsing.")
        return tool_calls
 

def execute_tool_call(tool_call: Dict[str, Any], pdf_id: int, db: Optional[Any] = None, vector_db: Optional[Any] = None) -> Dict[str, Any]:
    """
    Execute a single tool call with dependency injection.
    
    Args:
        tool_call: Dictionary containing tool, function, and parameters
        db: Optional database instance to inject
        vector_db: Optional vector database instance to inject
        
    Returns:
        Dictionary with execution results
    """
    tool_name = tool_call.get("tool")
    function_name = tool_call.get("function")
    parameters = tool_call.get("parameters", {})
    print(f"Executing tool call: {tool_name}.{function_name} with parameters: {parameters}")
    result = {
        "tool_name": tool_name,
        "function": function_name,
        "parameters": parameters,
        "success": False,
        "result": "Tool execution failed"
    }
    
    try:
        # Get the tool interface
        tools = get_all_tool_interfaces()
        tool = tools.get(tool_name)
        
        if not tool:
            result["result"] = f"Tool '{tool_name}' not found"
            return result
        
        # Get the function
        func = tool.get_function(function_name)
        if not func:
            result["result"] = f"Function '{function_name}' not found in tool '{tool_name}'"
            return result
        
        # Get injectable parameters for this function
        injectable_params = tool.get_injectable_params(function_name)
        
        # Prepare the parameters with injected dependencies
        execution_params = parameters.copy()
        
        # Inject database dependencies
        if "db" in injectable_params:
            execution_params["db"] = db or _db_instance
            
        if "vector_db" in injectable_params:
            execution_params["vector_db"] = vector_db or _vector_db_instance
            
        # Inject pdf_id parameter
        if "pdf_id" in injectable_params:
            execution_params["pdf_id"] = pdf_id
        
        print(f"Execution parameters: {execution_params}")
        # Execute the function with parameters
        func_result = func(**execution_params)
        print(f"Function result: {func_result}")
        # Update result
        result["success"] = True
        result["result"] = str(func_result)
        
    except Exception as e:
        result["result"] = f"Error executing tool: {str(e)}"
        logger.exception(f"Error executing tool {tool_name}.{function_name}: {e}")
    
    return result


async def run_with_tools(
    pdf_id: int,
    user_query: str, 
    context: str = "", 
    db: Optional[Any] = None, 
    vector_db: Optional[Any] = None,
    conversation_history: List[Dict[str, str]] = [],
    detailed_response: bool = False
) -> AsyncGenerator[str, None]:
    """
    Run a complete RAG workflow with tools.
    
    Args:
        user_query: The user's query
        context: Optional context to include
        max_tokens: Maximum tokens for the LLM response
        temperature: Temperature for the LLM
        db: Optional database instance to inject
        vector_db: Optional vector database instance to inject
        conversation_history: Optional list of previous conversation turns
        detailed_response: Flag indicating whether to generate a detailed response
    Returns:
        AsyncGenerator yielding response chunks as strings
    """
    
    
    # Check if the PDF has embeddings
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    
    if pdf and not pdf.has_embeddings:
        # Stream back a message that the embeddings are not completed
        yield f"data: {json.dumps({'response': 'We are still processing the PDF. So smart Qna mode is not available. Please try again later in a minute.'})}\n\n"
        return
    
    table_of_contents = pdf.table_of_contents if pdf.table_of_contents else "unknown"
    
    # Generate the initial prompt with conversation history
    initial_prompt = generate_tools_use_prompt(context, user_query, table_of_contents)
    
    # Log the initial prompt for debugging
    logger.debug(f"Initial prompt:\n{initial_prompt}")
    
    # Call the LLM with the initial prompt
    initial_response = call_llm(
        prompt=initial_prompt
    )
    
    # Log the raw LLM response for debugging
    logger.debug(f"Raw LLM response:\n{initial_response}")
    
    # Parse tool calls and execute them
    tool_calls = parse_tool_calls(initial_response)
    # Execute tool calls
    tool_results = []
    if tool_calls:
        for tool_call in tool_calls:
            result = execute_tool_call(tool_call, pdf_id=pdf_id, db=db, vector_db=vector_db)
            tool_results.append(result)
        
    # Generate the second prompt with tool results and conversation history
    second_prompt = generate_tool_results_prompt(
        user_query=user_query,
        context=context,
        tool_results=tool_results,
        conversation_history=conversation_history,
        table_of_contents=table_of_contents,
        detailed_response=detailed_response
    )
    # Stream the response
    async for chunk in stream_llm(prompt=second_prompt, llm_type="mistral"):
        yield chunk


