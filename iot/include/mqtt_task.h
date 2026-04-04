#ifndef MQTT_TASK_H
#define MQTT_TASK_H

#include <Arduino.h>

void TaskMQTT(void *pvParameters);

// void publish_pump_status();

void publish_confirm(String message);

#endif