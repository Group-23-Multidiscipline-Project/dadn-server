#include <Arduino.h>
#include "sensor_task.h"
#include "mqtt_task.h"


void setup() {
  Serial.begin(115200);
  Serial.println("\n--- HỆ THỐNG YOLOFARM KHỞI ĐỘNG ---");
  
  // Stack: 4096 bytes, Priority: 1 (Normal)
  xTaskCreate(TaskReadSensors, "SensorTask", 4096, NULL, 1, NULL);
  
  // Stack: 8192 bytes (More RAM is needed to handle WiFi and JSON), Priority: 2 (Slightly higher priority to avoid network drops)
  xTaskCreate(TaskMQTT, "MQTTTask", 8192, NULL, 2, NULL);
}

void loop() {
  vTaskDelete(NULL); 
}