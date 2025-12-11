import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "src/auth/auth.module";
import { PreviewUsage } from "src/entities/preview-usage.entity";
import { PreviewUsageService } from "./preview-usage.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([PreviewUsage]),
        AuthModule,
    ],
    providers: [PreviewUsageService],
    exports: [PreviewUsageService],
})

export class PreviewUsageModule {}