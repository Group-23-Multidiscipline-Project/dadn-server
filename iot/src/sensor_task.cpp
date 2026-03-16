#include <Arduino.h>
#include "sensor_task.h"
#include "dht20_sensor.h"
#include "soil_sensor.h"
#include "light_sensor.h"
#include "pump_relay.h"
#include "lcd_display.h"
#include "globals.h"

void TaskReadSensors(void *pvParameters) {
  // Khởi tạo
  dht20_init();
  soil_sensor_init();
  light_sensor_init();
  pump_init();
  lcd_init();

  Serial.println("[SYSTEM] Đã khởi tạo xong phần cứng.");

  while(1) {
    // 1. Đọc dữ liệu từ cảm biến vào các biến global
    dht20_read_data();
    soil_sensor_read_data();
    light_sensor_read_data();

    // 2. Xuất ra Serial Monitor để debug
    Serial.printf("Data: T=%.1f, H=%.1f, S=%.1f, L=%.1f\n", 
                  currentAirTemp, currentAirHumidity, currentSoilMoisture, currentLightLevel);

    // 3. Xuất ra màn hình LCD
    lcd_update_data();
    
    // Đợi 5 giây cho lần cập nhật kế tiếp
    vTaskDelay(10000 / portTICK_PERIOD_MS);
  }
}