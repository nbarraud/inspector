#!/usr/bin/env node

import { resolve, dirname } from "path";
import { spawnPromise } from "spawn-rx";
import { fileURLToPath } from "url";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "child_process";
import { Command } from "commander";

const __dirname = dirname(fileURLToPath(import.meta.url));

function delay(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run the interactive web client
 */
async function runWebClient(command, mcpServerArgs, envVars)
{
    const inspectorServerPath = resolve(__dirname, "..", "server", "build", "index.js");
    const inspectorClientPath = resolve(__dirname, "..", "client", "bin", "cli.js");

    const CLIENT_PORT = process.env.CLIENT_PORT ?? "5173";
    const SERVER_PORT = process.env.SERVER_PORT ?? "3000";

    console.log("Starting MCP inspector...");

    const abort = new AbortController();

    let cancelled = false;
    process.on("SIGINT", () =>
    {
        cancelled = true;
        abort.abort();
    });

    const serverArgs = [
        inspectorServerPath,
        ...(command ? [`--env`, command] : []),
        ...(mcpServerArgs.length > 0 ? [`--args=${mcpServerArgs.join(" ")}`] : []),
    ];

    const server = spawnPromise("node", serverArgs, {
        env: {
            ...process.env,
            PORT: SERVER_PORT,
            MCP_ENV_VARS: JSON.stringify(envVars),
        },
        signal: abort.signal,
        echoOutput: true,
    });

    // Start the web client
    const client = spawnPromise("node", [inspectorClientPath], {
        env: { ...process.env, PORT: CLIENT_PORT },
        signal: abort.signal,
        echoOutput: true,
    });

    // Make sure our server/client didn't immediately fail
    await Promise.any([server, client, delay(2 * 1000)]);
    const portParam = SERVER_PORT === "3000" ? "" : `?proxyPort=${SERVER_PORT}`;
    console.log(`\n🔍 MCP Inspector is up and running at http://localhost:${CLIENT_PORT}${portParam} 🚀`);

    try
    {
        // In interactive mode, wait for either the server or client to exit
        await Promise.any([server, client]);
    } catch (e)
    {
        if (!cancelled || process.env.DEBUG) throw e;
    }
}

/**
 * Run the CLI client with the given arguments
 */
function runCliClient(cliToolName, cliToolArgs, command, mcpServerArgs, envVars, configPath, serverName)
{
    if (!cliToolName)
    {
        console.error("Error: --tool-name is required in CLI mode");
        console.error("Usage: mcp-inspector --cli --tool-name <tool_name> [options]");
        process.exit(1);
    }

    console.log(`Running in CLI mode with tool: ${cliToolName}`);
    console.log(`Tool arguments: ${JSON.stringify(cliToolArgs, null, 2)}`);

    // When in CLI mode, use the CLI client directly
    const cliClientPath = resolve(__dirname, "..", "cli", "bin", "cli.js");

    // Instead of passing arguments via command line, pass them via environment variables
    const cliEnv = {
        ...process.env,
        MCP_TOOL_NAME: cliToolName,
        MCP_TOOL_ARGS: JSON.stringify(cliToolArgs),
        MCP_COMMAND: command || "",
        MCP_COMMAND_ARGS: mcpServerArgs.join(" "),
        MCP_ENV_VARS: JSON.stringify(envVars),
    };

    // Add config and server if provided
    if (configPath && serverName)
    {
        cliEnv.MCP_CONFIG_PATH = configPath;
        cliEnv.MCP_SERVER_NAME = serverName;
    }

    // Execute the CLI client with no arguments, all data is passed via environment
    const cliProcess = spawn("node", [cliClientPath], {
        stdio: "inherit",
        env: cliEnv,
    });

    // Handle CLI client process exit
    cliProcess.on("exit", code =>
    {
        process.exit(code || 0);
    });

    // Handle CLI client process error
    cliProcess.on("error", err =>
    {
        console.error("Failed to start CLI client:", err);
        process.exit(1);
    });
}

/**
 * Load and parse a config file
 */
function loadConfigFile(configPath, serverName)
{
    try
    {
        const resolvedConfigPath = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);

        if (!fs.existsSync(resolvedConfigPath))
        {
            console.error(`Error: Config file not found: ${resolvedConfigPath}`);
            process.exit(1);
        }

        const configContent = fs.readFileSync(resolvedConfigPath, "utf8");
        const parsedConfig = JSON.parse(configContent);

        if (!parsedConfig.mcpServers || !parsedConfig.mcpServers[serverName])
        {
            console.error(`Error: Server '${serverName}' not found in config file`);
            console.error(`Available servers: ${Object.keys(parsedConfig.mcpServers || {}).join(", ")}`);

            process.exit(1);
        }

        const serverConfig = parsedConfig.mcpServers[serverName];

        console.log(`Using server configuration '${serverName}' from ${configPath}`);

        return serverConfig;
    } catch (err)
    {
        if (err instanceof SyntaxError)
        {
            console.error(`Error: Invalid JSON in config file: ${err.message}`);
        } else
        {
            console.error(`Error processing config file: ${err.message}`);
        }

        process.exit(1);
    }
}

