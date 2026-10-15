import 'dotenv/config';
import {z} from 'zod';
export const dbEnv=z.object({
 DB_HOST:z.string().default('localhost'),
 DB_PORT:z.coerce.number().int().min(1).max(65535).default(3306),
 DB_USER:z.string().default('cookshare'),
 DB_PASSWORD:z.string().min(1),
 DB_NAME:z.string().regex(/^[a-zA-Z0-9_]+$/).default('cookshare')
}).parse(process.env);
