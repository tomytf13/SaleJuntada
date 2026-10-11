import { ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateInstagramDto } from "./dto/update-instagram.dto";
import { GatheringsService } from "./gatherings.service";
import { PrismaService } from "../prisma/prisma.service";
import { ParticipantAuthService } from "../participants/participant-auth.service";
import { RsvpService } from "../rsvp/rsvp.service";

describe("Participant birthday and Instagram", () => {
  const update = jest.fn();
  const updateMany = jest.fn();
  const findFirst = jest.fn();
  const prisma = { participant: { update, updateMany, findFirst } } as unknown as PrismaService;
  const service = new GatheringsService(prisma, new ParticipantAuthService(prisma), {} as RsvpService);
  beforeEach(() => {
    jest.resetAllMocks();
    findFirst.mockResolvedValue({ id: "p", responseToken: "token", isOrganizer: true });
    updateMany.mockResolvedValue({ count: 1 });
  });
  it("normalizes handles and allows removing them", async () => {
    const dto = plainToInstance(UpdateInstagramDto, { instagramUsername: " @Sofi.Test " });
    expect(dto.instagramUsername).toBe("sofi.test");
    expect(await validate(dto)).toHaveLength(0);
    expect(await validate(plainToInstance(UpdateInstagramDto, { instagramUsername: "" }))).toHaveLength(0);
    await service.updateInstagram("g", "p", "token", { instagramUsername: "" });
    expect(update).toHaveBeenCalledWith({ where: { id: "p" }, data: { instagramUsername: null }, select: { id: true, instagramUsername: true } });
  });
  it.each(["https://instagram.com/sofi", "bad user", "<script>", null, "a".repeat(31)])("rejects invalid Instagram %s", async instagramUsername => {
    expect((await validate(plainToInstance(UpdateInstagramDto, { instagramUsername }))).length).toBeGreaterThan(0);
  });
  it("prevents editing another person's Instagram", async () => {
    await expect(service.updateInstagram("g", "p", "other-token", { instagramUsername: "sofi" })).rejects.toThrow(UnauthorizedException);
    expect(update).not.toHaveBeenCalled();
  });
  it("only organizers can assign birthday markers", async () => {
    findFirst.mockResolvedValue({ responseToken: "token", isOrganizer: false });
    await expect(service.updateBirthday("g", "p", "token", { targetParticipantId: "other", isBirthdayPerson: true })).rejects.toThrow(ForbiddenException);
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("limits birthday changes to participants in the same gathering", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(service.updateBirthday("g", "p", "token", { targetParticipantId: "foreign", isBirthdayPerson: true })).rejects.toThrow(NotFoundException);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "foreign", gatheringId: "g" }, data: { isBirthdayPerson: true } });
  });
  it("marks multiple birthday people and can unmark them", async () => {
    for (const id of ["one", "two", "three"]) {
      await expect(service.updateBirthday("g", "p", "token", { targetParticipantId: id, isBirthdayPerson: true })).resolves.toEqual({ id, isBirthdayPerson: true });
    }
    await expect(service.updateBirthday("g", "p", "token", { targetParticipantId: "two", isBirthdayPerson: false })).resolves.toEqual({ id: "two", isBirthdayPerson: false });
  });
});
