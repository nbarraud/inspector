# MCP Inspector CLI Mode PRD

## Overview

- Project Description: Add a command-line interface (CLI) mode to the MCP Inspector that allows users to make a single tool call and receive the results directly in the console, enabling integration with scripts, coding agents, and automation tools.

## User Requirements

- User Personas:
  - Automation Engineers who need to integrate MCP tool calls in scripts
  - Developer Tools teams who are building coding agents that need to interact with MCP servers
  - QA Engineers who need to test MCP servers from automated test suites

- User Stories:
  - As an automation engineer, I want to call MCP tools from scripts so that I can integrate MCP functionality into my automation processes.
  - As a developer tools engineer, I want to use MCP Inspector in CLI mode so that my coding agent can call tools and parse the results programmatically.
  - As a QA engineer, I want to test MCP server tools from the command line so that I can automate testing of MCP functionality.

## Technical Requirements

- Architecture:
  - Extend the existing MCP Inspector with a CLI mode that:
    - Reuses the existing server proxy component
    - Skips starting the web UI client
    - Makes a single tool call based on command-line arguments
    - Outputs the result to stdout in JSON format
    - Maintains compatibility with existing configuration options

- APIs:
  - Command-line interface: 
    ```
    npx @modelcontextprotocol/inspector --cli <tool_name> --tool-arg <name1>=<value1> --tool-arg <name2>=<value2> [other server connection options]
    ```
  - Server connection options remain the same as in interactive mode (either direct command/args or config/server)
  - Examples:
    
    1. Using direct command approach:
    ```
    # Basic tool call with a single argument
    npx @modelcontextprotocol/inspector --cli calculate_sum --tool-arg a=5 --tool-arg b=10 node my-mcp-server.js
    
    # With environment variables
    npx @modelcontextprotocol/inspector --cli fetch_data --tool-arg endpoint=/users -e API_KEY=secret node my-mcp-server.js
    
    # Using -- to separate inspector flags from server command with similar flag names
    npx @modelcontextprotocol/inspector --cli validate_input --tool-arg input=test -- node my-mcp-server.js --input verbose
    ```
    
    2. Using config-based approach:
    ```
    # Tool call with config file
    npx @modelcontextprotocol/inspector --cli generate_report --tool-arg format=pdf --config config.json --server dev
    
    # Complex tool arguments with config
    npx @modelcontextprotocol/inspector --cli transform_data --tool-arg schema='{"type":"object"}' --config config.json --server prod
    ```

- Data Models:
  - Reuse existing data models for tools and tool calls
  - Format tool call results as JSON for stdout

- Security:
  - Maintain the same security model as the interactive mode

## Design Requirements

- UI/UX Guidelines:
  - CLI output should be clean and well-formatted JSON
  - Error messages should be clear and actionable
  - Help text should be comprehensive but concise

## Plan

### Phase 1: Implementation

#### Step 1: Extend command-line argument parsing
- [ ] Add `--cli` flag detection in `bin/cli.js`
- [ ] Add `--tool-arg` parameter parsing for tool arguments
- [ ] Validate required arguments are present
- [ ] Handle potential conflicts with existing flags

#### Step 2: Create CLI mode execution path
- [ ] Modify server startup logic to detect CLI mode
- [ ] Skip starting the web UI client when in CLI mode
- [ ] Implement tool call execution logic directly in the server

#### Step 3: Implement result output
- [ ] Format tool call results as JSON
- [ ] Output results to stdout
- [ ] Handle errors and output to stderr

### Phase 2: Testing

#### Step 1: Manual testing
- [ ] Test with various tools and arguments
- [ ] Test with different server configuration options
- [ ] Test error handling scenarios
- [ ] Create a comprehensive shell script (`test-cli-mode.sh`) that automates testing of:
  - Different argument combinations (with/without environment variables)
  - Various tool types with different argument formats (strings, numbers, booleans, JSON)
  - Error cases (missing arguments, invalid tool names, etc.)
  - Both direct command and config-based approaches
  - Edge cases like escaping special characters in arguments
