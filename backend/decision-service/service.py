import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import numpy as np
import paho.mqtt.client as mqtt
import skfuzzy as fuzz
from skfuzzy import control as ctrl

SENSOR_SOIL_TOPIC = 'yolofarm/+/sensors/soil_moisture'
SENSOR_AIR_HUMIDITY_TOPIC = 'yolofarm/+/sensors/air_humidity'
DISEASE_RISK_TOPIC = 'yolofarm/+/ai/disease_risk'


@dataclass
class NodeState:
    soil_moisture: float | None = None
    air_humidity: float | None = None
    disease_risk: float = 0.0
    last_published_at: float = 0.0


class DecisionService:
    def __init__(self) -> None:
        self.mqtt_url = os.getenv('MQTT_URL', 'mqtt://localhost:1883')
        self.mqtt_username = os.getenv('MQTT_USERNAME')
        self.mqtt_password = os.getenv('MQTT_PASSWORD')
        self.publish_cooldown_sec = float(os.getenv('PUBLISH_COOLDOWN_SEC', '10'))
        self.base_moisture_threshold = float(
            os.getenv('BASE_MOISTURE_THRESHOLD', '35'),
        )

        self.host, self.port = self._parse_mqtt_url(self.mqtt_url)
        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=os.getenv('MQTT_CLIENT_ID', 'decision-service'),
        )

        if self.mqtt_username and self.mqtt_password:
            self.client.username_pw_set(self.mqtt_username, self.mqtt_password)

        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message

        self.node_states: dict[str, NodeState] = {}
        self.decision_engine = self._build_fuzzy_engine()

    def _build_fuzzy_engine(self) -> ctrl.ControlSystemSimulation:
        soil_moisture = ctrl.Antecedent(np.arange(0, 101, 1), 'soil_moisture')
        disease_risk = ctrl.Antecedent(np.arange(0, 1.01, 0.01), 'disease_risk')
        irrigation_need = ctrl.Consequent(np.arange(0, 101, 1), 'irrigation_need')

        soil_moisture['dry'] = fuzz.trimf(soil_moisture.universe, [0, 0, 45])
        soil_moisture['normal'] = fuzz.trimf(soil_moisture.universe, [30, 50, 70])
        soil_moisture['wet'] = fuzz.trimf(soil_moisture.universe, [55, 100, 100])

        disease_risk['low'] = fuzz.trimf(disease_risk.universe, [0, 0, 0.4])
        disease_risk['medium'] = fuzz.trimf(disease_risk.universe, [0.2, 0.5, 0.8])
        disease_risk['high'] = fuzz.trimf(disease_risk.universe, [0.6, 1, 1])

        irrigation_need['very_low'] = fuzz.trimf(irrigation_need.universe, [0, 0, 30])
        irrigation_need['low'] = fuzz.trimf(irrigation_need.universe, [15, 35, 55])
        irrigation_need['medium'] = fuzz.trimf(irrigation_need.universe, [45, 60, 75])
        irrigation_need['high'] = fuzz.trimf(irrigation_need.universe, [65, 100, 100])

        rules = [
            ctrl.Rule(soil_moisture['dry'] & disease_risk['low'], irrigation_need['high']),
            ctrl.Rule(
                soil_moisture['dry'] & disease_risk['medium'],
                irrigation_need['medium'],
            ),
            ctrl.Rule(soil_moisture['dry'] & disease_risk['high'], irrigation_need['low']),
            ctrl.Rule(
                soil_moisture['normal'] & disease_risk['low'],
                irrigation_need['low'],
            ),
            ctrl.Rule(
                soil_moisture['normal'] & disease_risk['high'],
                irrigation_need['very_low'],
            ),
            ctrl.Rule(soil_moisture['wet'], irrigation_need['very_low']),
        ]

        return ctrl.ControlSystemSimulation(ctrl.ControlSystem(rules))

    def on_connect(
        self,
        client: mqtt.Client,
        _: Any,
        __: Any,
        reason_code: Any,
        ___: Any,
    ) -> None:
        print(f'Connected to MQTT with reason code: {reason_code}')
        client.subscribe(
            [
                (SENSOR_SOIL_TOPIC, 1),
                (SENSOR_AIR_HUMIDITY_TOPIC, 1),
                (DISEASE_RISK_TOPIC, 1),
            ],
        )

    def on_message(self, client: mqtt.Client, _: Any, msg: mqtt.MQTTMessage) -> None:
        topic = msg.topic
        payload = self._parse_json_payload(msg.payload)

        if payload is None:
            print(f'Invalid payload on topic {topic}')
            return

        topic_parts = topic.split('/')
        if len(topic_parts) < 4:
            return

        node_id = topic_parts[1]
        node_state = self.node_states.setdefault(node_id, NodeState())

        if topic.startswith('yolofarm/') and '/sensors/soil_moisture' in topic:
            moisture = self._extract_float(payload, ['value', 'soil_moisture'])
            if moisture is None:
                return
            node_state.soil_moisture = max(0.0, min(100.0, moisture))

        elif topic.startswith('yolofarm/') and '/sensors/air_humidity' in topic:
            humidity = self._extract_float(payload, ['value', 'air_humidity'])
            if humidity is None:
                return
            node_state.air_humidity = max(0.0, min(100.0, humidity))

        elif topic.startswith('yolofarm/') and '/ai/disease_risk' in topic:
            risk = self._extract_float(payload, ['risk', 'value', 'disease_risk'])
            if risk is None and isinstance(payload.get('is_diseased'), bool):
                risk = 0.9 if payload['is_diseased'] else 0.1
            if risk is None:
                return
            node_state.disease_risk = max(0.0, min(1.0, risk))

        self._evaluate_and_publish(client, node_id, node_state)

    def _evaluate_and_publish(
        self,
        client: mqtt.Client,
        node_id: str,
        node_state: NodeState,
    ) -> None:
        if node_state.soil_moisture is None:
            return

        now = time.time()
        if now - node_state.last_published_at < self.publish_cooldown_sec:
            return

        air_humidity = node_state.air_humidity if node_state.air_humidity is not None else 50.0

        self.decision_engine.input['soil_moisture'] = node_state.soil_moisture
        self.decision_engine.input['disease_risk'] = node_state.disease_risk
        self.decision_engine.compute()

        decision_score = float(self.decision_engine.output['irrigation_need'])

        humidity_adjust = (air_humidity - 50.0) * 0.1
        adjusted_threshold = self.base_moisture_threshold + (node_state.disease_risk * 15.0) + humidity_adjust
        adjusted_threshold = max(20.0, min(70.0, adjusted_threshold))

        should_irrigate = (
            node_state.soil_moisture < adjusted_threshold and decision_score >= 50.0
        )

        moisture_gap = max(0.0, adjusted_threshold - node_state.soil_moisture)
        duration_sec = int(min(120, max(10, moisture_gap * 2))) if should_irrigate else 0

        command_payload = {
            'action': 'WATER_ON' if should_irrigate else 'WATER_OFF',
            'should_irrigate': should_irrigate,
            'duration_sec': duration_sec,
            'reason': 'fuzzy_decision_with_disease_risk',
            'decision_score': round(decision_score, 2),
            'disease_risk': round(node_state.disease_risk, 3),
            'soil_moisture': round(node_state.soil_moisture, 2),
            'air_humidity': round(air_humidity, 2),
            'adjusted_threshold': round(adjusted_threshold, 2),
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }

        control_topic = f'yolofarm/{node_id}/control/irrigation'
        status_topic = f'yolofarm/{node_id}/status/irrigation'

        client.publish(control_topic, json.dumps(command_payload), qos=1)
        client.publish(status_topic, json.dumps(command_payload), qos=1)

        node_state.last_published_at = now

    def _parse_json_payload(self, raw_payload: bytes) -> dict[str, Any] | None:
        try:
            payload = json.loads(raw_payload.decode('utf-8'))
            if isinstance(payload, dict):
                return payload
            return None
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None

    def _extract_float(self, payload: dict[str, Any], keys: list[str]) -> float | None:
        for key in keys:
            value = payload.get(key)
            if isinstance(value, (float, int)):
                return float(value)
            if isinstance(value, str):
                try:
                    return float(value)
                except ValueError:
                    continue
        return None

    def _parse_mqtt_url(self, mqtt_url: str) -> tuple[str, int]:
        if not mqtt_url.startswith('mqtt://'):
            raise ValueError('MQTT_URL must use mqtt:// protocol')

        host_port = mqtt_url.removeprefix('mqtt://')
        host, separator, port_raw = host_port.partition(':')
        port = int(port_raw) if separator else 1883
        return host, port

    def run(self) -> None:
        print(f'Connecting to MQTT broker at {self.host}:{self.port}...')
        self.client.connect(self.host, self.port, keepalive=60)
        self.client.loop_forever()


if __name__ == '__main__':
    service = DecisionService()
    service.run()
