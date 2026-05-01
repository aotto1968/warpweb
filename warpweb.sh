#!/bin/bash
set -e

ORIGINAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SCRIPT_SOURCE" ]; do
    SCRIPT_SOURCE="$(readlink -f "$SCRIPT_SOURCE")"
done
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
RESOLVED_PARENT="$(cd "$SCRIPT_DIR/.." && pwd)"
ELECTRON_DIR="$SCRIPT_DIR"
ORIGINAL_PWD="$PWD"

cd "$ELECTRON_DIR"

MODE="prod"
ACTION="fg"
CLI_JSON_ARG=""

for arg in "$@"; do
    case "$arg" in
        setup)
            echo "Installing Electron dependencies..."
            npm install
            echo "Setup complete."
            exit 0
            ;;
        --json=*)
            CLI_JSON_ARG="${arg#--json=}"
            MODE="custom"
            ;;
        --prod|--test|--dist)
            MODE="${arg#--}"
            ;;
        bg|fg)
            ACTION="$arg"
            ;;
        -h|--help|*)
            echo "Usage: $0 [options] [action]"
            echo ""
            echo "Options:"
            echo "  --json=PATH  Use specified JSON file"
            echo "  --prod       Use warpweb-data.json (default)"
            echo "  --test       Use warpweb-data-test.json"
            echo "  --dist       Use warpweb-data.json (packaged app)"
            echo "  -h, --help   Show this help message"
            echo ""
            echo "Actions:"
            echo "  fg           Start in foreground (default)"
            echo "  bg           Start in background with logging"
            echo ""
            echo "JSON file search priority:"
            echo "  1. --json=PATH  (command line)"
            echo "  2. \$WARPWEB_JSON_FILE  (environment)"
            echo "  3. ./warpweb-data.json  (current directory)"
            echo "  4. resolved parent  (symlink target dir)"
            echo "  5. original dir  (symlink location)"
            echo ""
            echo "Log directory priority:"
            echo "  1. \$WARPWEB_LOG_DIR  (environment)"
            echo "  2. \$PWD/logs  (current directory)"
            echo "  3. original dir  (symlink location)"
            echo ""
            echo "Examples:"
            echo "  $0 setup              Install dependencies"
            echo "  $0 --test bg          Start with test data in background"
            echo "  $0 --dist fg          Start packaged app in foreground"
            echo "  $0 --json=custom.json fg"
            exit 0
            ;;
    esac
done

function find_json_file() {
    local basename="${1:-warpweb-data.json}"
    # 1. --json=PATH command line argument (only for default basename)
    if [ "$basename" = "warpweb-data.json" ] && [ -n "$CLI_JSON_ARG" ]; then
        [ -f "$CLI_JSON_ARG" ] || { echo "ERROR: --json file not found: $CLI_JSON_ARG" >&2; exit 1; }
        echo "$CLI_JSON_ARG"
        return 0
    fi

    # 2. WARPWEB_JSON_FILE environment variable (only for default basename)
    if [ "$basename" = "warpweb-data.json" ] && [ -n "$WARPWEB_JSON_FILE" ]; then
        [ -f "$WARPWEB_JSON_FILE" ] || { echo "ERROR: WARPWEB_JSON_FILE not found: $WARPWEB_JSON_FILE" >&2; exit 1; }
        echo "$WARPWEB_JSON_FILE"
        return 0
    fi

    # 3. Current working directory (original before cd)
    if [ -f "$ORIGINAL_PWD/$basename" ]; then
        echo "$ORIGINAL_PWD/$basename"
        return 0
    fi

    # 4. Resolved parent directory (where the symlink points)
    if [ -f "$RESOLVED_PARENT/$basename" ]; then
        echo "$RESOLVED_PARENT/$basename"
        return 0
    fi

    # 5. Original directory (where the symlink lives)
    if [ -f "$ORIGINAL_DIR/$basename" ]; then
        echo "$ORIGINAL_DIR/$basename"
        return 0
    fi

    echo "ERROR: $basename not found in any location" >&2
    exit 1
}

function find_log_dir() {
    # 1. WARPWEB_LOG_DIR environment variable
    if [ -n "$WARPWEB_LOG_DIR" ]; then
        echo "$WARPWEB_LOG_DIR"
        return 0
    fi

    # 2. Current working directory (original before cd)
    local dir="$ORIGINAL_PWD/logs"
    if [ -d "$dir" ] || mkdir -p "$dir" 2>/dev/null; then
        echo "$dir"
        return 0
    fi

    # 3. Original directory (where the symlink lives)
    echo "$ORIGINAL_DIR/logs"
    return 0
}

function start() {
    echo "Starting WarpWeb (mode=$MODE, action=$ACTION)..."

    ELECTRON_PATH="$ELECTRON_DIR/node_modules/.bin/electron"
    if [ ! -f "$ELECTRON_PATH" ]; then
        echo "ERROR: Electron not found. Run '$0 setup' first."
        exit 1
    fi

    local JSON_FILE
    case "$MODE" in
        custom)
            JSON_FILE="$(find_json_file)"
            ;;
        prod)
            JSON_FILE="$(find_json_file)"
            ;;
        test)
            JSON_FILE="$(find_json_file "warpweb-data-test.json")"
            ;;
        dist)
            JSON_FILE="$SCRIPT_DIR/warpweb-data.json"
            ;;
    esac

    local LOG_DIR
    LOG_DIR="$(find_log_dir)"
    local LOG_FILE="$LOG_DIR/warpweb.log"

    if [ ! -f "$JSON_FILE" ]; then
        echo "ERROR: JSON file not found: $JSON_FILE"
        exit 1
    fi

    case "$ACTION" in
        bg)
            mkdir -p "$LOG_DIR"
            echo "=== WarpWeb started at $(date -Iseconds) ===" >> "$LOG_FILE"
            "$ELECTRON_PATH" . "--json=$JSON_FILE" "--log-dir=$LOG_DIR" >> "$LOG_FILE" 2>&1 & disown
            echo "Started in background. Logs at $LOG_FILE"
            ;;
        fg)
            "$ELECTRON_PATH" . "--json=$JSON_FILE" "--log-dir=$LOG_DIR"
            ;;
    esac
}

start
