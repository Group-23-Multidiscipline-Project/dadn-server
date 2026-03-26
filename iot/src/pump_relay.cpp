#include <Arduino.h>
#include <pump_relay.h>
#include <globals.h>

void pump_init() {
  pinMode(RELAY_PUMP_PIN, OUTPUT);
  digitalWrite(RELAY_PUMP_PIN, LOW); 
  isPumpOn = false;
}

void pump_turn_on() {
  digitalWrite(RELAY_PUMP_PIN, HIGH);
  isPumpOn = true;
  Serial.println("[BƠM] Đang hoạt động!");
}

void pump_turn_off() {
  digitalWrite(RELAY_PUMP_PIN, LOW);
  isPumpOn = false;
  Serial.println("[BƠM] Đã tắt!");
}