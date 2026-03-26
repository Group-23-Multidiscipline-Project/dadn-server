#include <Arduino.h>
#include "sensor_task.h"
#include "mqtt_task.h"
//#include "led_blinky.h"
//#include "neo_blinky.h"

void setup() {
  Serial.begin(115200);
  Serial.println("\n--- HỆ THỐNG YOLOFARM KHỞI ĐỘNG ---");
  
  //xTaskCreate(TaskLEDControl, "LED Control", 2048, NULL, 2, NULL);
  //xTaskCreate(neo_blinky, "NEO control", 4096, NULL, 2, NULL);
  
  // Stack: 4096 bytes, Priority: 1 (Normal)
  xTaskCreate(TaskReadSensors, "SensorTask", 4096, NULL, 1, NULL);
  
  // Stack: 8192 bytes (More RAM is needed to handle WiFi and JSON), Priority: 2 (Slightly higher priority to avoid network drops)
  xTaskCreate(TaskMQTT, "MQTTTask", 8192, NULL, 2, NULL);
}

void loop() {
  vTaskDelete(NULL); 
}