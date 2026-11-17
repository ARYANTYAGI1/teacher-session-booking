import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db';
import { Teacher } from '../src/models/Teacher';

async function seedTeacher() {
  try {
    await connectDatabase();
    const teacher = await Teacher.findOneAndUpdate(
      { email: 'teacher@example.com' },
      { $setOnInsert: { fullName: 'Alex Morgan', email: 'teacher@example.com', specialization: 'Mathematics', experience: 5 } },
      { upsert: true, new: true, runValidators: true },
    );
    console.log(`Teacher ID: ${teacher._id}`);
  } finally {
    await mongoose.disconnect();
  }
}

seedTeacher().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
