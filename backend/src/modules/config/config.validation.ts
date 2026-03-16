import Joi, { ObjectSchema } from 'joi';

export const configValidationSchema: ObjectSchema = Joi.object({
  PORT: Joi.number().default(3000),
  MONGO_URI: Joi.string().required(),
  HIVEMQ_USERNAME: Joi.string().required(),
  HIVEMQ_PASSWORD: Joi.string().required(),
  MQTT_HOST: Joi.string().required(),
  MQTT_PORT: Joi.number().port().required(),
  NODE_ENV: Joi.string()
    .valid('local', 'staging', 'production')
    .default('local'),
});
