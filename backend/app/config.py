from os import environ


class BaseConfig:
    APP_NAME = 'dadn-server'
    DEBUG = False
    TESTING = False


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class StagingConfig(BaseConfig):
    DEBUG = False


class ProductionConfig(BaseConfig):
    DEBUG = False


Config = {
    'development': DevelopmentConfig,
    'staging': StagingConfig,
    'production': ProductionConfig,
}


def validate_environment_variables() -> None:
    required_vars = [
        'MONGO_URI',
        'MQTT_HOST',
        'MQTT_PORT',
        'HIVEMQ_USERNAME',
        'HIVEMQ_PASSWORD',
    ]

    missing_vars = [key for key in required_vars if not environ.get(key)]
    if missing_vars:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing_vars)}",
        )

    mqtt_port = environ.get('MQTT_PORT', '')
    if not mqtt_port.isdigit():
        raise ValueError('MQTT_PORT must be a valid integer')

    port = int(mqtt_port)
    if port < 1 or port > 65535:
        raise ValueError('MQTT_PORT must be in range 1..65535')
