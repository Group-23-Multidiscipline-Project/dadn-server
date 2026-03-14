import Joi, { ObjectSchema } from 'joi';

export const configValidationSchema: ObjectSchema = Joi.object({
  PORT: Joi.number().default(3000),
  MONGO_URI: Joi.string().required(),
  NODE_ENV: Joi.string()
    .valid('local', 'staging', 'production')
    .default('local'),
});
