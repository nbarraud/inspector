#!/bin/bash

# Set error handling
set -e
echo "🧪 Testing Top-level CLI..."

# Function to kill any running node processes and free up ports
cleanup() {
    echo "Cleaning up processes..."
    # Kill any processes using our ports
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    # Kill any remaining node processes
    pkill -f "node" || true
    sleep 1
}

# Ensure cleanup runs even if script fails
trap cleanup EXIT

# Create a temporary config file for testing
echo '{
  "mcpServers": {
    "test_server": {
      "command": "/usr/local/bin/node",
      "args": ["--no-deprecation", "/Users/ni/Code/mydocs/build/mydocs.js"],
      "env": {
        "DOCS_PATH": "/Users/ni/Code/library-docs",
        "SEARCH_LIMIT": "10"
      }
    }
  }
}' > test_config.json

# Test 1: Basic web client mode
echo "\n📝 Test 1: Basic web client mode"
node bin/cli.js --config mcp_config.json --server mydocs &
sleep 2
cleanup

# Test 2: Web client mode with environment variables
echo "\n📝 Test 2: Web client mode with environment variables"
node bin/cli.js --config mcp_config.json --server mydocs -e EXTRA_KEY=value1 -e DEBUG=true &
sleep 2
cleanup

# Test 3: CLI mode with tool
echo "\n📝 Test 3: CLI mode with tool"
node bin/cli.js --config mcp_config.json --server mydocs --cli --tool-name search &
sleep 2
cleanup

# Test 4: CLI mode with tool and arguments
echo "\n📝 Test 4: CLI mode with tool and arguments"
node bin/cli.js --config mcp_config.json --server mydocs --cli --tool-name search --tool-arg query="test query" &
sleep 2
cleanup

# Test 5: Using local config file
echo "\n📝 Test 5: Using local config file"
node bin/cli.js --config test_config.json --server test_server &
sleep 2
cleanup

# Test 6: Using local config file with CLI mode
echo "\n📝 Test 6: Using local config file with CLI mode"
node bin/cli.js --config test_config.json --server test_server --cli --tool-name search &
sleep 2
cleanup

# Test 7: Command with additional arguments after --
echo "\n📝 Test 7: Command with additional arguments after --"
node bin/cli.js --config mcp_config.json --server mydocs -e EXTRA_KEY=value1 -- --debug &
sleep 2
cleanup

# Final cleanup
rm -f test_config.json

echo "\n✅ All top-level CLI tests completed!" 