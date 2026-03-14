#include<led_blinky.h>

void TaskLEDControl(void *pvParameters) {
  pinMode(GPIO_NUM_48, OUTPUT); // Initialize LED pin
  int ledState = 0;
  while(1) {
    
    if (ledState == 0) {
      digitalWrite(GPIO_NUM_48, HIGH); // ON LED
    } else {
      digitalWrite(GPIO_NUM_48, LOW); // OFF LED
    }
    ledState = 1 - ledState;
    vTaskDelay(500);
  }
}