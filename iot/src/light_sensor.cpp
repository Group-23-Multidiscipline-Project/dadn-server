#include "light_sensor.h"
#include <Arduino.h>
#include "globals.h"

void light_sensor_init() {
  pinMode(LIGHT_SENSOR_PIN, INPUT);
}

void light_sensor_read_data() {
  int rawLight = analogRead(LIGHT_SENSOR_PIN);
  
  // ESP32 ADC đọc từ 0 đến 4095. Tùy thuộc vào mạch cảm biến ánh sáng (dùng quang trở),
  // giá trị này có thể tỉ lệ thuận hoặc nghịch với cường độ sáng.
  // Mặc định ở đây ta map 0->0% và 4095->100%.
  currentLightLevel = constrain(map(rawLight, 0, 4095, 0, 100), 0, 100);
}