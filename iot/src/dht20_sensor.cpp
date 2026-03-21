#include <Arduino.h>
#include "dht20_sensor.h"
#include <Wire.h>
#include <DHT20.h>
#include "globals.h" 


DHT20 dht;

void dht20_init() {
  Wire.begin(); 
  dht.begin();
}

void dht20_read_data() {
  dht.read();
  
  currentAirTemp = dht.getTemperature();
  currentAirHumidity = dht.getHumidity();
}