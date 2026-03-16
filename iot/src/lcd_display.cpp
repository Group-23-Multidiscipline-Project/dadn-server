#include <Arduino.h>
#include "lcd_display.h"
#include <LiquidCrystal_I2C.h>
#include "globals.h"

// Khởi tạo đối tượng LCD. Địa chỉ I2C phổ biến nhất của module chuyển đổi là 0x27.
// Kích thước màn hình: 16 cột, 2 dòng.
LiquidCrystal_I2C lcd(0x27, 16, 2); 

void lcd_init() {
  lcd.init();
  lcd.backlight(); // Bật đèn nền
  
  // Hiển thị lời chào lúc hệ thống mới khởi động
  lcd.setCursor(0, 0);
  lcd.print(" IoT YoloFarm ");
  lcd.setCursor(0, 1);
  lcd.print(" Starting...  ");
  delay(2000); // Dừng 2 giây để đọc lời chào
}

void lcd_update_data() {
  lcd.clear(); // Xóa màn hình cũ trước khi in dữ liệu mới
  
  // Dòng 1: Nhiệt độ (T) và Độ ẩm không khí (H)
  // Ví dụ in ra: T:30.5C  H:60%
  lcd.setCursor(0, 0);
  lcd.print("T:"); lcd.print(currentAirTemp, 1); lcd.print("C");
  
  lcd.setCursor(9, 0); // Dời con trỏ sang cột 9
  lcd.print("H:"); lcd.print(currentAirHumidity, 0); lcd.print("%");

  // Dòng 2: Độ ẩm đất (S) và Ánh sáng (L)
  // Ví dụ in ra: S:45%    L:80%
  lcd.setCursor(0, 1);
  lcd.print("S:"); lcd.print(currentSoilMoisture, 0); lcd.print("%");
  
  lcd.setCursor(9, 1);
  lcd.print("L:"); lcd.print(currentLightLevel, 0); lcd.print("%");
}