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
  
  // Khởi tạo Task Đọc Cảm Biến
  // Stack: 4096 bytes, Priority: 1 (Bình thường)
  xTaskCreate(TaskReadSensors, "SensorTask", 4096, NULL, 1, NULL);
  
  // Khởi tạo Task Truyền thông MQTT
  // Stack: 8192 bytes (Cần nhiều RAM hơn để xử lý WiFi và JSON), Priority: 2 (Ưu tiên cao hơn chút để tránh rớt mạng)
  xTaskCreate(TaskMQTT, "MQTTTask", 8192, NULL, 2, NULL);
}

void loop() {
  vTaskDelete(NULL); 
}