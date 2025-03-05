## Implementation Steps for the CLI Client

### Step 1: Understand the Architecture Components

1. **Proxy Server (`server/src/`)**: 
   - Serves as a middleware between clients and the MCP server
   - Handles connections through SSE (Server-Sent Events) and stdio transports
   - Offers endpoints for configuration, messages, and events
   - Implements bidirectional communication using the MCP protocol

2. **Web Client (`client/src/`)**: 
   - Connects to the proxy server using the MCP SDK
   - Uses a React web interface to display tools, resources, and interact with the MCP server
   - Implements capabilities like sampling, completions, and OAuth flows
   - Handles notifications and errors

3. **Bootstrapping Client (`bin/old cli.js`)**: 
   - Parses command-line arguments
   - Spawns both the proxy server and web client
   - Sets up environment variables and ports
   - Provides a clean shutdown mechanism

### Step 2: Design the CLI Client Architecture

1. **Create a new CLI client module structure**:
   ```
   cli-client/
   ├── bin/
   │   └── cli.js           # Entry point executable
   ├── src/
   │   ├── index.ts         # Main application logic
   │   ├── commands/        # CLI command implementation
   │   ├── transport.ts     # MCP transport implementation
   │   └── utils/           # Helper utilities
   ├── package.json
   └── tsconfig.json
   ```

2. **Define the CLI interface requirements**:
   - Single command execution model (non-interactive)
   - Command-line arguments parser
   - JSON output to stdout
   - Error handling and logging
   - Process exits after command completion

### Step 3: Implement Core Functionality

1. **Setup MCP Client Connection**:
   - Implement connection to the proxy server using the MCP SDK
   - Support the same transport types as the web client (SSE, stdio)
   - Handle authentication (OAuth flow if needed)
   - Implement error handling for the single command execution

2. **Implement Command Execution**:
   - Create a command parser using a library like commander or yargs
   - Implement a single execution flow (connect, run command, output result, exit)
   - Parse command arguments from the command line
   - Generate JSON output to stdout
   - Return appropriate exit codes

3. **Implement Transport Layer**:
   - Use the MCP SDK client transport classes
   - Implement proper error handling and timeout mechanisms
   - Support proxy server connection parameters
   - Ensure clean disconnection after command completion

### Step 4: Implement Key MCP Protocol Features

1. **Command Implementation**:
   - Implement all necessary commands as subcommands:
     - `list-tools`: List available tools from the MCP server
     - `call-tool`: Call a specific tool with parameters
     - `list-resources`: Get available resources
     - `read-resource`: Read a specific resource
     - `list-prompts`: Get available prompts
     - `get-prompt`: Get a specific prompt
   - Each command will be executed in isolation and then exit

2. **Output Formatting**:
   - Implement JSON output format to stdout
   - Handle errors as structured JSON with appropriate error codes
   - Format command results consistently for machine parsing

### Step 5: Update Bootstrapping Client

1. **Modify the bootstrapping client** to spawn the new CLI client instead of the web client:
   - Update the path resolution for the CLI client
   - Pass appropriate environment variables and arguments
   - Maintain the same error handling and shutdown logic

2. **Add compatibility handling**:
   - Ensure backward compatibility with existing command-line arguments
   - Handle environment variables consistently

## Technical Details to Consider

1. **Transport Layer**:
   - The CLI should use the same transport mechanisms (SSE, stdio) as the web client
   - It should handle connection errors appropriately
   - Authentication flows need to be adapted for single command execution

2. **State Management**:
   - No persistent state between command executions
   - Each command is an isolated execution

3. **Error Handling**:
   - Implement consistent error handling and reporting in JSON format
   - Use appropriate exit codes for different error conditions

This implementation plan provides a comprehensive approach to replacing the web client with a non-interactive CLI client that executes a single command, outputs JSON to stdout, and then exits.
