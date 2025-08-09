# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Shogi AI Engine wrapper that provides both REST API and MCP (Model Context Protocol) server interfaces for a Shogi engine. The project wraps a native Shogi engine binary to provide modern API access for AI-powered Shogi analysis.

## Key Commands

### Running the Services
- **REST API Server**: `npm run start:rest` - Starts the REST API server on port 8787 (configurable via PORT env var)
- **MCP Server**: `npm run start:mcp` - Starts the MCP server for stdio communication
- **Install Dependencies**: `npm install` - Installs Express and MCP SDK dependencies

### Environment Variables
- `ENGINE_PATH`: Path to the Shogi engine binary (default: `./engine/engine`)
- `PORT`: REST server port (default: 8787)
- `REST_BASE`: MCP server's REST API base URL (default: `http://localhost:8787`)
- `DEBUG`: Set to "1" to enable engine communication debug logs
- `EVAL_FILE`: Optional path to evaluation file for the engine
- `EVAL_DIR`: Optional directory containing evaluation files

## Architecture

### Core Components

1. **AIEngine Class** (`engine.js`): 
   - Manages USI protocol communication with the native Shogi engine binary
   - Handles engine lifecycle, position setup, and analysis requests
   - Uses mutex for thread-safe sequential operations
   - Parses engine info lines to extract evaluation data (score, PV, depth, etc.)

2. **REST API Server** (`rest.js`):
   - Express server providing HTTP endpoints for engine analysis
   - Main endpoint: `GET /analyze` with query parameters:
     - `sfen` (required): Board position in SFEN format
     - `depth`: Search depth (default: 30, max: 30)
     - `multipv`: Number of best moves to analyze (default: 10, max: 10)
     - `threads`: Engine threads (default: 1, max: 8)
     - `forceMove`: Optional move to analyze after the given position

3. **MCP Server** (`mcp-server.mjs`):
   - Implements Model Context Protocol for AI agent integration
   - Provides three tools:
     - `ping`: Health check tool
     - `analyze`: Full position analysis with MultiPV
     - `eval_at`: Evaluate position after a specific move
   - Communicates with REST API internally

### Data Flow

1. External clients → MCP Server or REST API
2. REST API → AIEngine class → Native engine process (USI protocol)
3. Engine results → Parsed and formatted → Returned to client

### Engine Communication Protocol

The project uses the USI (Universal Shogi Interface) protocol for engine communication:
- Initialization: `usi` → `usiok` → `isready` → `readyok`
- Position setup: `position sfen [SFEN] [moves ...]` or `position startpos [moves ...]`
- Analysis: `go depth [N]` → engine sends `info` lines → ends with `bestmove`

## Development Notes

- The native engine binary must be present at `./engine/engine` or specified via `ENGINE_PATH`
- Evaluation data files (`nn.bin`) should be in the `./eval/` directory
- Both servers can run simultaneously (REST for direct HTTP access, MCP for AI agent integration)
- The engine process is managed as a child process with line-based stdout parsing
- Thread safety is ensured through mutex locking for sequential engine operations