#!/usr/bin/env node

import { spawn } from "child_process";
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { dirname, resolve } from "path";
import { spawnPromise } from "spawn-rx";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function delay(ms)
{
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWebClient(command, mcpServerArgs, envVars)
{
    const inspectorServerPath = resolve(
        __dirname,
        "..",
        "server",
        "build",
        "index.js"
    );

    // Path to the client entry point
    const inspectorClientPath = resolve(
        __dirname,
        "..",
        "client",
        "bin",
        "cli.js"
    );

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
            ...(command ? [`--env`, command] : []),
            ...(mcpServerArgs ? [`--args=${mcpServerArgs.join(" ")}`] : [])
        ],
        {
            env: {
                ...process.env,
                PORT: SERVER_PORT,
                MCP_ENV_VARS: JSON.stringify(envVars)
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
    mcpServerCommand,
    mcpServerArgs,
    envVars,
    cliToolName,
    cliToolArgs
)
{
    const cliClientPath = resolve(__dirname, "..", "cli", "bin", "cli.js");

    const cliArgs = [
        mcpServerCommand,
        ...mcpServerArgs,
        ...envVars.map((env) => `--env ${env}`),
        "--tool-name",
        cliToolName,
        ...cliToolArgs.map((arg) => `--tool-arg ${arg}`)
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

function loadConfigFile(configPath, serverName)
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
            console.error(
                `Available servers: ${Object.keys(parsedConfig.mcpServers || {}).join(", ")}`
            );

            process.exit(1);
        }

        const serverConfig = parsedConfig.mcpServers[serverName];

        console.log(
            `Using server configuration '${serverName}' from ${configPath}`
        );

        return serverConfig;
    }
    catch (err)
    {
        if (err instanceof SyntaxError)
        {
            console.error(`Error: Invalid JSON in config file: ${err.message}`);
        }
        else
        {
            console.error(`Error processing config file: ${err.message}`);
        }

        process.exit(1);
    }
}

// npx @modelcontextprotocol/inspector --config config.json --server report_server --cli --tool-name generate_report --tool-arg format=pdf -e KEY1=VALUE1 -e KEY2=VALUE2 -- -e something_else
// npx @modelcontextprotocol/inspector node build/index.js arg1 arg2 --cli --tool-name generate_report --tool-arg format=pdf -e KEY1=VALUE1 -e KEY2=VALUE2 -- -e something_else
function parseArgs(args)
{
    // TEMPORARY DEBUG LOG: Remove before production
    console.log("\n🔍 Top-level CLI: Parsing arguments:", args.join(" "));
    
    const result = {
        mcpServerCommand: "",
        mcpServerArgs: [],
        envVars: [],
        configPath: "",
        serverName: "",
        cliMode: false,
        cliToolName: "",
        cliToolArgs: []
    };

    // Split args into known options (before --) and unknown options (after --)
    const separatorIndex = args.indexOf("--");
    const knownOptions = separatorIndex !== -1 ? args.slice(0, separatorIndex) : args;
    const unknownOptions = separatorIndex !== -1 ? args.slice(separatorIndex + 1) : [];

    //
    // Process known options (before --)
    //

    const knownProgram = new Command();

    knownProgram
        .allowUnknownOption()
        .allowExcessArguments()
        .option(
            "-e <env>",
            "Set environment variables in key=value format",
            (value, previous) =>
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
            (value, previous) =>
            {
                previous = previous || [];
                previous.push(value);

                return previous;
            }
        );

    knownProgram.parse(["node", "script.js", ...knownOptions], { from: "user" });

    const opts = knownProgram.opts();
    result.envVars = opts.e || [];
    result.configPath = opts.config || "";
    result.serverName = opts.server || "";
    result.cliMode = opts.cli || false;
    result.cliToolName = opts.toolName || "";
    result.cliToolArgs = opts.toolArg || [];

    const remainingKnownArgs = knownProgram.args;

    if (result.configPath && !result.serverName)
    {
        console.error("Error: When using --config, you must also specify --server");
        process.exit(1);
    }

    if (!result.configPath && result.serverName)
    {
        console.error("Error: When using --server, you must also specify --config");
        process.exit(1);
    }

    if (result.cliMode && !result.cliToolName)
    {
        console.error("Error: When using --cli, you must also specify --tool-name");
        process.exit(1);
    }

    if (!result.cliMode && result.cliToolName)
    {
        console.error("Error: When using --tool-name, you must also specify --cli");
        process.exit(1);
    }

    if (result.cliToolArgs.length > 0 && (!result.cliMode || !result.cliToolName))
    {
        console.error(
            "Error: Tool arguments (--tool-arg) can only be used with both --cli and --tool-name flags"
        );
        process.exit(1);
    }

    // Handle config file if specified
    if (result.configPath)
    {
        const serverConfig = loadConfigFile(result.configPath, result.serverName);

        // Override command line options with config file values
        result.mcpServerCommand = serverConfig.command;
        result.mcpServerArgs = serverConfig.args || [];
        result.envVars = serverConfig.env || [];

        console.log("\n📋 Parsed configuration:", JSON.stringify({
            mcpServerCommand: result.mcpServerCommand,
            mcpServerArgs: result.mcpServerArgs,
            envVars: result.envVars,
            configPath: result.configPath,
            serverName: result.serverName,
            cliMode: result.cliMode,
            cliToolName: result.cliToolName,
            cliToolArgs: result.cliToolArgs
        }, null, 2));

        // Return early since we've configured everything from the config file
        return result;
    }

    //
    // Process unknown options (after --)
    //

    const unknownProgram = new Command();

    unknownProgram
        .allowUnknownOption()
        .allowExcessArguments()
        .parse(["node", "script.js", ...unknownOptions], { from: "user" });

    const remainingUnknownArgs = unknownProgram.args;

    // Merge remaining arguments from both parsers
    const mergedArgs = [...remainingKnownArgs, ...remainingUnknownArgs];

    // The first entry is the command, the rest are server args
    if (mergedArgs.length > 0)
    {
        result.mcpServerCommand = mergedArgs[0];
        result.mcpServerArgs = mergedArgs.slice(1);
    }

    // TEMPORARY DEBUG LOG: Remove before production
    console.log("\n📋 Parsed configuration:", JSON.stringify({
        mcpServerCommand: result.mcpServerCommand,
        mcpServerArgs: result.mcpServerArgs,
        envVars: result.envVars,
        configPath: result.configPath,
        serverName: result.serverName,
        cliMode: result.cliMode,
        cliToolName: result.cliToolName,
        cliToolArgs: result.cliToolArgs
    }, null, 2));

    return result;
}

async function main()
{
    const args = parseArgs(process.argv.slice(2));

    if (args.cliMode)
    {
        runCliClient(
            args.mcpServerCommand,
            args.mcpServerArgs,
            args.envVars,
            args.cliToolName,
            args.cliToolArgs
        );
    }
    else
    {
        await runWebClient(args.mcpServerCommand, args.mcpServerArgs, args.envVars);
    }
}

main().catch((e) =>
{
    console.error(e);
    process.exit(1);
});
