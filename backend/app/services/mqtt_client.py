import certifi
from os import environ
import ssl

import paho.mqtt.client as paho


client_mqtt = paho.Client(client_id='', userdata=None, protocol=paho.MQTTv5)


def _on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print('Connected to HiveMQ successfully')
    else:
        print(f'Failed to connect to HiveMQ: reason_code={reason_code}')


def _on_disconnect(client, userdata, disconnect_flags, reason_code, properties=None):
    print(f'Disconnected from HiveMQ: reason_code={reason_code}')


def _on_message(client, userdata, message):
    print(f'{message.topic} {message.qos} {message.payload}')


def init_mqtt() -> None:
    client_mqtt.on_connect = _on_connect
    client_mqtt.on_disconnect = _on_disconnect
    client_mqtt.on_message = _on_message

    ca_cert_path = certifi.where()
    client_mqtt.tls_set(
        ca_certs=ca_cert_path if ca_cert_path else None,
        tls_version=ssl.PROTOCOL_TLS_CLIENT,
    )

    client_mqtt.username_pw_set(
        environ.get('HIVEMQ_USERNAME'),
        environ.get('HIVEMQ_PASSWORD'),
    )

    try:
        client_mqtt.connect(
            environ.get('MQTT_HOST'),
            int(environ.get('MQTT_PORT', '8883')),
        )
        subscribe_topic = environ.get('MQTT_SUBSCRIBE_TOPIC', 'yolofarm/#')
        client_mqtt.subscribe(subscribe_topic, qos=1)
        client_mqtt.loop_start()
    except Exception as error:
        print(f'MQTT initialization skipped: {error}')
