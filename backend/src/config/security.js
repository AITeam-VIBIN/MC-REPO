import env from './env.js';

/**
 * Parses and splits whitelisted CORS origins from environment strings.
 * 
 * @type {string[]}
 */
export const corsWhitelist = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());

/**
 * Global Security Parameters configuration.
 * Maps cryptographic, CORS, and HTTP header properties.
 * 
 * @type {Object}
 */
export const securityConfig = {
  bcrypt: {
    rounds: env.BCRYPT_ROUNDS,
  },
  jwt: {
    secret: env.SUPABASE_JWT_SECRET,
    expiresIn: env.JWT_EXPIRE_IN,
    algorithms: ['HS256'], // Supabase tokens sign standard HS256 HMAC JWTs
  },
  cors: {
    origin: corsWhitelist,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // Preflight cache lifespan: 24 hours (86400 seconds)
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
        imgSrc: ["'self'", 'data:', 'https://*.supabase.co'],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    referrerPolicy: { policy: 'same-origin' },
  },
};

export default securityConfig;
