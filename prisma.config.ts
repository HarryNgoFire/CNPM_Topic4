import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({schema:'prisma/schema.prisma',migrations:{path:'prisma/migrations',seed:'tsx scripts/seed.ts'},datasource:{url:process.env.DATABASE_URL ?? 'postgresql://topic4:topic4@localhost:5432/topic4'}});
