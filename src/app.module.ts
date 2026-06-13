import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { MailModule } from './modules/mail/mail.module';
import { HealthModule } from './modules/health/health.module';
import { SeedModule } from './modules/seed/seed.module';
import { ZoneModule } from './modules/zone/zone.module';
import { CityModule } from './modules/city/city.module';
import { StoreModule } from './modules/store/store.module';
import { LabModule } from './modules/lab/lab.module';
import { PanelModule } from './modules/panel/panel.module';
import { BookingModule } from './modules/booking/booking.module';
import { ReportModule } from './modules/report/report.module';
import { TestMasterModule } from './modules/test-master/test-master.module';
import { IdSequenceModule } from './common/id-sequence/id-sequence.module';
import { StatsModule } from './modules/stats/stats.module';
import { ExportModule } from './modules/export/export.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    CandidatesModule,
    HealthModule,
    SeedModule,
    ZoneModule,
    CityModule,
    StoreModule,
    LabModule,
    PanelModule,
    BookingModule,
    ReportModule,
    TestMasterModule,
    IdSequenceModule,
    StatsModule,
    ExportModule,
  ],
})
export class AppModule {}
