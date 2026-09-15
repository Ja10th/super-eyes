// Centralized logging utility for the platform

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN', 
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

const shouldLog = (level) => {
  const levels = [LOG_LEVELS.DEBUG, LOG_LEVELS.INFO, LOG_LEVELS.WARN, LOG_LEVELS.ERROR];
  return levels.indexOf(level) >= levels.indexOf(LOG_LEVEL);
};

const formatMessage = (level, context, message, data = null) => {
  const timestamp = new Date().toISOString();
  const contextStr = context ? `[${context}] ` : '';
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `${timestamp} ${level} ${contextStr}${message}${dataStr}`;
};

const logger = {
  error: (context, message, data = null) => {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(formatMessage(LOG_LEVELS.ERROR, context, message, data));
    }
  },
  
  warn: (context, message, data = null) => {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(formatMessage(LOG_LEVELS.WARN, context, message, data));
    }
  },
  
  info: (context, message, data = null) => {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(formatMessage(LOG_LEVELS.INFO, context, message, data));
    }
  },
  
  debug: (context, message, data = null) => {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(formatMessage(LOG_LEVELS.DEBUG, context, message, data));
    }
  }
};

export default logger;