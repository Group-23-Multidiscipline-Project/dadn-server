#include "mqtt_task.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include "globals.h"    
#include "pump_relay.h" 

// Internet config
const char* ssid = "ACLAB";
const char* password = "ACLAB2023";
const char* mqtt_server = "370a418923bb43089cf22b46d5af803f.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "admin";
const char* mqtt_pass = "Yolofarm23";

// Topic config
const String NODE_ID = "node_01"; 
String soil_topic = "yolofarm/" + NODE_ID + "/sensors/soil_moisture";
String light_topic = "yolofarm/" + NODE_ID + "/sensors/light";
String control_topic = "yolofarm/" + NODE_ID + "/control/irrigation";
String status_topic = "yolofarm/" + NODE_ID + "/status/irrigation";
String confirm_topic = "yolofarm/" + NODE_ID + "/sensors/confirm";

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

void publish_confirm(String message) {
  if (client.connected()) {
    StaticJsonDocument<100> docConfirm;
    docConfirm["value"] = message;

    char bufferConfirm[100];
    serializeJson(docConfirm, bufferConfirm);
    client.publish(confirm_topic.c_str(), bufferConfirm);

    Serial.println("[MQTT] Đã gửi xác nhận: " + message);
  }
}

// void publish_pump_status() {
//   if (client.connected()) {
//     StaticJsonDocument<100> docStatus;
//     docStatus["isPumpOn"] = isPumpOn;
//     docStatus["isRecoverMode"] = isRecovering;
//     docStatus["state"] = isRecovering ? "RECOVERING" : (isPumpOn ? "PUMP_ON" : "PUMP_OFF");
    
//     char bufferStatus[100];
//     serializeJson(docStatus, bufferStatus);
//     client.publish(status_topic.c_str(), bufferStatus);
    
//     Serial.println("[MQTT] Đã cập nhật trạng thái Bơm lên Server");
//   }
// }

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String messageTemp;
  for (int i = 0; i < length; i++) {
    messageTemp += (char)payload[i];
  }
  
  // Parse JSON string
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, messageTemp);
  
  if (error) {
    Serial.print("[MQTT] Lỗi parse JSON: ");
    return;
  }

  // Get action value ("start_pump" or "stop_pump")
  String action = doc["action"].as<String>();
  //Serial.println(action);

  if (action == "start_pump") {
    isRecovering = false;
    if (doc.containsKey("durationSeconds")) {
      remainingTime = doc["durationSeconds"].as<int>(); 
      isTimerActive = true;                    
      Serial.printf("[MQTT] Bật bơm trong %d giây\n", remainingTime);
    }
    pump_turn_on();
    //publish_pump_status();
  } else if (action == "recover") {
    isRecovering = true;
    pump_turn_off();  
    if (doc.containsKey("durationSeconds")) {
      remainingTime = doc["durationSeconds"].as<int>();
      isTimerActive = true;
      Serial.printf("[MQTT] Lệnh từ Server: Recovering %d giây\n", remainingTime);
    }
    //publish_pump_status();
  } else if (action == "stop_pump") { 
    isTimerActive = false;
    isRecovering = false;
    remainingTime = 0;
    pump_turn_off();
    //publish_pump_status();
    publish_confirm("WATERING done");
  }
}

void TaskMQTT(void *pvParameters) {
  // Connect wifi
  Serial.print("[WiFi] Đang kết nối...");
  WiFi.mode(WIFI_STA); // Mode station -> client
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    vTaskDelay(500 / portTICK_PERIOD_MS);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Đã kết nối!");

  randomSeed(micros());
  syncTime();

  espClient.setInsecure();

  // MQTT config
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);

  unsigned long lastPublish = 0;
  const unsigned long PUBLISH_INTERVAL = 10000;   

  // Task's loop
  while (1) {
    // Connect MQTT Broker
    if (!client.connected()) {
      Serial.println("[MQTT] Đang kết nối Broker...");
      String clientId = "YoloBit-" + String(random(0xffff), HEX);
      if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
        Serial.println("[MQTT] Thành công!");
        // Receive commands from Backend
        client.subscribe(control_topic.c_str()); 
      } else {
        Serial.print("[MQTT] Thất bại, rc=");
        Serial.print(client.state());
        Serial.println(", thử lại sau 5s...");
        vTaskDelay(5000 / portTICK_PERIOD_MS); 
        continue;   // Skip below to rerun the connect loop
      }
    }
    
    // Keep listening for incoming messages
    client.loop();

    // Send data periodically to the Backend
    unsigned long now = millis();
    if (now - lastPublish > PUBLISH_INTERVAL) {
      lastPublish = now;

      // Do not publish periodic sensor data while watering/recovering.
      if (isPumpOn || isRecovering) {
        Serial.println("[MQTT] Dang watering/recovering, bo qua publish dinh ky.");
      } else {
        // JSON Soil_moisture: {"value": 45.0}
        StaticJsonDocument<100> docSoil;
        docSoil["value"] = currentSoilMoisture;
        char bufferSoil[100];
        serializeJson(docSoil, bufferSoil);
        client.publish(soil_topic.c_str(), bufferSoil);

        // JSON Light-level: {"value": 80}
        StaticJsonDocument<100> docLight;
        docLight["value"] = currentLightLevel;
        char bufferLight[100];
        serializeJson(docLight, bufferLight);
        client.publish(light_topic.c_str(), bufferLight);

        //publish_pump_status();
        Serial.printf("[MQTT] Publish -> Soil: %.1f%% | Light: %.1f%%\n", currentSoilMoisture, currentLightLevel);
      }
    }

    // Delay 10ms 
    vTaskDelay(10 / portTICK_PERIOD_MS); 
  }
}