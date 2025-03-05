#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import path from "node:path";
import { parse as shellParseArgs } from "shell-quote";
import { findActualExecutable } from "spawn-rx";

const defaultEnvironment = {
    ...getDefaultEnvironment(),
    ...(process.env.MCP_ENV_VARS ? JSON.parse(process.env.MCP_ENV_VARS) : {})
};

/**
 * Executes a tool call using the MCP protocol in CLI mode.
 *
 * @param toolName - The name of the tool to call
 * @param toolArgs - The arguments to pass to the tool
 * @param envCommand - The command to run the MCP server
 * @param envArgs - The arguments to pass to the MCP server command
 * @param envVars - Environment variables to pass to the MCP server
 * @returns The result of the tool call
 */
async function executeCliToolCall(
    toolName: string,
    toolArgs: Record<string, any>,
    envCommand: string | null,
    envArgs: string,
    envVars: Record<string, string>
)
{
    console.log(`Executing tool call: ${toolName}`);
    console.log(`Tool arguments: ${JSON.stringify(toolArgs, null, 2)}`);

    let transport: StdioClientTransport | null = null;
    let client: Client | null = null;

    try
    {
        // Create a transport to the MCP server
        if (envCommand)
        {
            const command = envCommand;
            const origArgs = shellParseArgs(envArgs) as string[];
            const env = { ...process.env, ...defaultEnvironment, ...envVars };

            const { cmd, args } = findActualExecutable(command, origArgs);

            console.log(`Stdio transport: command=${cmd}, args=${args.join(" ")}`);

            transport = new StdioClientTransport({
                command: cmd,
                args,
                env,
                stderr: "pipe"
            });

            // Create an MCP client
            client = new Client(
                {
                    name: "mcp-inspector-cli",
                    version: "1.0.0"
                },
                {
                    capabilities: {
                        tools: {}
                    }
                }
            );

            // Connect the client to the transport
            // Note: client.connect() will call transport.start() internally
            await client.connect(transport);
            console.log("Connected to MCP server via stdio transport");
        }
        else
        {
            console.error("No MCP server command specified");
            process.exit(1);
        }

        // Call the tool using the client
        console.log(`Calling tool: ${toolName}`);
        const result = await client.callTool({
            name: toolName,
            arguments: toolArgs
        });

        // Output the result as JSON
        console.log("Tool call result:");
        console.log(JSON.stringify(result, null, 2));

        // Close the transport
        await transport.close();

        return result;
    }
    catch (error)
    {
        console.error("Error executing tool call:", error);

        // Ensure transport is closed even if there's an error
        if (transport)
        {
            try
            {
                await transport.close();
            }
            catch (closeError)
            {
                console.error("Error closing transport:", closeError);
            }
        }

        throw error;
    }
}

/**
 * Get configuration from environment variables
 * This function extracts all the parsed arguments from environment variables
 * set by the parent process (bin/cli.js)
 */
function getConfigFromEnvironment() {
    // Get tool name
    const toolName = process.env.MCP_TOOL_NAME;
    if (!toolName) {
        console.error("Error: MCP_TOOL_NAME environment variable is required");
        process.exit(1);
    }
    
    // Get tool arguments
    const toolArgs = process.env.MCP_TOOL_ARGS 
        ? JSON.parse(process.env.MCP_TOOL_ARGS) 
        : {};
    
    // Get command and arguments
    const command = process.env.MCP_COMMAND || null;
    const commandArgs = process.env.MCP_COMMAND_ARGS || "";
    
    // Get environment variables
    const envVars = process.env.MCP_ENV_VARS 
        ? JSON.parse(process.env.MCP_ENV_VARS) 
        : {};
    
    // Get config path and server name if provided
    const configPath = process.env.MCP_CONFIG_PATH || null;
    const serverName = process.env.MCP_SERVER_NAME || null;
    
    // If config path and server name are provided, load the config file
    if (configPath && serverName) {
        console.log(`Using server configuration '${serverName}' from ${configPath}`);
    }
    
    return {
        toolName,
        toolArgs,
        command,
        commandArgs,
        envVars
    };
}

async function main()
{
    try
    {
        // Get configuration from environment variables
        const { toolName, toolArgs, command, commandArgs, envVars } = getConfigFromEnvironment();
        
        // Execute the tool call
        await executeCliToolCall(toolName, toolArgs, command, commandArgs, envVars);
        process.exit(0);
    }
    catch (error)
    {
        console.error("Failed to execute tool call:", error);
        process.exit(1);
    }
}

main().catch((error) =>
{
    console.error("Unhandled error:", error);
    process.exit(1);
});
