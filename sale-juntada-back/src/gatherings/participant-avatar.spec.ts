import { UnauthorizedException } from "@nestjs/common";
import { validate } from "class-validator";
import { UpdateAvatarDto } from "./dto/update-avatar.dto";
import { GatheringsService } from "./gatherings.service";
import { PrismaService } from "../prisma/prisma.service";
import { ParticipantAuthService } from "../participants/participant-auth.service";
import { RsvpService } from "../rsvp/rsvp.service";

describe("Participant avatar", () => {
  it.each([
    "emoji:🥳",
    "data:image/jpeg;base64,YWJj",
    "https://lh3.googleusercontent.com/photo",
  ])("accepts supported avatars %s", async (avatarUrl) => {
    expect(
      await validate(Object.assign(new UpdateAvatarDto(), { avatarUrl })),
    ).toHaveLength(0);
  });
  it.each([
    "https://tracking.example/photo",
    "data:image/svg+xml;base64,YWJj",
    "data:image/jpeg;base64," + "A".repeat(60000),
    null,
    undefined,
  ])("rejects unsupported avatar", async (avatarUrl) => {
    expect(
      (await validate(Object.assign(new UpdateAvatarDto(), { avatarUrl })))
        .length,
    ).toBeGreaterThan(0);
  });
  it("refuses editing another participant before writing", async () => {
    const update = jest.fn();
    const requireParticipant = jest
      .fn()
      .mockRejectedValue(new UnauthorizedException());
    const service = new GatheringsService(
      { participant: { update } } as unknown as PrismaService,
      { requireParticipant } as unknown as ParticipantAuthService,
      {} as RsvpService,
    );
    await expect(
      service.updateAvatar("g", "other", "wrong-token", {
        avatarUrl: "emoji:🦆",
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(update).not.toHaveBeenCalled();
  });
  it("updates only the authorized avatar and excludes credentials", async () => {
    const update = jest
      .fn()
      .mockResolvedValue({ id: "p", name: "Sofi", avatarUrl: "emoji:🥳" });
    const requireParticipant = jest.fn().mockResolvedValue({ id: "p" });
    const service = new GatheringsService(
      { participant: { update } } as unknown as PrismaService,
      { requireParticipant } as unknown as ParticipantAuthService,
      {} as RsvpService,
    );
    await service.updateAvatar("g", "p", "my-token", { avatarUrl: "emoji:🥳" });
    expect(requireParticipant).toHaveBeenCalledWith("g", "p", "my-token");
    expect(update).toHaveBeenCalledWith({
      where: { id: "p" },
      data: { avatarUrl: "emoji:🥳" },
      select: { id: true, name: true, avatarUrl: true },
    });
  });
});
