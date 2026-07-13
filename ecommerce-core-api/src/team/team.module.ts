import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TeamController, TeamPublicController } from './team.controller';
import { TeamService } from './team.service';
@Module({imports:[AuthModule],controllers:[TeamController,TeamPublicController],providers:[TeamService],exports:[TeamService]})
export class TeamModule{}
