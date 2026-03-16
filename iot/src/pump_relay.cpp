#include <Arduino.h>
#include "pump_relay.h"


void pump_init() {
  pinMode(RELAY_PUMP_PIN, OUTPUT);
  // Đảm bảo khi vừa cấp điện mạch thì bơm phải tắt
  digitalWrite(RELAY_PUMP_PIN, LOW); 
}

void pump_turn_on() {
  digitalWrite(RELAY_PUMP_PIN, HIGH);
  Serial.println("[BƠM] Đang hoạt động!");
}

void pump_turn_off() {
  digitalWrite(RELAY_PUMP_PIN, LOW);
  Serial.println("[BƠM] Đã tắt!");
}