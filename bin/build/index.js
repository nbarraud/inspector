#!/usr/bin/env node
import { spawn } from "child_process";
import { Command } from "commander";
import fs from "node:fs";
import { dirname, resolve } from "path";
import { spawnPromise } from "spawn-rx";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function runWebClient(command, mcpServerArgs, envVars) {
    const inspectorServerPath = resolve(__dirname, "..", "..", "server", "build", "index.js");
    // Path to the client entry point
    const inspectorClientPath = resolve(__dirname, "..", "..", "client", "bin", "cli.js");
    // Start the server
    const serverProcess = spawn("node", [inspectorServerPath, ...mcpServerArgs], {
        env: { ...process.env, ...envVars },
        stdio: "inherit",
    });
    // Wait for the server to start
    await delay(1000);
    // Start the client
    const clientProcess = spawn("node", [inspectorClientPath], {
        env: { ...process.env, ...envVars },
        stdio: "inherit",
    });
    // Handle process termination
    const cleanup = () => {
        serverProcess.kill();
        clientProcess.kill();
        process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    // Run the command
    if (command) {
        try {
            await spawnPromise(command, [], {
                env: { ...process.env, ...envVars },
                stdio: "inherit",
                shell: true,
            });
        }
        catch (error) {
            console.error(`Command failed: ${error}`);
        }
        finally {
            cleanup();
        }
    }
}
function runCliClient(mcpServerCommand, mcpServerArgs, envVars, cliToolName, cliToolArgs) {
    const inspectorCliPath = resolve(__dirname, "..", "..", "cli", "bin", "cli.js");
    // Start the CLI client
    const cliProcess = spawn("node", [
        inspectorCliPath,
        mcpServerCommand,
        ...mcpServerArgs,
        "--",
        cliToolName,
        ...cliToolArgs,
    ], {
        env: { ...process.env, ...envVars },
        stdio: "inherit",
    });
    // Handle process termination
    process.on("SIGINT", () => {
        cliProcess.kill();
        process.exit(0);
    });
}
function loadConfigFile(configPath, serverName) {
    try {
        const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
        const serverConfig = configData.servers?.[serverName];
        if (!serverConfig) {
            console.error(`Server "${serverName}" not found in config file.`);
            process.exit(1);
        }
        return {
            command: serverConfig.command || "",
            args: serverConfig.args || [],
            env: serverConfig.env || {},
        };
    }
    catch (error) {
        console.error(`Error loading config file: ${error}`);
        process.exit(1);
    }
}
function parseArgs(args) {
    const program = new Command();
    program
        .name("mcp-inspector")
        .description("Model Context Protocol inspector")
        .version("0.4.1");
    program
        .option("-c, --config <path>", "Path to config file")
        .option("-s, --server <n>", "Server name from config file")
        .option("--cli", "Use CLI client instead of web client")
        .option("--port <port>", "Port for the inspector server", "3000")
        .option("--host <host>", "Host for the inspector server", "localhost")
        .option("--no-open", "Don't open the browser automatically (web client only)")
        .option("-e, --env <env...>", "Environment variables in the format KEY=VALUE")
        .allowUnknownOption();
    program.parse(args);
    const options = program.opts();
    const remainingArgs = program.args;
    let command = "";
    let serverArgs = [];
    let envVars = {};
    let cliToolName = "";
    let cliToolArgs = [];
    // Parse environment variables
    if (options.env) {
        for (let i = 0; i < options.env.length; i++) {
            const env = options.env[i];
            const [key, value] = env.split("=");
            if (key && value) {
                envVars[key] = value;
            }
        }
    }
    // Load config file if specified
    if (options.config && options.server) {
        const configPath = resolve(process.cwd(), options.config);
        const config = loadConfigFile(configPath, options.server);
        command = config.command;
        serverArgs = config.args;
        envVars = { ...envVars, ...config.env };
    }
    // Add server options to args
    serverArgs = [
        ...serverArgs,
        "--port",
        options.port,
        "--host",
        options.host,
    ];
    if (options.noOpen === false) {
        serverArgs.push("--open");
    }
    // Parse command and args
    if (remainingArgs.length > 0) {
        if (options.cli) {
            // For CLI client, the first arg is the tool name and the rest are args
            cliToolName = remainingArgs[0];
            cliToolArgs = remainingArgs.slice(1);
        }
        else {
            // For web client, all remaining args form the command
            command = remainingArgs.join(" ");
        }
    }
    return {
        command,
        serverArgs,
        envVars,
        cliToolName,
        cliToolArgs,
        useCliClient: options.cli || false,
    };
}
async function main() {
    const { command, serverArgs, envVars, cliToolName, cliToolArgs, useCliClient, } = parseArgs(process.argv);
    if (useCliClient) {
        runCliClient(command, serverArgs, envVars, cliToolName, cliToolArgs);
    }
    else {
        await runWebClient(command, serverArgs, envVars);
    }
}
main().catch((error) => {
    console.error(`Error: ${error}`);
    process.exit(1);
});
