# MCP Inspector CLI Client

The MCP Inspector CLI Client is a command-line interface for the Model Context Protocol (MCP) Inspector that allows you to make tool calls to MCP servers directly from the command line.

## Installation

```bash
npm install -g @modelcontextprotocol/inspector
```

## Usage

The CLI client can be used in two ways:

### Direct Command Approach

```bash
mcp-inspector-cli <tool_name> [options] <command> [args...]
```

Example:

```bash
# Basic tool call with a single argument
mcp-inspector-cli calculate_sum --tool-arg a=5 --tool-arg b=10 node my-mcp-server.js

# With environment variables
mcp-inspector-cli fetch_data --tool-arg endpoint=/users -e API_KEY=secret node my-mcp-server.js
```

### Config-Based Approach

```bash
mcp-inspector-cli <tool_name> --config <config_file> --server <server_name> [options]
```

Example:

```bash
# Tool call with config file
mcp-inspector-cli generate_report --tool-arg format=pdf --config config.json --server dev

# Complex tool arguments with config
mcp-inspector-cli transform_data --tool-arg schema='{"type":"object"}' --config config.json --server prod
```

## Options

- `--tool-arg <name>=<value>`: Specify a tool argument in the format `name=value`
- `-e <key>=<value>`: Specify an environment variable in the format `key=value`
- `--config <file>`: Specify a configuration file
- `--server <name>`: Specify a server name from the configuration file

## Configuration File

The configuration file should be a JSON file with the following structure:

```json
{
  "mcpServers": {
    "dev": {
      "command": "node",
      "args": ["my-mcp-server.js", "--dev"],
      "env": {
        "DEBUG": "true"
      }
    },
    "prod": {
      "command": "node",
      "args": ["my-mcp-server.js", "--prod"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Examples

### Basic Tool Call

```bash
mcp-inspector-cli calculate_sum --tool-arg a=5 --tool-arg b=10 node my-mcp-server.js
```

### Tool Call with Environment Variables

```bash
mcp-inspector-cli fetch_data --tool-arg endpoint=/users -e API_KEY=secret node my-mcp-server.js
```

### Tool Call with Config File

```bash
mcp-inspector-cli generate_report --tool-arg format=pdf --config config.json --server dev
```

### Complex Tool Arguments

```bash
mcp-inspector-cli transform_data --tool-arg schema='{"type":"object"}' --config config.json --server prod
``` 