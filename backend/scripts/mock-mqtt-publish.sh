#!/usr/bin/env bash
set -euo pipefail

# State-machine scenario script (5 test cases).
# Usage:
#   bash scripts/mock-mqtt-publish.sh
#
# Optional env vars:
#   MQTT_HOST=localhost
#   MQTT_PORT=1883
#   MQTT_TOPIC_BASE=yolofarm
#   MQTT_NODE_ID=node_01
#   MQTT_QOS=0
#   API_BASE_URL=http://localhost:3000
#   PROCESSING_DELAY_SEC=1
#   WATERING_WAIT_SEC=6
#   RECOVER_WAIT_SEC=3
#   TEST_CASE=all|1|2|3|4|5

MQTT_HOST="${MQTT_HOST:-localhost}"
MQTT_PORT="${MQTT_PORT:-1883}"
MQTT_TOPIC_BASE="${MQTT_TOPIC_BASE:-yolofarm}"
MQTT_NODE_ID="${MQTT_NODE_ID:-node_01}"
MQTT_QOS="${MQTT_QOS:-0}"
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
PROCESSING_DELAY_SEC="${PROCESSING_DELAY_SEC:-1}"
WATERING_WAIT_SEC="${WATERING_WAIT_SEC:-6}"
RECOVER_WAIT_SEC="${RECOVER_WAIT_SEC:-3}"
TEST_CASE="${TEST_CASE:-all}"

if ! command -v mosquitto_pub >/dev/null 2>&1; then
  echo "[ERROR] mosquitto_pub not found. Install Mosquitto clients first." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "[ERROR] curl not found." >&2
  exit 1
fi

log_info() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

print_response() {
  local label="$1"
  local payload="$2"

  if command -v jq >/dev/null 2>&1; then
    echo "${payload}" | jq -c .
  else
    echo "${label}: ${payload}"
  fi
}

publish_sensor() {
  local sensor="$1"
  local value="$2"
  local topic="${MQTT_TOPIC_BASE}/${MQTT_NODE_ID}/sensors/${sensor}"
  local payload="{\"value\":${value}}"

  mosquitto_pub \
    -h "${MQTT_HOST}" \
    -p "${MQTT_PORT}" \
    -q "${MQTT_QOS}" \
    -t "${topic}" \
    -m "${payload}"

  log_info "published ${topic} ${payload}"
}

publish_pair() {
  local humidity="$1"
  local light="$2"

  publish_sensor "soil_moisture" "${humidity}"
  publish_sensor "light" "${light}"
  sleep "${PROCESSING_DELAY_SEC}"
}

confirm_watering() {
  local payload
  payload="{\"deviceId\":\"${MQTT_NODE_ID}\",\"state\":\"WATERING done\"}"

  local response
  response="$(curl -sS \
    -X POST "${API_BASE_URL}/sensor-data/confirm" \
    -H "Content-Type: application/json" \
    -d "${payload}")"

  print_response "confirm" "${response}"
}

get_state() {
  local response
  response="$(curl -sS "${API_BASE_URL}/state/${MQTT_NODE_ID}")"
  print_response "state" "${response}"
}

run_case_1() {
  log_info "Case 1: MONITOR -> MONITOR (khong dat nguong)"
  publish_pair 40 600
  get_state
}

run_case_2() {
  log_info "Case 2: MONITOR -> WATERING (dat nguong kho han)"
  publish_pair 10 600
  get_state
}

run_case_3() {
  log_info "Case 3: WATERING, timer chua het"
  confirm_watering
  get_state
}

run_case_4() {
  log_info "Case 4: cho ${WATERING_WAIT_SEC}s de het WATERING, sau do -> RECOVER"
  sleep "${WATERING_WAIT_SEC}"
  confirm_watering
  get_state
}

run_case_5() {
  log_info "Case 5: cho ${RECOVER_WAIT_SEC}s de het RECOVER, gui data moi -> MONITOR"
  sleep "${RECOVER_WAIT_SEC}"
  publish_pair 35 550
  get_state
}

run_all_cases() {
  run_case_1
  run_case_2
  run_case_3
  run_case_4
  run_case_5
}

log_info "Start state-machine scenario"
log_info "broker=${MQTT_HOST}:${MQTT_PORT} topicBase=${MQTT_TOPIC_BASE} node=${MQTT_NODE_ID} api=${API_BASE_URL} case=${TEST_CASE}"

case "${TEST_CASE}" in
  all)
    run_all_cases
    ;;
  1)
    run_case_1
    ;;
  2)
    run_case_2
    ;;
  3)
    run_case_3
    ;;
  4)
    run_case_4
    ;;
  5)
    run_case_5
    ;;
  *)
    echo "[ERROR] TEST_CASE must be one of: all, 1, 2, 3, 4, 5" >&2
    exit 1
    ;;
esac

log_info "Done"
