#include "mqtt_task.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "globals.h"    
#include "pump_relay.h" 

// Cấu hình mạng
const char* ssid = "TEN_WIFI_CUA_BAN";
const char* password = "MAT_KHAU_WIFI";
const char* mqtt_server = "192.168.1.6"; // IP của máy tính chạy backend
const int mqtt_port = 1883;

// Cấu hình topic
const String NODE_ID = "node_01"; 
String soil_topic = "yolofarm/" + NODE_ID + "/sensors/soil_moisture";
String air_topic = "yolofarm/" + NODE_ID + "/sensors/air_humidity";
String control_topic = "yolofarm/" + NODE_ID + "/control/irrigation";

WiFiClient espClient;
PubSubClient client(espClient);

// Hàm callback được gọi mỗi khi có tin nhắn điều khiển từ Backend gửi xuống
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String messageTemp;
  for (int i = 0; i < length; i++) {
    messageTemp += (char)payload[i];
  }
  
  // Phân tích chuỗi JSON nhận được
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, messageTemp);
  
  if (error) {
    Serial.print("[MQTT] Lỗi parse JSON: ");
    Serial.println(error.c_str());
    return;
  }

  // Lấy giá trị action ("WATER_ON" hoặc "WATER_OFF")
  String action = doc["action"].as<String>();

  if (action == "WATER_ON") {
    pump_turn_on();   // Kích hoạt Relay
  } else if (action == "WATER_OFF") {
    pump_turn_off();  // Tắt Relay
  }
}

// Task chạy độc lập trong FreeRTOS
void TaskMQTT(void *pvParameters) {
  // Kết nối wifi
  Serial.print("[WiFi] Đang kết nối...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    vTaskDelay(500 / portTICK_PERIOD_MS);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Đã kết nối!");

  // Cấu hình MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);

  unsigned long lastPublish = 0;
  const unsigned long PUBLISH_INTERVAL = 10000;   // Cứ 10 giây gửi dữ liệu 1 lần

  // Vòng lặp vĩnh cửu của Task
  while (1) {
    // Giữ kết nối MQTT Broker
    if (!client.connected()) {
      Serial.println("[MQTT] Đang kết nối Broker...");
      String clientId = "YoloBit-" + String(random(0xffff), HEX);
      
      if (client.connect(clientId.c_str())) {
        Serial.println("[MQTT] Thành công!");
        // Đăng ký nhận lệnh từ Backend ngay khi kết nối thành công
        client.subscribe(control_topic.c_str()); 
      } else {
        Serial.print("[MQTT] Thất bại, thử lại sau 5s...");
        vTaskDelay(5000 / portTICK_PERIOD_MS); 
        continue; // Bỏ qua phần dưới để chạy lại vòng lặp connect
      }
    }
    
    // Duy trì lắng nghe tin nhắn tới
    client.loop();

    // Gửi dữ liệu định kỳ lên Backend
    unsigned long now = millis();
    if (now - lastPublish > PUBLISH_INTERVAL) {
      lastPublish = now;

      // JSON Độ ẩm đất: {"value": 45.0}
      StaticJsonDocument<100> docSoil;
      docSoil["value"] = currentSoilMoisture;
      char bufferSoil[100];
      serializeJson(docSoil, bufferSoil);
      client.publish(soil_topic.c_str(), bufferSoil);

      // JSON Độ ẩm không khí: {"value": 60.5}
      StaticJsonDocument<100> docAir;
      docAir["value"] = currentAirHumidity;
      char bufferAir[100];
      serializeJson(docAir, bufferAir);
      client.publish(air_topic.c_str(), bufferAir);
      
      Serial.printf("[MQTT] Publish -> Soil: %.1f%% | Air Hum: %.1f%%\n", currentSoilMoisture, currentAirHumidity);
    }

    // Delay 10ms để FreeRTOS có thể chuyển ngữ cảnh sang Task khác
    vTaskDelay(10 / portTICK_PERIOD_MS); 
  }
}