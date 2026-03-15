#include "mqtt_task.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include "globals.h"    
#include "pump_relay.h" 

// Cấu hình mạng
const char* ssid = "TEN_WIFI_CUA_BAN";
const char* password = "MAT_KHAU_WIFI";
const char* mqtt_server = "370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "admin";
const char* mqtt_pass = "Yolofarm23";

// Cấu hình topic
const String NODE_ID = "node_01"; 
String soil_topic = "yolofarm/" + NODE_ID + "/sensors/soil_moisture";
String air_topic = "yolofarm/" + NODE_ID + "/sensors/light";
String control_topic = "yolofarm/" + NODE_ID + "/control/irrigation";
String status_topic = "yolofarm/" + NODE_ID + "/status/irrigation";

WiFiClientSecure espClient;
PubSubClient client(espClient);

static void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("[NTP] Đang đồng bộ thời gian");
  while (time(nullptr) < 8 * 3600 * 2) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" xong");
}

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

  // Lấy giá trị action ("start_pump" hoặc "stop_pump")
  String action = doc["action"].as<String>();

  if (action == "start_pump") {
    pump_turn_on();   // Kích hoạt Relay
  } else if (action == "stop_pump") {
    pump_turn_off();  // Tắt Relay
  }
}

// Task chạy độc lập trong FreeRTOS
void TaskMQTT(void *pvParameters) {
  // Kết nối wifi
  Serial.print("[WiFi] Đang kết nối...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    vTaskDelay(500 / portTICK_PERIOD_MS);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Đã kết nối!");

  randomSeed(micros());
  syncTime();

  // Tạm thời bỏ qua kiểm tra CA để kết nối HiveMQ Cloud nhanh hơn.
  // Với môi trường production, nên thay bằng espClient.setCACert(...).
  espClient.setInsecure();

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
      
      if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
        Serial.println("[MQTT] Thành công!");
        // Đăng ký nhận lệnh từ Backend ngay khi kết nối thành công
        client.subscribe(control_topic.c_str()); 
      } else {
        Serial.print("[MQTT] Thất bại, rc=");
        Serial.print(client.state());
        Serial.println(", thử lại sau 5s...");
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

      // JSON Cuong do anh sang: {"value": 300}
      StaticJsonDocument<100> docLight;
      docLight["value"] = currentLightLevel;
      char bufferLight[100];
      serializeJson(docLight, bufferLight);
      client.publish(air_topic.c_str(), bufferLight);
      
      Serial.printf("[MQTT] Publish -> Soil: %.1f%% | Light: %.1f%%\n", currentSoilMoisture, currentLightLevel);
    }

    // Delay 10ms để FreeRTOS có thể chuyển ngữ cảnh sang Task khác
    vTaskDelay(10 / portTICK_PERIOD_MS); 
  }
}