/**
 * Database seeding + index creation on startup.
 * Equivalent of Python's seed.py
 */
import mongoose from 'mongoose';
import { connectDB, db } from './core/database';
import { hashPassword, verifyPassword } from './core/security';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './core/config';

const SAMPLE_DOCTORS = [
  {
    name: 'Dr. Priya Sharma',
    specialization: 'Cardiologist',
    qualification: 'MBBS, MD (Cardiology), DM',
    experience_years: 15,
    consultation_fee: 2000,
    bio: 'Dr. Priya Sharma is a renowned cardiologist with 15 years of experience treating complex cardiac conditions. She has performed over 5000 consultations and is known for her patient-first approach and cutting-edge treatment protocols.',
    image_url: 'https://images.pexels.com/photos/7578806/pexels-photo-7578806.jpeg?auto=compress&cs=tinysrgb&w=300',
    available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    is_active: true,
    rating: 4.9,
    total_reviews: 312,
  },
  {
    name: 'Dr. Rahul Verma',
    specialization: 'Neurologist',
    qualification: 'MBBS, MD (Neurology), DM',
    experience_years: 12,
    consultation_fee: 2000,
    bio: 'Dr. Rahul Verma specializes in neurological disorders including epilepsy, migraine, and Parkinson\'s disease. With 12 years of expertise, he brings advanced diagnostic and treatment options to his patients.',
    image_url: 'https://images.pexels.com/photos/4761779/pexels-photo-4761779.jpeg?auto=compress&cs=tinysrgb&w=300',
    available_days: ['Monday', 'Wednesday', 'Friday'],
    is_active: true,
    rating: 4.7,
    total_reviews: 198,
  },
  {
    name: 'Dr. Anita Mehta',
    specialization: 'Dermatologist',
    qualification: 'MBBS, MD (Dermatology)',
    experience_years: 10,
    consultation_fee: 2000,
    bio: 'Dr. Anita Mehta is a highly skilled dermatologist specializing in skin disorders, cosmetic procedures, and hair treatment. She has helped thousands of patients achieve healthy, glowing skin with personalized care plans.',
    image_url: 'https://images.pexels.com/photos/4173239/pexels-photo-4173239.jpeg?auto=compress&cs=tinysrgb&w=300',
    available_days: ['Tuesday', 'Thursday', 'Saturday'],
    is_active: true,
    rating: 4.8,
    total_reviews: 267,
  },
  {
    name: 'Dr. Suresh Nair',
    specialization: 'Orthopedic Surgeon',
    qualification: 'MBBS, MS (Orthopaedics), MCh',
    experience_years: 18,
    consultation_fee: 2000,
    bio: 'Dr. Suresh Nair is a leading orthopedic surgeon with 18 years of experience in joint replacement, sports injuries, and spine surgery. Known for minimally invasive techniques with faster recovery times.',
    image_url: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=300',
    available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    is_active: true,
    rating: 4.9,
    total_reviews: 445,
  },
  {
    name: 'Dr. Kavitha Rao',
    specialization: 'Pediatrician',
    qualification: 'MBBS, MD (Pediatrics), DCH',
    experience_years: 8,
    consultation_fee: 2000,
    bio: 'Dr. Kavitha Rao is a compassionate pediatrician dedicated to the health and well-being of children from newborn to adolescence. Special expertise in developmental pediatrics and childhood nutrition.',
    image_url: 'https://images.pexels.com/photos/3760263/pexels-photo-3760263.jpeg?auto=compress&cs=tinysrgb&w=300',
    available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    is_active: true,
    rating: 4.8,
    total_reviews: 189,
  },
];

export const ensureIndexes = async (): Promise<void> => {
  await db.users().createIndex({ email: 1 }, { unique: true });
  await db.doctors().createIndex({ is_active: 1 });
  await db.doctors().createIndex({ specialization: 1 });
  await db.appointments().createIndex({ user_id: 1 });
  await db.appointments().createIndex({ doctor_id: 1 });
  await db.appointments().createIndex({ status: 1 });
  await db.appointments().createIndex({ transaction_id: 1 });
  await db.appointments().createIndex({ doctor_id: 1, appointment_date: 1 });
  await db.transactions().createIndex({ transaction_id: 1 }, { unique: true });
  await db.transactions().createIndex({ merchant_order_id: 1 });
  await db.transactions().createIndex({ user_id: 1 });
  await db.transactions().createIndex({ created_at: -1 });
  await db.activity_logs().createIndex({ timestamp: -1 });
  await db.doctor_slots().createIndex({ doctor_id: 1, date: 1 }, { unique: true });
  console.info('[Seed] MongoDB indexes ensured');
};

export const seedAdmin = async (): Promise<void> => {
  const existing = await db.users().findOne({ email: ADMIN_EMAIL });
  if (!existing) {
    await db.users().insertOne({
      email: ADMIN_EMAIL,
      password_hash: hashPassword(ADMIN_PASSWORD),
      name: 'Platform Admin',
      role: 'admin',
      created_at: new Date(),
    });
    console.info(`[Seed] Admin seeded: ${ADMIN_EMAIL}`);
  } else if (!verifyPassword(ADMIN_PASSWORD, (existing['password_hash'] as string) ?? '')) {
    await db.users().updateOne(
      { email: ADMIN_EMAIL },
      { $set: { password_hash: hashPassword(ADMIN_PASSWORD) } }
    );
    console.info('[Seed] Admin password updated');
  }
};

export const seedSampleDoctors = async (): Promise<void> => {
  const count = await db.doctors().countDocuments({});
  if (count === 0) {
    const now = new Date();
    const docs = SAMPLE_DOCTORS.map((d) => ({ ...d, created_at: now }));
    await db.doctors().insertMany(docs);
    console.info(`[Seed] Seeded ${docs.length} sample doctors`);
  }
};

// Allow running this file directly: ts-node src/seed.ts
if (require.main === module) {
  (async () => {
    await connectDB();
    await ensureIndexes();
    await seedAdmin();
    await seedSampleDoctors();
    console.info('[Seed] Done.');
    await mongoose.disconnect();
  })();
}
