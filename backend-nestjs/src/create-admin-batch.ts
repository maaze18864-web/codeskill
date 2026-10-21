import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User as UserEntity } from './database/entities/user.entity';
import { hashPassword } from './auth/password.util';

interface AdminToSeed {
  name: string;
  email: string;
  password: string;
  uid?: string;
  role?: string;
}

const DEFAULT_ADMINS: AdminToSeed[] = [
  { name: 'Admin (Admin)', email: 'admin@codeskill.com', password: '12345678', role: 'super_admin' },
  { name: 'Platform Admin', email: 'admin@codeskill.io', password: '12345678', role: 'super_admin' },
  { name: 'Venkatesh K', email: 'venkatesh@codeskill.com', password: '12345678', role: 'super_admin' },
  { name: 'Mustakim Shaikh', email: 'mustakim@codeskill.com', password: '12345678', role: 'super_admin' },
  { name: 'maaz', email: 'maaz@codeskill.com', password: '12345678', role: 'super_admin' },
  { name: 'Anmol', email: 'anmol@codeskill.com', password: '12345678', role: 'super_admin' },
  { name: 'Tushar', email: 'tushar@codeskill.com', password: '12345678', role: 'super_admin' },
  { name: 'Vishal', email: 'vishal@codeskill.com', password: '12345678', role: 'super_admin' },
  { name: 'Abhinav', email: 'abhinav@codeskill.com', password: '12345678', role: 'super_admin' },
];

async function seedBatch() {
  console.log('--- Initializing Admin User Batch Creation ---');
  const app = await NestFactory.createApplicationContext(AppModule);
  const userRepository = app.get(getRepositoryToken(UserEntity));

  for (const admin of DEFAULT_ADMINS) {
    try {
      let user = await userRepository.findOne({
        where: [{ email: admin.email.toLowerCase() }, { name: admin.name }],
      });

      const hashedPassword = await hashPassword(admin.password);

      if (user) {
        user.isAdmin = true;
        user.role = admin.role || 'admin';
        user.password = hashedPassword;
        user.isActive = true;
        user.forcePasswordChange = false;
        await userRepository.save(user);
        console.log(`[UPDATED] User ${admin.name} (${user.email}) -> Role: ${user.role}, Admin: true`);
      } else {
        user = userRepository.create({
          name: admin.name,
          email: admin.email.toLowerCase(),
          password: hashedPassword,
          role: admin.role || 'admin',
          isAdmin: true,
          isActive: true,
          forcePasswordChange: false,
          authProvider: 'local',
          stats: {},
          profile: { role: admin.role || 'admin' },
          studentProfile: {},
        });
        await userRepository.save(user);
        console.log(`[CREATED] User ${admin.name} (${admin.email}) -> Role: ${admin.role}, Admin: true`);
      }
    } catch (err: any) {
      console.error(`[ERROR] Failed to process ${admin.name}:`, err.message);
    }
  }

  await app.close();
  console.log('--- Admin Batch Creation Completed ---');
  process.exit(0);
}

seedBatch();
