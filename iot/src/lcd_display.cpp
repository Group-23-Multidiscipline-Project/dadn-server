#include <Arduino.h>
#include "lcd_display.h"
#include <LiquidCrystal_I2C.h>
#include "globals.h"

// Screen size: 16 columns, 2 lines
LiquidCrystal_I2C lcd(0x21, 16, 2); 

void lcd_init() {
  lcd.init();
  lcd.backlight(); 
  
  // Show greetings
  lcd.setCursor(0, 0);
  lcd.print(" IoT YoloFarm ");
  lcd.setCursor(0, 1);
  lcd.print(" Starting...  ");
  delay(2000); 
}

void lcd_update_data() {
  lcd.clear(); 
  
  if (isTimerActive && isPumpOn) {
    lcd.setCursor(0, 0);
    lcd.print("Watering:...");
    lcd.setCursor(0, 1);
    lcd.print("Time left: ");
    lcd.print(remainingTime);
    lcd.print("s");
  }
  else if (isTimerActive && isRecovering) {
    lcd.setCursor(0, 0);
    lcd.print("Recovering:...");
    lcd.setCursor(0, 1);
    lcd.print("Time left: ");
    lcd.print(remainingTime);
    lcd.print("s");
  }
  else {
    lcd.setCursor(0, 0);
    lcd.print("T:"); lcd.print(currentAirTemp, 1); lcd.print("C");
    lcd.setCursor(9, 0); 
    lcd.print("H:"); lcd.print(currentAirHumidity, 0); lcd.print("%");


    lcd.setCursor(0, 1);
    lcd.print("S:"); lcd.print(currentSoilMoisture, 0); lcd.print("%");
    lcd.setCursor(9, 1);
    lcd.print("L:"); lcd.print(currentLightLevel, 0); lcd.print("%");
  }
}
