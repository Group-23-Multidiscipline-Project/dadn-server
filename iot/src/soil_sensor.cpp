#include "soil_sensor.h"
#include <Arduino.h>
#include "globals.h"

void soil_sensor_init() {
  pinMode(SOIL_MOISTURE_PIN, INPUT);
}

void soil_sensor_read_data() {
  int rawSoil = analogRead(SOIL_MOISTURE_PIN);
  
  currentSoilMoisture = map(rawSoil, 0, 4095, 0, 100);
  //Serial.printf("[Raw Soil: %d]\n", rawSoil);
  //currentSoilMoisture = rawSoil;
}