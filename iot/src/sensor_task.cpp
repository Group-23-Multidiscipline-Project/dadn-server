#include "sensor_task.h"
#include <Arduino.h>

// Include tất cả các module phần cứng
#include "dht20_sensor.h"
#include "soil_sensor.h"
#include "light_sensor.h"
#include "pump_relay.h"
#include "lcd_display.h"

void TaskReadSensors(void *pvParameters) {
  // Khởi tạo toàn bộ thiết bị (Chỉ chạy 1 lần)
  dht20_init();
  soil_sensor_init();
  light_sensor_init();
  pump_init();
  lcd_init();

  Serial.println("[SYSTEM] Đã khởi tạo xong phần cứng.");

  // Vòng lặp vĩnh cửu của FreeRTOS Task
  while(1) {
    dht20_read_data();
    soil_sensor_read_data();
    light_sensor_read_data();

    // Cập nhật màn hình LCD
    lcd_update_data();
    
    // Log ra Serial để dễ debug khi cắm cáp
    Serial.println("--- ĐÃ CẬP NHẬT CẢM BIẾN ---");

    vTaskDelay(5000 / portTICK_PERIOD_MS);
  }
}