#include <Arduino.h>
#include "globals.h"

float currentAirTemp = 0.0;
float currentAirHumidity = 0.0;
float currentSoilMoisture = 0.0;
float currentLightLevel = 0.0;

bool isPumpOn = false;

float durationTime = 0.0;
int remainingTime = 0;
bool isTimerActive = false;
bool isRecovering = false;
