const DEBUG = String(process.env.DEBUG_LOGGING || 'false').toLowerCase() === 'true';

function timestamp() {
  return new Date().toISOString();
}

const log = {
  info: (...args) => console.log(`[${timestamp()}] INFO `, ...args),
  warn: (...args) => console.warn(`[${timestamp()}] WARN `, ...args),
  error: (...args) => console.error(`[${timestamp()}] ERROR`, ...args),
  debug: (...args) => {
    if (DEBUG) console.log(`[${timestamp()}] DEBUG`, ...args);
  },
};

module.exports = { log };
