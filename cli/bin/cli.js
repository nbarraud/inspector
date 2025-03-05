#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(__dirname, "../build/index.js");

// Forward all arguments to the CLI implementation
import(cliPath); 