import winston, {format} from 'winston';

/**
 * error: 0,
 * warn: 1,
 * info: 2,
 * http: 3,
 * verbose: 4,
 * debug: 5,
 * silly: 6
 */

const f = format.combine(
  format.timestamp(),
  format.simple(),
  format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
)
const f1 = format.combine(
  format.timestamp(),
  format.simple(),
  format.colorize(),
  format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
)
export const logger = winston.createLogger({
  level: 'info',
  format: f,
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: f1 }));
}
