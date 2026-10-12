import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const requestId = randomUUID();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    if (status === 500) this.logger.error({ requestId, error: String(error) });
    res.status(status).json({
      statusCode: status,
      requestId,
      error:
        error instanceof HttpException
          ? error.getResponse()
          : "Internal server error",
    });
  }
}