/**
 * Parse command line arguments and extract configuration
 *
 * Valid argument combinations:
 *
 * 1. Basic command execution:
 *    npx @modelcontextprotocol/inspector node build/index.js
 *
 * 2. Pass arguments to the server:
 *    npx @modelcontextprotocol/inspector node build/index.js arg1 arg2
 *
 * 4. Pass both arguments and environment variables:
 *    npx @modelcontextprotocol/inspector node build/index.js arg1 arg2 -e KEY1=VALUE1 -e KEY2=VALUE2
 *
 * 5. Use -- to separate inspector flags from server arguments, so we dont accidentally interpret a server argument as an inspector flag if they have the same name:
 *    npx @modelcontextprotocol/inspector node build/index.js arg1 arg2 -e KEY1=VALUE1 -e KEY2=VALUE2 -- -e something_else
 *
 * 6. Use a configuration file:
 *    npx @modelcontextprotocol/inspector --config path/to/config.json --server serverName
 *    (--config and --server always together. Other arguments are allowed but ignored, except CLI flag)
 *
 * 7. CLI mode with direct command:
 *    npx @modelcontextprotocol/inspector node my-mcp-server.js --cli --tool-name calculate_sum --tool-arg a=5 --tool-arg b=10
 *
 * 8. CLI mode with environment variables:
 *    npx @modelcontextprotocol/inspector node my-mcp-server.js -e API_KEY=secret --cli --tool-name fetch_data --tool-arg endpoint=/users
 *
 * 10. CLI mode with config file:
 *     npx @modelcontextprotocol/inspector --config config.json --server dev --cli --tool-name generate_report --tool-arg format=pdf
 */
function parseArgs(args)
{
    const program = new Command();

    program
        .name("mcp-inspector")
        .description("Model Context Protocol Inspector")
        .option("-e <env...>", "Environment variables in KEY=VALUE format")
        .option("--config <path>", "Path to config file")
        .option("--server <name>", "Server name from config file")
        .option("--cli", "Run in CLI mode")
        .option("--tool-name <name>", "Tool name for CLI mode")
        .option("--tool-arg <arg...>", "Tool arguments in KEY=VALUE format");

    // Find the separator between inspector args and server args
    const separatorIndex = args.indexOf("--");
    const inspectorArgs = separatorIndex === -1 ? args : args.slice(0, separatorIndex);
    const mcpServerArgs = separatorIndex === -1 ? [] : args.slice(separatorIndex + 1);

    // Parse inspector arguments
    program.parse(inspectorArgs, { from: "user" });
    const opts = program.opts();

    // Process environment variables
    const envVars = {};

    if (opts.e)
    {
        for (const env of opts.e)
        {
            const [key, value] = env.split("=");

            if (key && value)
            {
                envVars[key] = value;
            }
        }
    }

    // Process tool arguments
    const cliToolArgs = {};

    if (opts.toolArg)
    {
        for (const arg of opts.toolArg)
        {
            const [key, value] = arg.split("=");

            if (key && value) cliToolArgs[key] = value;
        }
    }

    // Get the command (first non-option argument)
    const command = program.args[0];

    // If config and server are provided, load the configuration
    if (opts.config && opts.server)
    {
        const serverConfig = loadConfigFile(opts.config, opts.server);
        
        // Merge server config environment variables with provided ones
        if (serverConfig.env)
        {
            envVars = { ...serverConfig.env, ...envVars };
        }
    }

    return {
        cliMode: !!opts.cli,
        cliToolName: opts.toolName || null,
        cliToolArgs,
        command,
        mcpServerArgs,
        envVars,
        configPath: opts.config || null,
        serverName: opts.server || null,
    };
}

/**
 * Main entry point
 */
async function main()
{
    const { cliMode, cliToolName, cliToolArgs, command, mcpServerArgs, envVars, configPath, serverName } = parseArgs(
        process.argv.slice(2)
    );

    if (cliMode)
    {
        runCliClient(cliToolName, cliToolArgs, command, mcpServerArgs, envVars, configPath, serverName);
    } else
    {
        await runWebClient(command, mcpServerArgs, envVars);
    }
}

main().catch(e =>
{
    console.error(e);
    process.exit(1);
});
