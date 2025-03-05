#!/bin/bash

# Set error handling
set -e

echo "🚀 Starting CLI Tests..."
echo "========================"

# Track test results
TOP_CLI_SUCCESS=0
CLI_TOOL_SUCCESS=0

# Run top-level CLI tests
echo "\n📋 Running Top-level CLI Tests..."
if ./test/test-top-cli.sh; then
    TOP_CLI_SUCCESS=1
    echo "✅ Top-level CLI tests passed"
else
    echo "❌ Top-level CLI tests failed"
fi

echo "\n------------------------"

# Run CLI tool tests
echo "\n📋 Running CLI Tool Tests..."
if ./test/test-cli-tool.sh; then
    CLI_TOOL_SUCCESS=1
    echo "✅ CLI tool tests passed"
else
    echo "❌ CLI tool tests failed"
fi

echo "\n========================"
echo "📊 Test Summary:"
echo "------------------------"
echo "Top-level CLI: $([ $TOP_CLI_SUCCESS -eq 1 ] && echo "✅ PASSED" || echo "❌ FAILED")"
echo "CLI Tool:     $([ $CLI_TOOL_SUCCESS -eq 1 ] && echo "✅ PASSED" || echo "❌ FAILED")"
echo "------------------------"

# Exit with success only if both test suites passed
[ $TOP_CLI_SUCCESS -eq 1 ] && [ $CLI_TOOL_SUCCESS -eq 1 ] 