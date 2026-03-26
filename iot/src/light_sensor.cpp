#include <Arduino.h>
#include "light_sensor.h"
#include "globals.h"

void light_sensor_init() {
  pinMode(LIGHT_SENSOR_PIN, INPUT);
}

void light_sensor_read_data() {
  int rawLight = analogRead(LIGHT_SENSOR_PIN);
  // Serial.printf("[Raw Light: %d]\n", rawLight); 
  currentLightLevel = constrain(map(rawLight, 0, 4095, 0, 100), 0, 100);
}