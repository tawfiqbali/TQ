import { createHash } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-password -- "your-strong-password"');
  process.exit(1);
}
const hash = createHash('sha256').update(password).digest('hex');
console.log(`\nAdd this line to your .env file:\n\nVITE_ADMIN_PASSWORD_HASH=${hash}\n`);
