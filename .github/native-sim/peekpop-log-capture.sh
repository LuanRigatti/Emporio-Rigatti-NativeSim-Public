# shellcheck shell=bash
# Helpers used by the opt-in NativeSim OSLog category capture.
# This file is sourced by a GitHub Actions bash step.

peekpop_capture_configure_categories() {
  local raw="${NATIVE_SIM_LOG_CATEGORIES-}"
  local category remaining final_category
  local count=0

  if [ -z "$raw" ]; then
    raw="OpenPaymentPeekPopReturn"
  fi
  if [ "${#raw}" -gt 520 ]; then
    echo "::error::NATIVE_SIM_LOG_CATEGORIES must be at most 520 characters"
    return 1
  fi
  if [[ "$raw" == ,* || "$raw" == *, || "$raw" == *,,* ]]; then
    echo "::error::NATIVE_SIM_LOG_CATEGORIES contains an empty category"
    return 1
  fi

  PEEKPOP_CAPTURE_CATEGORIES=()
  PEEKPOP_CAPTURE_CATEGORIES_CSV=""
  PEEKPOP_CAPTURE_CATEGORIES_JSON="["
  PEEKPOP_CAPTURE_PREDICATE=""
  remaining="$raw"

  while :; do
    if [[ "$remaining" == *,* ]]; then
      category="${remaining%%,*}"
      remaining="${remaining#*,}"
      final_category=false
    else
      category="$remaining"
      remaining=""
      final_category=true
    fi

    count=$((count + 1))
    if [ "$count" -gt 8 ]; then
      echo "::error::NATIVE_SIM_LOG_CATEGORIES accepts at most 8 categories"
      return 1
    fi
    if [[ ! "$category" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]]; then
      echo "::error::Invalid OSLog category; use 1-64 ASCII letters, digits, dots, underscores, or hyphens, starting with a letter or digit"
      return 1
    fi
    case ",${PEEKPOP_CAPTURE_CATEGORIES_CSV}," in
      *",$category,"*)
        echo "::error::NATIVE_SIM_LOG_CATEGORIES contains a duplicate category"
        return 1
        ;;
    esac
    PEEKPOP_CAPTURE_CATEGORIES+=("$category")
    if [ -n "$PEEKPOP_CAPTURE_CATEGORIES_CSV" ]; then
      PEEKPOP_CAPTURE_CATEGORIES_CSV+=","
      PEEKPOP_CAPTURE_CATEGORIES_JSON+=","
      PEEKPOP_CAPTURE_PREDICATE+=" OR "
    fi
    PEEKPOP_CAPTURE_CATEGORIES_CSV+="$category"
    PEEKPOP_CAPTURE_CATEGORIES_JSON+="\"$category\""
    PEEKPOP_CAPTURE_PREDICATE+="category == \"$category\""

    if [ "$final_category" = "true" ]; then
      break
    fi
  done

  PEEKPOP_CAPTURE_CATEGORIES_JSON+="]"
}

peekpop_capture_preflight() {
  peekpop_capture_configure_categories || return 1
  if [ -z "${PEEKPOP_LOG_AGE_RECIPIENT:-}" ]; then
    echo "::error::Set the repository Actions variable PEEKPOP_LOG_AGE_RECIPIENT before enabling OSLog capture"
    return 1
  fi
  if ! command -v age >/dev/null 2>&1; then
    echo "::error::age is not installed on the NativeSim runner"
    return 1
  fi

  local probe
  probe=$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/native-sim-age-probe.XXXXXX") || return 1
  if ! printf 'native-sim-age-recipient-preflight' \
    | age -r "$PEEKPOP_LOG_AGE_RECIPIENT" -o "$probe" >/dev/null 2>&1; then
    rm -f "$probe"
    echo "::error::The configured OSLog age recipient is invalid or unsupported"
    return 1
  fi
  if [ ! -s "$probe" ]; then
    rm -f "$probe"
    echo "::error::age preflight produced no ciphertext"
    return 1
  fi
  rm -f "$probe"
}

peekpop_capture_prepare_paths() {
  peekpop_capture_configure_categories || return 1
  local capture_root="${RUNNER_TEMP:?}/native-sim-oslog-${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:?}"
  PEEKPOP_CAPTURE_RAW="$capture_root/native-sim-oslog.log"
  PEEKPOP_CAPTURE_STDERR="$capture_root/log-stream.stderr"
  PEEKPOP_CAPTURE_ARTIFACT_DIR="${NATIVE_SIM_CAPTURE_ARTIFACT_DIR:-${GITHUB_WORKSPACE:?}/build/native-sim-oslogs}"
  PEEKPOP_CAPTURE_FILE="$PEEKPOP_CAPTURE_ARTIFACT_DIR/native-sim-oslog.age"
  PEEKPOP_CAPTURE_MANIFEST="$PEEKPOP_CAPTURE_ARTIFACT_DIR/manifest.json"
  mkdir -p "$capture_root" "$PEEKPOP_CAPTURE_ARTIFACT_DIR"
  rm -f "$PEEKPOP_CAPTURE_RAW" "$PEEKPOP_CAPTURE_STDERR" \
    "$PEEKPOP_CAPTURE_FILE" "$PEEKPOP_CAPTURE_MANIFEST"
}

