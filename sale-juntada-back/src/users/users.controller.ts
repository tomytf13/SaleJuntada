import { Controller, Get, Headers } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SupabaseAuthService } from "../auth/supabase-auth.service";
import { UsersService } from "./users.service";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: SupabaseAuthService,
  ) {}

  @Get("me/gatherings")
  async getMyGatherings(
    @Headers("authorization") authorization: string | undefined,
  ) {
    const identity = await this.authService.requireIdentity(authorization);
    return this.usersService.getGatheringHistory(identity);
  }
}
