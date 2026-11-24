import {
  Body,
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  Header,
  Headers,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ReportKind, ReportStatus } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { isIP } from "node:net";
import { Transform } from "class-transformer";
import { IsEnum, IsString, IsUUID, Length } from "class-validator";
import { SupabaseAuthService } from "../auth/supabase-auth.service";
import { PrismaService } from "../prisma/prisma.service";

class CreateReportDto {
  @IsUUID("4") id!: string;
  @IsEnum(ReportKind) kind!: ReportKind;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(5, 2000)
  description!: string;
}

class UpdateReportDto {
  @IsEnum(ReportStatus) status!: ReportStatus;
}

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly db: PrismaService,
    private readonly auth: SupabaseAuthService,
  ) {}

  @Post()
  @Throttle({
    default: {
      limit: 5,
      ttl: 60000,
      getTracker: (request) => {
        const clientIp = request.headers["fly-client-ip"];
        if (
          process.env.FLY_APP_NAME &&
          typeof clientIp === "string" &&
          isIP(clientIp)
        )
          return clientIp;
        return request.ip;
      },
    },
  })
  async create(@Body() input: CreateReportDto) {
    // The same submission can be retried after a lost response.
    await this.db.appReport.createMany({ data: [input], skipDuplicates: true });
    return { id: input.id };
  }

  private async requireAdmin(authorization?: string) {
    const identity = await this.auth.requireIdentity(authorization);
    if (!identity.isAppAdmin)
      throw new ForbiddenException(
        "Sólo el equipo de Sale Juntada puede gestionar reportes.",
      );
  }

  @Get()
  @Header("Cache-Control", "private, no-store")
  async list(
    @Headers("authorization") authorization: string | undefined,
    @Query(
      "status",
      new DefaultValuePipe("NEW"),
      new ParseEnumPipe(ReportStatus),
    )
    status: ReportStatus,
    @Query("after", new ParseUUIDPipe({ optional: true })) after?: string,
  ) {
    await this.requireAdmin(authorization);
    const rows = await this.db.appReport.findMany({
      where: { status },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 31,
      ...(after && { cursor: { id: after }, skip: 1 }),
    });
    const items = rows.slice(0, 30);
    return { items, next: rows.length > 30 ? items[29].id : null };
  }

  @Patch(":id")
  async update(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateReportDto,
  ) {
    await this.requireAdmin(authorization);
    const result = await this.db.appReport.updateMany({
      where: { id },
      data: { status: input.status },
    });
    if (!result.count)
      throw new NotFoundException("No encontramos el reporte.");
    return { id, status: input.status };
  }
}
