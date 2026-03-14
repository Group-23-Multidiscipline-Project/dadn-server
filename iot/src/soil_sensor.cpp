#include "soil_sensor.h"
#include <Arduino.h>
#include "globals.h"

void soil_sensor_init() {
  pinMode(SOIL_MOISTURE_PIN, INPUT);
}

void soil_sensor_read_data() {
  int rawSoil = analogRead(SOIL_MOISTURE_PIN);
  
  // ESP32 ADC có độ phân giải 12-bit (0-4095). 
  // Cần map về 0-100%. Tùy loại cảm biến mà lúc khô nhất có thể là 0 hoặc 4095.
  // Nếu cảm biến cắm vào nước mà ra 0, để ở ngoài không khí ra 4095 thì giữ nguyên hàm map dưới đây.
  currentSoilMoisture = constrain(map(rawSoil, 4095, 0, 0, 100), 0, 100);
}