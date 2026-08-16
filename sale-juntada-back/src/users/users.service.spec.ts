import { ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

describe("UsersService gathering deletion", () => {
  it("elimina una juntada sólo cuando el usuario autenticado es organizador", async () => {
    const prisma = {
      gathering: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;

    await expect(
      new UsersService(prisma).deleteGathering("gathering-1", {
        id: "auth-user",
        email: "tomy@example.com",
      }),
    ).resolves.toEqual({ id: "gathering-1" });

    expect(prisma.gathering.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "gathering-1",
        participants: {
          some: { authUserId: "auth-user", isOrganizer: true },
        },
      },
    });
  });

  it("no revela ni elimina juntadas ajenas", async () => {
    const prisma = {
      gathering: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService;

    await expect(
      new UsersService(prisma).deleteGathering("gathering-2", {
        id: "other-user",
        email: "otra@example.com",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
