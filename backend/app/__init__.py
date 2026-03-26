from os import environ

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from .routes.app_routes import device_bp
from .config import Config as config, validate_environment_variables
from .db import ensure_mongo_indexes, ping_mongo
from .services.mqtt_client import init_mqtt


def create_app():
    load_dotenv()
    validate_environment_variables()
    init_mqtt()
    APPLICATION_ENV = get_environment()

    app = Flask(config[APPLICATION_ENV].APP_NAME)
    app.config.from_object(config[APPLICATION_ENV])

    CORS(app, resources={r'/api/*': {'origins': '*'}})

    _register_blueprints(app)

    mongo_ok, mongo_message = ping_mongo()
    if mongo_ok:
        print('MongoDB connected')
        indexes_ok, indexes_message = ensure_mongo_indexes()
        if indexes_ok:
            print(indexes_message)
        else:
            print(f'MongoDB index init failed: {indexes_message}')
    else:
        print(f'MongoDB not connected: {mongo_message}')

    return app


def get_environment():
    environment = (environ.get('APPLICATION_ENV') or 'development').lower()

    if environment not in config:
        raise ValueError(
            f"Invalid APPLICATION_ENV '{environment}'. Supported values: {', '.join(config.keys())}",
        )

    return environment


def _register_blueprints(app):
    app.register_blueprint(device_bp)
