#!/bin/bash
set -e

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SCRIPT_SOURCE" ]; do
    SCRIPT_SOURCE="$(readlink -f "$SCRIPT_SOURCE")"
done
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
ELECTRON_DIR="$SCRIPT_DIR"
LOG_FILE="$SCRIPT_DIR/../logs/warpweb.log"
PROD_FILE="$SCRIPT_DIR/../warpweb-data.json"
TEST_FILE="$SCRIPT_DIR/../warpweb-data-test.json"
DIST_FILE="$SCRIPT_DIR/warpweb-data.json"

cd "$ELECTRON_DIR"

MODE="prod"
ACTION="fg"

for arg in "$@"; do
    case "$arg" in
        setup)
            echo "Installing Electron dependencies..."
            npm install
            echo "Setup complete."
            exit 0
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
            echo "  --prod       Use warpweb-data.json (default)"
            echo "  --test       Use warpweb-data-test.json"
            echo "  --dist       Use warpweb-data.json (packaged app)"
            echo "  -h, --help   Show this help message"
            echo ""
            echo "Actions:"
            echo "  fg           Start in foreground (default)"
            echo "  bg           Start in background with logging"
            echo ""
            echo "Examples:"
            echo "  $0 setup              Install dependencies"
            echo "  $0 --test bg          Start with test data in background"
            echo "  $0 --dist fg          Start packaged app in foreground"
            exit 0
            ;;
    esac
done

function start() {
    echo "Starting WarpWeb (mode=$MODE, action=$ACTION)..."

    ELECTRON_PATH="$ELECTRON_DIR/node_modules/.bin/electron"
    if [ ! -f "$ELECTRON_PATH" ]; then
        echo "ERROR: Electron not found. Run '$0 setup' first."
        exit 1
    fi

    local JSON_FILE
    case "$MODE" in
        prod) JSON_FILE="$PROD_FILE" ;;
        test) JSON_FILE="$TEST_FILE" ;;
        dist) JSON_FILE="$DIST_FILE" ;;
    esac

    if [ ! -f "$JSON_FILE" ]; then
        echo "ERROR: JSON file not found: $JSON_FILE"
        exit 1
    fi

    case "$ACTION" in
        bg)
            mkdir -p "$(dirname "$LOG_FILE")"
            echo "=== WarpWeb started at $(date -Iseconds) ===" >> "$LOG_FILE"
            "$ELECTRON_PATH" . "--json=$JSON_FILE" >> "$LOG_FILE" 2>&1 & disown
            echo "Started in background. Logs at $LOG_FILE"
            ;;
        fg)
            "$ELECTRON_PATH" . "--json=$JSON_FILE"
            ;;
    esac
}

start
