#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Command } from "commander";
import { findActualExecutable } from "spawn-rx";

const defaultEnvironment = {
    ...getDefaultEnvironment(),
    ...(process.env.CLI_ENV_VARS ? JSON.parse(process.env.CLI_ENV_VARS) : {})
};

// cli.js node build/index.js arg1 arg2 --tool-name generate_report --tool-arg format=pdf --env KEY1=VALUE1 --env KEY2=VALUE2
async function executeCliToolCall(
    mcpServerCommand: string,
    mcpServerArgs: string[],
    envVars: Record<string, string>,
    cliToolName: string,
    cliToolArgs: Record<string, string>
)
{
    console.log(`Executing tool call: ${cliToolName}`);
    console.log(`Tool arguments: ${JSON.stringify(cliToolArgs, null, 2)}`);

    let transport: StdioClientTransport | null = null;
    let client: Client | null = null;

    try
    {
        const env = { ...process.env, ...defaultEnvironment, ...envVars };
        const { cmd, args } = findActualExecutable(mcpServerCommand, mcpServerArgs);

        transport = new StdioClientTransport({
            command: cmd,
            args,
            env,
            stderr: "pipe"
        });

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

        await client.connect(transport);

        const result = await client.callTool({
            name: cliToolName,
            arguments: cliToolArgs
        });

        console.log("Tool call result:");
        console.log(JSON.stringify(result, null, 2));

        await transport.close();
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

function parseKeyValuePair(
    value: string,
    previous: Record<string, string> = {}
): Record<string, string>
{
    const [key, val] = value.split("=");

    if (key && val)
    {
        return { ...previous, [key]: val };
    }

    return previous;
}

type Args = {
    mcpServerCommand: string;
    mcpServerArgs: string[];
    envVars: Record<string, string>;
    cliToolName: string;
    cliToolArgs: Record<string, string>;
};

function parseArgs(args: string[]): Args
{
    // TEMPORARY DEBUG LOG: Remove before production
    console.log("\n🔍 CLI Tool: Parsing arguments:", args.join(" "));

    const result: Args = {
        mcpServerCommand: "",
        mcpServerArgs: [] as string[],
        envVars: {} as Record<string, string>,
        cliToolName: "",
        cliToolArgs: {} as Record<string, string>
    };

    const program = new Command();

    program
        .allowUnknownOption()
        .allowExcessArguments()
        .option("--env <env>", "Set environment variables in key=value format", (value, previous) => parseKeyValuePair(value, previous as Record<string, string>))
        .option("--tool-name <name>", "Tool name to execute")
        .option("--tool-arg <arg>", "Tool argument in key=value format", (value, previous) => parseKeyValuePair(value, previous as Record<string, string>));

    program.parse(args);

    const opts = program.opts();
    result.envVars = opts.env || {};
    result.cliToolName = opts.toolName || "";
    result.cliToolArgs = opts.toolArg || {};

    const remainingArgs = program.args;

    if (remainingArgs.length > 0)
    {
        result.mcpServerCommand = remainingArgs[0];
        result.mcpServerArgs = remainingArgs.slice(1);
    }

    if (!result.cliToolName)
    {
        console.error("Error: Tool name (--tool-name) is required");
        process.exit(1);
    }

    if (Object.keys(result.cliToolArgs).length > 0 && !result.cliToolName)
    {
        console.error("Error: Tool arguments (--tool-arg) can only be used with --tool-name flag");
        process.exit(1);
    }

    if (!result.mcpServerCommand)
    {
        console.error("Error: MCP server command is required as the first argument");
        process.exit(1);
    }

    // TEMPORARY DEBUG LOG: Remove before production
    console.log(
        "\n📋 Parsed configuration:",
        JSON.stringify(
            {
                mcpServerCommand: result.mcpServerCommand,
                mcpServerArgs: result.mcpServerArgs,
                envVars: result.envVars,
                cliToolName: result.cliToolName,
                cliToolArgs: result.cliToolArgs
            },
            null,
            2
        )
    );

    return result;
}

async function main()
{
    try
    {
        const config = parseArgs(process.argv.slice(2));

        await executeCliToolCall(config.mcpServerCommand, config.mcpServerArgs, config.envVars, config.cliToolName, config.cliToolArgs);

        process.exit(0);
    }
    catch (error)
    {
        console.error("Failed to execute tool call:", error);
        process.exit(1);
    }
}

main().catch(error =>
{
    console.error("Unhandled error:", error);
    process.exit(1);
});