peekpop_capture_record_start() {
  PEEKPOP_CAPTURE_STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  {
    echo "pid=$PEEKPOP_LOG_STREAM_PID"
    echo "raw=$PEEKPOP_CAPTURE_RAW"
    echo "stderr=$PEEKPOP_CAPTURE_STDERR"
    echo "started_at=$PEEKPOP_CAPTURE_STARTED_AT"
    echo "categories=$PEEKPOP_CAPTURE_CATEGORIES_CSV"
    echo "predicate=$PEEKPOP_CAPTURE_PREDICATE"
  } >> "$GITHUB_OUTPUT"
  echo "OSLog capture source started for configured categories"
}

peekpop_capture_start_detached() {
  peekpop_capture_configure_categories || return 1
  if [ -z "${UDID:-}" ] || ! xcrun simctl list devices booted 2>/dev/null | grep -Fq "$UDID"; then
    echo "::error::The configured NativeSim device is not booted; OSLog capture was not started"
    return 1
  fi

  peekpop_capture_prepare_paths || return 1

  nohup xcrun simctl spawn "$UDID" log stream \
    --style compact \
    --level debug \
    --predicate "$PEEKPOP_CAPTURE_PREDICATE" \
    </dev/null >"$PEEKPOP_CAPTURE_RAW" 2>"$PEEKPOP_CAPTURE_STDERR" &
  PEEKPOP_LOG_STREAM_PID=$!
  disown "$PEEKPOP_LOG_STREAM_PID" 2>/dev/null || true

  for _ in $(seq 1 12); do
    if ! kill -0 "$PEEKPOP_LOG_STREAM_PID" 2>/dev/null; then
      wait "$PEEKPOP_LOG_STREAM_PID" 2>/dev/null || true
      rm -f "$PEEKPOP_CAPTURE_RAW" "$PEEKPOP_CAPTURE_STDERR"
      echo "::error::simctl log stream exited before OSLog capture became active"
      return 1
    fi
    sleep 0.25
  done
  peekpop_capture_record_start
}

peekpop_capture_start_synthetic() {
  peekpop_capture_prepare_paths || return 1
  local category index=0
  : > "$PEEKPOP_CAPTURE_RAW"
  for category in "${PEEKPOP_CAPTURE_CATEGORIES[@]}"; do
    index=$((index + 1))
    printf '2026-10-10T00:00:%02dZ %s synthetic_event=peekpop-smoke-%s\n' \
      "$index" "$category" "$index" >> "$PEEKPOP_CAPTURE_RAW"
  done
  : > "$PEEKPOP_CAPTURE_STDERR"

  # shellcheck disable=SC2217 # Keep the synthetic process detached from step pipes.
  sleep 600 </dev/null >/dev/null 2>&1 &
  PEEKPOP_LOG_STREAM_PID=$!
  peekpop_capture_record_start
  echo "Synthetic OSLog category events prepared without financial data"
}

peekpop_capture_stop_stream() {
  local pid="${PEEKPOP_LOG_STREAM_PID:-}"
  if [[ ! "$pid" =~ ^[0-9]+$ ]]; then
    echo "::error::OSLog capture has no valid stream process id"
    return 1
  fi

  kill -TERM "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  for _ in $(seq 1 50); do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.1
  done

  echo "::warning::OSLog stream did not stop after SIGTERM; requesting SIGKILL"
  kill -KILL "$pid" 2>/dev/null || true
  for _ in $(seq 1 20); do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.1
  done

  echo "::error::OSLog stream is still running; refusing to encrypt an incomplete capture"
  return 1
}

