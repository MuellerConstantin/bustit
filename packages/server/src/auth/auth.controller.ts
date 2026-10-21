import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type LoginRequest,
  type LoginResponse,
  loginRequestSchema,
} from '@bustit/shared';
import { ZodValidationPipe } from '../infrastructure/validation/index.js';
import { UsersService } from '../users/index.js';
import { AuthTokenService } from './auth-token.service.js';
import { verifyAgainstDummy, verifyPassword } from './password.js';
import { Public } from './public.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  /**
   * Every failure answers the same, whether the user is unknown, deleted, disabled or
   * the password is wrong, so the response doesn't reveal which usernames
   * exist.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
  ): Promise<LoginResponse> {
    const user = await this.usersService.findByUsername(body.username);
    const valid = user
      ? await verifyPassword(user.passwordHash, body.password)
      : await verifyAgainstDummy(body.password);

    if (!user || !valid || user.disabledAt) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return this.authTokenService.loginResponseFor(user);
  }
}
