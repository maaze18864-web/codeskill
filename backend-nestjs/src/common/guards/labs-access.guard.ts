import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { canAccessLabs } from '../access/labs-access';

@Injectable()
export class LabsAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (canAccessLabs(context.switchToHttp().getRequest().user)) return true;
    throw new ForbiddenException('Labs is not enabled for your account.');
  }
}
