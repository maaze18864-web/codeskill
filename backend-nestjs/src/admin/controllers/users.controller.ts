import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from '../admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Create a new admin user (super_admin only)' })
  async createAdmin(
    @Body() body: CreateAdminUserDto,
    @CurrentUser() currentUser: any,
  ) {
    const user = await this.adminService.createAdminUser(body, currentUser);
    return { success: true, user };
  }

  @Get()
  @ApiOperation({ summary: 'List all users with pagination and search' })
  async getUsers(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search: string,
    @Query('adminsOnly') adminsOnly: string,
  ) {
    return this.adminService.getUsers(
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 50,
      search,
      adminsOnly === 'true',
    );
  }

  @Put(':id/role')
  @ApiOperation({ summary: 'Update user role with strict authorization checks' })
  async updateUserRole(
    @Param('id') id: string,
    @Body() body: UpdateUserRoleDto,
    @CurrentUser() currentUser: any,
  ) {
    const user = await this.adminService.updateUserRole(id, body, currentUser);
    return { success: true, user };
  }

  @Get(':id/report')
  @ApiOperation({ summary: 'Get candidate report' })
  async getReport(@Param('id') id: string) {
    return this.adminService.getReport(id);
  }

  @Put(':id/promote')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Promote user to admin (super_admin only)' })
  async promoteUser(
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.adminService.promoteUser(id, currentUser);
  }

  @Put(':id/demote')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Demote user from admin (super_admin only)' })
  async demoteUser(
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.adminService.demoteUser(id, currentUser);
  }
}
