export function renderCli(baseUrl: string): string {
    return String.raw`#!/bin/sh
set -e
BASE='${baseUrl}'
AGENT=$HELIX_AGENT
if [ -z "$AGENT" ]; then
  AGENT_FILE="$HOME/.helix-mcp-agent"
  [ -s "$AGENT_FILE" ] || printf 'cli-%s-%s\n' "$(date +%s)" "$$" > "$AGENT_FILE"
  AGENT=$(cat "$AGENT_FILE")
fi

usage() {
  cat <<'USAGE'
helix - Helix Engine MCP from the terminal
  helix status                           editor connection, project and queue
  helix tools                            tool catalog
  helix schema <tool>                    arguments of one tool
  helix call <tool> [key=value ...]      run a tool; key@file reads the value from a file
  helix upload <file>                    send a file and print its file id
  helix download <file-id> [output]      fetch a stored file
  helix shot [output.jpg] [key=value]    save a screenshot of the viewport
Lists and objects are JSON: position='[0,2,0]'.
Set HELIX_SECRET when the Worker requires a secret, HELIX_AGENT to choose your name in the editor log.
USAGE
}

request() {
  if [ -n "$HELIX_SECRET" ]; then
    curl -sS --max-time 90 -H "X-Mcp-Agent: $AGENT" -H "Authorization: Bearer $HELIX_SECRET" "$@"
  else
    curl -sS --max-time 90 -H "X-Mcp-Agent: $AGENT" "$@"
  fi
}

show() {
  body=$(mktemp)
  status=$(request -o "$body" -w '%{http_code}' "$@") || status=000
  cat "$body"
  rm -f "$body"
  [ "$status" -ge 200 ] && [ "$status" -lt 400 ]
}

save() {
  output=$1
  shift
  status=$(request -o "$output" -w '%{http_code}' "$@") || status=000
  if [ "$status" -ge 200 ] && [ "$status" -lt 400 ]; then
    echo "saved $output"
    return 0
  fi
  [ -f "$output" ] && cat "$output" >&2
  rm -f "$output"
  return 1
}

post_form() {
  output=$1
  endpoint=$2
  shift 2
  count=$#
  while [ "$count" -gt 0 ]; do
    set -- "$@" --data-urlencode "$1"
    shift
    count=$((count - 1))
  done
  set -- -X POST -H "Idempotency-Key: $(date +%s)-$$" --retry 2 --retry-max-time 20 "$@" "$endpoint"
  if [ "$output" = - ]; then
    show "$@"
  else
    save "$output" "$@"
  fi
}

command=$1
[ "$#" -gt 0 ] && shift
case "$command" in
  status)
    show -X POST "$BASE/call/engine_status"
    ;;
  tools)
    show "$BASE/tools"
    ;;
  schema)
    [ -n "$1" ] || { usage; exit 2; }
    show "$BASE/tools/$1"
    ;;
  call)
    [ -n "$1" ] || { usage; exit 2; }
    tool=$1
    shift
    post_form - "$BASE/call/$tool" "$@"
    ;;
  upload)
    [ -f "$1" ] || { echo "helix: file not found: $1" >&2; exit 2; }
    name=$(basename "$1" | tr -c 'A-Za-z0-9._\n-' '_')
    show -T "$1" "$BASE/files/$name"
    ;;
  download)
    [ -n "$1" ] || { usage; exit 2; }
    output=$2
    [ -n "$output" ] || output=$1
    save "$output" "$BASE/files/$1"
    ;;
  shot)
    output=viewport.jpg
    case "$1" in
      ''|*=*|*@*) ;;
      *) output=$1; shift ;;
    esac
    post_form "$output" "$BASE/call/capture_viewport?output=file" "$@"
    ;;
  ''|help|-h|--help)
    usage
    ;;
  *)
    usage
    exit 2
    ;;
esac
`;
}
