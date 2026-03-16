require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

const [email, password, firstName, lastName] = process.argv.slice(2);

if (!email || !password || !firstName || !lastName) {
  console.error('Usage: node scripts/setup-admin.js <email> <password> <firstName> <lastName>');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  const db = client.db();
  const admins = db.collection('admins');

  const rounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
  const hash = await bcrypt.hash(password, rounds);

  const result = await admins.updateOne(
    { email: email.toLowerCase() },
    {
      $set: {
        firstName,
        lastName,
        password: hash,
        role: 'super_admin',
        isActive: true,
        refreshTokens: [],
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  if (result.upsertedCount) {
    console.log(`Created new admin: ${email}`);
  } else {
    console.log(`Updated existing admin: ${email} (matched: ${result.matchedCount}, modified: ${result.modifiedCount})`);
  }

  await client.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
