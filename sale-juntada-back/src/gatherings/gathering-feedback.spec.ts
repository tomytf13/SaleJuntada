import { ConflictException, ForbiddenException } from "@nestjs/common";
import { validate } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { ParticipantAuthService } from "../participants/participant-auth.service";
import { RsvpService } from "../rsvp/rsvp.service";
import { GatheringsService } from "./gatherings.service";
import { GatheringFeedbackDto } from "./dto/gathering-feedback.dto";

function setup(status: string) {
  const upsert = jest.fn();
  const updateMany = jest.fn();
  const auth = {
    requireParticipant: jest.fn().mockResolvedValue({ gathering: { status } }),
    requireOrganizer: jest.fn().mockRejectedValue(new ForbiddenException()),
  };
  const service = new GatheringsService(
    {
      gatheringFeedback: { upsert },
      gathering: { updateMany },
    } as unknown as PrismaService,
    auth as unknown as ParticipantAuthService,
    {} as RsvpService,
  );
  return { service, upsert, updateMany };
}

describe("cierre y opinión sobre la app", () => {
  it("exige que cierre quien organiza", async () => {
    const { service, updateMany } = setup("CONFIRMED");
    await expect(
      service.closeGathering("g", "guest", "token"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it.each(["OPEN", "CONFIRMED", "CANCELLED"])(
    "no admite opiniones en %s",
    async (status) => {
      const { service, upsert } = setup(status);
      await expect(
        service.saveFeedback("g", "me", "token", { stars: 3 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(upsert).not.toHaveBeenCalled();
    },
  );
  it("guarda una opinión editable por participante de la juntada", async () => {
    const { service, upsert } = setup("CLOSED");
    await service.saveFeedback("g", "me", "token", {
      stars: 4,
      comment: "  Fácil de usar  ",
    });
    expect(upsert).toHaveBeenCalledWith({
      where: { participantId: "me" },
      create: { participantId: "me", stars: 4, comment: "Fácil de usar" },
      update: { stars: 4, comment: "Fácil de usar" },
      select: { stars: true, comment: true },
    });
  });
  it.each([
    {},
    { stars: 0 },
    { stars: 6 },
    { stars: 2.5 },
    { stars: 4, comment: "x".repeat(1001) },
  ])("rechaza una valoración inválida", async (data) => {
    expect(
      (await validate(Object.assign(new GatheringFeedbackDto(), data))).length,
    ).toBeGreaterThan(0);
  });
});
