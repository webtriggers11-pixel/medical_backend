"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const candidates_module_1 = require("./modules/candidates/candidates.module");
const mail_module_1 = require("./modules/mail/mail.module");
const health_module_1 = require("./modules/health/health.module");
const seed_module_1 = require("./modules/seed/seed.module");
const company_module_1 = require("./modules/company/company.module");
const zone_module_1 = require("./modules/zone/zone.module");
const city_module_1 = require("./modules/city/city.module");
const store_module_1 = require("./modules/store/store.module");
const lab_module_1 = require("./modules/lab/lab.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            mail_module_1.MailModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            candidates_module_1.CandidatesModule,
            health_module_1.HealthModule,
            seed_module_1.SeedModule,
            company_module_1.CompanyModule,
            zone_module_1.ZoneModule,
            city_module_1.CityModule,
            store_module_1.StoreModule,
            lab_module_1.LabModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map