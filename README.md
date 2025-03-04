# MCP Inspector

The MCP inspector is a developer tool for testing and debugging MCP servers.

![MCP Inspector Screenshot](mcp-inspector.png)

## Running the Inspector

### From an MCP server repository

To inspect an MCP server implementation, there's no need to clone this repo. Instead, use `npx`. For example, if your server is built at `build/index.js`:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

You can pass both arguments and environment variables to your MCP server. Arguments are passed directly to your server, while environment variables can be set using the `-e` flag:

```bash
# Pass arguments only
npx @modelcontextprotocol/inspector build/index.js arg1 arg2

# Pass environment variables only
npx @modelcontextprotocol/inspector -e KEY1=VALUE1 -e KEY2=VALUE2 node build/index.js

# Pass both environment variables and arguments
npx @modelcontextprotocol/inspector -e KEY1=VALUE1 -e KEY2=VALUE2 node build/index.js arg1 arg2

# Use -- to separate inspector flags from server arguments
npx @modelcontextprotocol/inspector -e KEY=VALUE -- node build/index.js -e server-flag
```

### Using a Configuration File

You can also use a JSON configuration file to store multiple server configurations and easily switch between them:

```bash
# Use a specific server configuration from a config file
npx @modelcontextprotocol/inspector --config path/to/config.json --server serverName
```

When using the configuration file approach, you must provide both the `--config` and `--server` flags, and no other arguments are allowed.

The configuration file should follow this format:

```json
{
  "mcpServers": {
    "serverName1": {
      "command": "node",
      "args": ["path/to/server.js", "arg1", "arg2"],
      "env": {
        "PORT": "8080",
        "DEBUG": "true"
      }
    },
    "serverName2": {
      "command": "python",
      "args": ["-m", "mcp_server"],
      "env": {
        "MCP_PORT": "9000"
      }
    }
  }
}
```

An example config file is provided in `config-example.json`.

### Port Configuration

The inspector runs both a client UI (default port 5173) and an MCP proxy server (default port 3000). Open the client UI in your browser to use the inspector. You can customize the ports if needed:

```bash
CLIENT_PORT=8080 SERVER_PORT=9000 npx @modelcontextprotocol/inspector node build/index.js
```

For more details on ways to use the inspector, see the [Inspector section of the MCP docs site](https://modelcontextprotocol.io/docs/tools/inspector). For help with debugging, see the [Debugging guide](https://modelcontextprotocol.io/docs/tools/debugging).

### From this repository

If you're working on the inspector itself:

Development mode:

```bash
npm run dev
```

> **Note for Windows users:**  
> On Windows, use the following command instead:
>
> ```bash
> npm run dev:windows
> ```

Production mode:

```bash
npm run build
npm start
```

## License

This project is licensed under the MIT License—see the [LICENSE](LICENSE) file for details.
