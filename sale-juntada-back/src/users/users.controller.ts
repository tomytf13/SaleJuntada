import { Controller, Delete, Get, Headers, Param } from "@nestjs/common";
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

  @Delete("me/gatherings/:gatheringId")
  async deleteMyGathering(
    @Param("gatheringId") gatheringId: string,
    @Headers("authorization") authorization: string | undefined,
  ) {
    const identity = await this.authService.requireIdentity(authorization);
    return this.usersService.deleteGathering(gatheringId, identity);
  }
}
