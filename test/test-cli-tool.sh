#!/bin/bash

# Set error handling
set -e
echo "🧪 Testing CLI Tool..."

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

# Test 1: Basic tool execution
echo "\n📝 Test 1: Basic tool execution"
node cli/build/index.js /usr/local/bin/node --no-deprecation /Users/ni/Code/mydocs/build/mydocs.js --tool-name search &
sleep 2
cleanup

# Test 2: Tool with arguments
echo "\n📝 Test 2: Tool with arguments"
node cli/build/index.js /usr/local/bin/node --no-deprecation /Users/ni/Code/mydocs/build/mydocs.js --tool-name search --tool-arg query="test query" --tool-arg limit=5 &
sleep 2
cleanup

# Test 3: Tool with environment variables
echo "\n📝 Test 3: Tool with environment variables"
node cli/build/index.js /usr/local/bin/node --no-deprecation /Users/ni/Code/mydocs/build/mydocs.js --tool-name search --env DOCS_PATH=/Users/ni/Code/library-docs --env DEBUG=true &
sleep 2
cleanup

# Test 4: Tool with server arguments
echo "\n📝 Test 4: Tool with server arguments"
node cli/build/index.js /usr/local/bin/node --no-deprecation /Users/ni/Code/mydocs/build/mydocs.js --port 3001 --tool-name search &
sleep 2
cleanup

# Test 5: Complex combination
echo "\n📝 Test 5: Complex combination"
node cli/build/index.js /usr/local/bin/node --no-deprecation /Users/ni/Code/mydocs/build/mydocs.js --tool-name search --tool-arg query="complex query" --tool-arg limit=10 --env DOCS_PATH=/Users/ni/Code/library-docs --env DEBUG=true &
sleep 2
cleanup

echo "\n✅ All CLI tool tests completed!" 