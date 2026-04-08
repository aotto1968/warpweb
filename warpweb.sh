#!/bin/bash
set -e

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SCRIPT_SOURCE" ]; do
    SCRIPT_SOURCE="$(readlink -f "$SCRIPT_SOURCE")"
done
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
ELECTRON_DIR="$SCRIPT_DIR"
LOG_FILE="$SCRIPT_DIR/../logs/warpweb.log"
OUTPUT_FILE="$SCRIPT_DIR/../warpweb-data.json"
TEST_FILE="$SCRIPT_DIR/../warpweb-data-test.json"
README_MD="$ELECTRON_DIR/README.md"
README_HTML="$ELECTRON_DIR/README.html"

cd "$ELECTRON_DIR"

function setup() {
    echo "Installing Electron dependencies..."
    npm install
    echo "Setup complete."
}

get_mtime() {
    stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0
}

function start() {
    echo "Starting WarpWeb..."

    if [ -f "$README_MD" ]; then
        MD_TIME=$(get_mtime "$README_MD")
        HTML_TIME=$(get_mtime "$README_HTML")
        if [ "$MD_TIME" -gt "$HTML_TIME" ]; then
            echo "Converting README_warpweb.md to HTML..."
            node convert-readme.js
        fi
    fi

    ELECTRON_PATH="$ELECTRON_DIR/node_modules/.bin/electron"
    if [ ! -f "$ELECTRON_PATH" ]; then
        echo "ERROR: Electron not found. Run '$0 setup' first."
        exit 1
    fi

    echo "=== WarpWeb started at $(date -Iseconds) ===" >> "$LOG_FILE"

    local JSON_FILE
    case "$CMD" in
      start|start-front)
          JSON_FILE="$OUTPUT_FILE"
        ;;
      test|test-front)
          JSON_FILE="$TEST_FILE"
        ;;
    esac

    case "$CMD" in
      start|test)
          mkdir -p "$(dirname "$LOG_FILE")"
          "$ELECTRON_PATH" . "--json=$JSON_FILE" >> "$LOG_FILE" 2>&1 & disown
          echo "Started. Logs at $LOG_FILE"
        ;;
      start-front|test-front)
          "$ELECTRON_PATH" . "--json=$JSON_FILE"
        ;;
    esac
}

CMD="${1:-start}"

case "$CMD" in
    setup)
        setup
        ;;
    start|start-front)
        start
        ;;
    test|test-front)
        start
        ;;
    *)
        echo "Usage: $0 [setup|start|test]"
        echo "  setup       - Install/update Electron dependencies"
        echo "  start       - Start WarpWeb (default)"
        echo "  start-front - Start WarpWeb with frontend session"
        echo "  test        - Start WarpWeb with test data (warpweb-data-test.json)"
        echo "  test-front  - Start WarpWeb with test data, in foreground"
        exit 1
        ;;
esac
