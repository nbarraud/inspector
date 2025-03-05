#!/usr/bin/env node

import { spawn } from "child_process";
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { dirname, resolve } from "path";
import { spawnPromise } from "spawn-rx";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

type Args = {
    mcpServerCommand: string;
    mcpServerArgs: string[];
    env: string[];
    config: string;
    server: string;
    cli: boolean;
    toolName: string;
    toolArgs: string[];
};

type ServerConfig = {
    command: string;
    args?: string[];
    env?: string[];
};

function delay(ms: number): Promise<void>
{
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWebClient(
    mcpServerCommand: string | undefined,
    mcpServerArgs: string[] | undefined,
    env: string[]
): Promise<void>
{
    const inspectorServerPath = resolve(__dirname, "..", "server", "build", "index.js");

    // Path to the client entry point
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

    const server = spawnPromise(
        "node",
        [
            inspectorServerPath,
            ...(mcpServerCommand ? [`--env`, mcpServerCommand] : []),
            ...(mcpServerArgs ? [`--args=${mcpServerArgs.join(" ")}`] : [])
        ],
        {
            env: {
                ...process.env,
                PORT: SERVER_PORT,
                MCP_ENV_VARS: JSON.stringify(env)
            },
            signal: abort.signal,
            echoOutput: true
        }
    );

    const client = spawnPromise("node", [inspectorClientPath], {
        env: { ...process.env, PORT: CLIENT_PORT },
        signal: abort.signal,
        echoOutput: true
    });

    // Make sure our server/client didn't immediately fail
    await Promise.any([server, client, delay(2 * 1000)]);
    const portParam = SERVER_PORT === "3000" ? "" : `?proxyPort=${SERVER_PORT}`;
    console.log(
        `\n🔍 MCP Inspector is up and running at http://localhost:${CLIENT_PORT}${portParam} 🚀`
    );

    try
    {
        await Promise.any([server, client]);
    }
    catch (e)
    {
        if (!cancelled || process.env.DEBUG)
        {
            throw e;
        }
    }
}

function runCliClient(
    mcpServerCommand: string,
    mcpServerArgs: string[],
    env: string[],
    toolName: string,
    toolArgs: string[]
): void
{
    const cliClientPath = resolve(__dirname, "..", "cli", "bin", "cli.js");

    const cliArgs = [
        mcpServerCommand,
        ...mcpServerArgs,
        ...env.map((env: string) => `--env ${env}`),
        "--tool-name",
        toolName,
        ...toolArgs.map((arg: string) => `--tool-arg ${arg}`)
    ];

    const cliProcess = spawn(cliClientPath, cliArgs, { stdio: "inherit" });

    cliProcess.on("exit", (code) =>
    {
        process.exit(code || 0);
    });

    cliProcess.on("error", (err) =>
    {
        console.error("Failed to start CLI client:", err);
        process.exit(1);
    });
}

function loadConfigFile(configPath: string, serverName: string): ServerConfig
{
    try
    {
        const resolvedConfigPath = path.isAbsolute(configPath)
            ? configPath
            : path.resolve(process.cwd(), configPath);

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
    }
    catch (err: unknown)
    {
        if (err instanceof SyntaxError)
        {
            console.error(`Error: Invalid JSON in config file: ${err.message}`);
        }
        else if (err instanceof Error)
        {
            console.error(`Error processing config file: ${err.message}`);
        }
        else
        {
            console.error("An unknown error occurred while processing the config file");
        }

        process.exit(1);
    }
}

// npx @modelcontextprotocol/inspector --config config.json --server report_server --cli --tool-name generate_report --tool-arg format=pdf -e KEY1=VALUE1 -e KEY2=VALUE2 -- -e something_else
// npx @modelcontextprotocol/inspector node build/index.js arg1 arg2 --cli --tool-name generate_report --tool-arg format=pdf -e KEY1=VALUE1 -e KEY2=VALUE2 -- -e something_else
function parseArgs(args: string[]): Args
{
    const separatorIndex = args.indexOf("--");
    const inspectorArgs = separatorIndex !== -1 ? args.slice(0, separatorIndex) : args;
    const serverArgs = separatorIndex !== -1 ? args.slice(separatorIndex + 1) : [];

    //
    // Process inspector args (before --)
    //

    const inspectorCommand = new Command();

    inspectorCommand
        .allowUnknownOption()
        .allowExcessArguments()
        .option(
            "--env -e <env>",
            "Environment variables in key=value format",
            (value: string, previous: string[] | undefined) =>
            {
                previous = previous || [];
                previous.push(value);
                return previous;
            }
        )
        .option("--config <path>", "Path to configuration file")
        .option("--server <name>", "Server name from configuration file")
        .option("--cli", "Run in CLI mode")
        .option("--tool-name <name>", "Tool name to execute in CLI mode")
        .option(
            "--tool-arg <arg>",
            "Tool argument in key=value format",
            (value: string, previous: string[] | undefined) =>
            {
                previous = previous || [];
                previous.push(value);
                return previous;
            }
        )
        .parse(["node", "script.js", ...inspectorArgs], { from: "user" });

    const parsedArgs = inspectorCommand.opts<Args>();
    const remainingInspectorArgs = inspectorCommand.args;

    if (!!parsedArgs.config !== !!parsedArgs.server)
    {
        console.error("Error: --config and --server flags must be used together");
        process.exit(1);
    }

    if (!!parsedArgs.cli !== !!parsedArgs.toolName)
    {
        console.error("Error: --cli and --tool-name flags must be used together");
        process.exit(1);
    }

    if (parsedArgs.toolArgs.length > 0 && (!parsedArgs.cli || !parsedArgs.toolName))
    {
        console.error("Error: Tool arguments (--tool-arg) can only be used with both --cli and --tool-name flags");
        process.exit(1);
    }

    // Handle config file if specified
    if (parsedArgs.config)
    {
        const serverConfig = loadConfigFile(parsedArgs.config, parsedArgs.server);

        // Override command line options with config file values
        parsedArgs.mcpServerCommand = serverConfig.command;
        parsedArgs.mcpServerArgs = serverConfig.args || [];
        parsedArgs.env = serverConfig.env || [];

        // Return early since we've configured everything from the config file
        return parsedArgs;
    }

    //
    // Process server options (after --)
    //

    const serverCommand = new Command();

    serverCommand
        .allowUnknownOption()
        .allowExcessArguments()
        .parse(["node", "script.js", ...serverArgs], { from: "user" });

    const remainingServerArgs = serverCommand.args;

    // Merge remaining arguments from both parsers
    const mergedArgs = [...remainingInspectorArgs, ...remainingServerArgs];
    parsedArgs.mcpServerCommand = mergedArgs[0];
    parsedArgs.mcpServerArgs = mergedArgs.slice(1);

    return parsedArgs;
}

async function main(): Promise<void>
{
    const args = parseArgs(process.argv.slice(2));

    if (args.cli)
    {
        runCliClient(args.mcpServerCommand, args.mcpServerArgs, args.env, args.toolName, args.toolArgs);
    }
    else
    {
        await runWebClient(args.mcpServerCommand, args.mcpServerArgs, args.env);
    }
}

main().catch((e) =>
{
    console.error(e);
    process.exit(1);
});
