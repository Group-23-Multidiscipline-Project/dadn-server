#include <Arduino.h>
#include "sensor_task.h"
#include "dht20_sensor.h"
#include "soil_sensor.h"
#include "light_sensor.h"
#include "pump_relay.h"
#include "lcd_display.h"
#include "globals.h"
#include "mqtt_task.h"

void TaskReadSensors(void *pvParameters) {
  dht20_init();
  soil_sensor_init();
  light_sensor_init();
  pump_init();
  lcd_init();

  Serial.println("[SYSTEM] Đã khởi tạo xong phần cứng.");

  int sensorReadCounter = 0;  // The counter reads the sensor every 5 seconds

  while(1) {
    if (isTimerActive) {
      remainingTime--;
      if (remainingTime <= 0) {
        isTimerActive = false;

        if (isPumpOn) {
          // Case 1: Just finished watering countdown
          Serial.println("[TIMER] Đã hết thời gian bơm, gửi WATERING done.");
          pump_turn_off();
          publish_pump_status();
          publish_confirm("WATERING done");
        }
        else if (isRecovering) {
          // Case 2: Just finished the recovery countdown
          Serial.println("[TIMER] Đã hết thời gian recover, gửi RECOVERING done.");
          isRecovering = false;
          publish_pump_status();
          publish_confirm("RECOVERING done");
        }
      }
    }

    if (sensorReadCounter == 0) {
      dht20_read_data();
      soil_sensor_read_data();
      light_sensor_read_data();

      Serial.printf("Data: T=%.1f, H=%.1f, S=%.1f, L=%.1f | Bơm: %s | Mode: %s\n", 
                    currentAirTemp, currentAirHumidity, currentSoilMoisture, currentLightLevel,
                    isPumpOn ? "ON" : "OFF",
                    isRecovering ? "RECOVERING" : "MANUAL");
    }
    

    // LCD UPDATE
    lcd_update_data();
    
    sensorReadCounter++;
    if (sensorReadCounter >= 5) {
      sensorReadCounter = 0;
    }

    vTaskDelay(1000 / portTICK_PERIOD_MS);
  }
}