peekpop_capture_finish() {
  local outcome="${1:-completed}"
  if [ "${PEEKPOP_CAPTURE_ACTIVE:-false}" != "true" ]; then
    return 0
  fi

  peekpop_capture_configure_categories || return 1
  if ! peekpop_capture_stop_stream; then
    rm -f "$PEEKPOP_CAPTURE_RAW" "$PEEKPOP_CAPTURE_STDERR"
    PEEKPOP_CAPTURE_ACTIVE=false
    return 1
  fi

  local event_count finish_at ciphertext_sha256
  event_count=$(awk -v selected="$PEEKPOP_CAPTURE_CATEGORIES_CSV" '
    BEGIN { category_count = split(selected, categories, ",") }
    {
      for (i = 1; i <= category_count; i++) {
        if (index($0, categories[i]) > 0) {
          matching_records += 1
          break
        }
      }
    }
    END { print matching_records + 0 }
  ' "$PEEKPOP_CAPTURE_RAW")
  finish_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  if ! age -r "$PEEKPOP_LOG_AGE_RECIPIENT" \
    -o "$PEEKPOP_CAPTURE_FILE" "$PEEKPOP_CAPTURE_RAW" >/dev/null 2>&1; then
    rm -f "$PEEKPOP_CAPTURE_FILE" "$PEEKPOP_CAPTURE_RAW" "$PEEKPOP_CAPTURE_STDERR"
    PEEKPOP_CAPTURE_ACTIVE=false
    echo "::error::OSLog capture could not be encrypted; no log artifact was created"
    return 1
  fi
  if [ ! -s "$PEEKPOP_CAPTURE_FILE" ]; then
    rm -f "$PEEKPOP_CAPTURE_FILE" "$PEEKPOP_CAPTURE_RAW" "$PEEKPOP_CAPTURE_STDERR"
    PEEKPOP_CAPTURE_ACTIVE=false
    echo "::error::age returned an empty OSLog ciphertext"
    return 1
  fi

  if ! ciphertext_sha256=$(python3 -c 'import hashlib, sys; f=open(sys.argv[1], "rb"); h=hashlib.sha256(); [h.update(chunk) for chunk in iter(lambda: f.read(1048576), b"")]; print(h.hexdigest())' "$PEEKPOP_CAPTURE_FILE") \
     || [[ ! "$ciphertext_sha256" =~ ^[0-9a-f]{64}$ ]]; then
    rm -f "$PEEKPOP_CAPTURE_FILE" "$PEEKPOP_CAPTURE_MANIFEST" "$PEEKPOP_CAPTURE_RAW" "$PEEKPOP_CAPTURE_STDERR"
    PEEKPOP_CAPTURE_ACTIVE=false
    echo "::error::Could not calculate the OSLog ciphertext SHA-256"
    return 1
  fi

  if ! PEEKPOP_CAPTURE_CATEGORIES_JSON="$PEEKPOP_CAPTURE_CATEGORIES_JSON" \
    PEEKPOP_CAPTURE_PREDICATE="$PEEKPOP_CAPTURE_PREDICATE" \
    PEEKPOP_CAPTURE_EVENT_COUNT="$event_count" \
    PEEKPOP_CAPTURE_STARTED_AT="$PEEKPOP_CAPTURE_STARTED_AT" \
    PEEKPOP_CAPTURE_FINISHED_AT="$finish_at" \
    PEEKPOP_CAPTURE_OUTCOME="$outcome" \
    PEEKPOP_CAPTURE_CIPHERTEXT_SHA256="$ciphertext_sha256" \
      python3 - "$PEEKPOP_CAPTURE_MANIFEST" <<'PY'
import json
import os
import sys

categories = json.loads(os.environ["PEEKPOP_CAPTURE_CATEGORIES_JSON"])
manifest = {
    "schema_version": 2,
    "repository": os.environ["GITHUB_REPOSITORY"],
    "run_id": os.environ["GITHUB_RUN_ID"],
    "run_attempt": os.environ["GITHUB_RUN_ATTEMPT"],
    "session": os.environ.get("SESSION_ID", ""),
    "commit": os.environ["GITHUB_SHA"],
    "category": categories[0],
    "categories": categories,
    "predicate": os.environ["PEEKPOP_CAPTURE_PREDICATE"],
    "stream_level": "debug",
    "started_at_utc": os.environ["PEEKPOP_CAPTURE_STARTED_AT"],
    "finished_at_utc": os.environ["PEEKPOP_CAPTURE_FINISHED_AT"],
    "event_count": int(os.environ["PEEKPOP_CAPTURE_EVENT_COUNT"]),
    "capture_outcome": os.environ["PEEKPOP_CAPTURE_OUTCOME"],
    "ciphertext_sha256": os.environ["PEEKPOP_CAPTURE_CIPHERTEXT_SHA256"],
}
with open(sys.argv[1], "w", encoding="utf-8", newline="\n") as manifest_file:
    json.dump(manifest, manifest_file, ensure_ascii=False, indent=2)
    manifest_file.write("\n")
PY
  then
    rm -f "$PEEKPOP_CAPTURE_FILE" "$PEEKPOP_CAPTURE_MANIFEST" "$PEEKPOP_CAPTURE_RAW" "$PEEKPOP_CAPTURE_STDERR"
    PEEKPOP_CAPTURE_ACTIVE=false
    echo "::error::Could not write the OSLog capture manifest; no artifact was created"
    return 1
  fi

  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "artifact_ready=true" >> "$GITHUB_OUTPUT"
  fi
  rm -f "$PEEKPOP_CAPTURE_RAW" "$PEEKPOP_CAPTURE_STDERR"
  PEEKPOP_CAPTURE_ACTIVE=false
  echo "OSLog capture finalized; matching record count: $event_count"

  if [ "$event_count" -eq 0 ]; then
    echo "::error::No OSLog events were received for the selected categories; encrypted evidence and a zero-event manifest were saved"
    return 2
  fi
}
