import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class IncomingPipeline implements PipeTransform {
  constructor(private readonly allowedTopics: string[] = []) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (!value) {
      throw new BadRequestException('Payload must not be empty');
    }

    if (metadata && metadata.data && this.allowedTopics.length > 0) {
      const topic = metadata.data;

      const isAllowed = this.allowedTopics.some((pattern) => {
        const regexPattern =
          '^' + pattern.replace(/\+/g, '[^/]+').replace(/#/g, '.*') + '$';
        return new RegExp(regexPattern).test(topic);
      });

      if (!isAllowed) {
        throw new BadRequestException(
          `[Validation Pipe] Topic ${topic} is not allowed`,
        );
      }
    }
    return value;
  }
}
