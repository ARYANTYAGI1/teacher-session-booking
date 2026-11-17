import 'dotenv/config';
import mongoose from 'mongoose';
import { app } from './app';
import { connectDatabase } from './config/db';
import { User } from './models/User';
import { Teacher } from './models/Teacher';
import { Session } from './models/Session';

async function startServer() {
  const port = Number(process.env.PORT ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be between 1 and 65535');
  }

  await connectDatabase();
  await Promise.all([User.init(), Teacher.init(), Session.init()]);

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
