import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  try {
    const match = await prisma.halisahaMatch.findUnique({
      where: { singletonKey: "active" },
      select: {
        id: true,
        title: true,
        homeFormation: true,
        awayFormation: true,
      },
    });

    if (!match) {
      throw new Error("Active Halisaha match not found");
    }

    const [participants, questions] = await Promise.all([
      prisma.halisahaParticipant.findMany({
        where: {
          matchId: match.id,
          teamSide: { not: null },
          positionKey: { not: null },
        },
        include: {
          user: { select: { name: true, surname: true } },
          guest: { select: { displayName: true } },
        },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.halisahaQuestion.findMany({
        where: {
          matchId: match.id,
          OR: [{ kind: "mvp_prediction" }, { kind: "player_prediction" }],
        },
        include: {
          options: {
            where: { participantId: { not: null } },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    const participantRows = participants.map((participant) => ({
      id: participant.id,
      displayName:
        participant.displayNameOverride?.trim() ||
        participant.guestName ||
        participant.guest?.displayName ||
        `${participant.user?.name ?? ""} ${participant.user?.surname ?? ""}`.trim(),
      teamSide: participant.teamSide,
      positionKey: participant.positionKey,
    }));

    const duplicateDisplayNames = Object.entries(
      participantRows.reduce((acc, participant) => {
        acc[participant.displayName] = (acc[participant.displayName] ?? 0) + 1;
        return acc;
      }, {}),
    ).filter(([, count]) => count > 1);

    console.log(
      JSON.stringify(
        {
          match,
          duplicateDisplayNames,
          participants: participantRows,
          questionOptions: questions.map((question) => ({
            id: question.id,
            kind: question.kind,
            prompt: question.prompt,
            options: question.options.map((option) => ({
              id: option.id,
              label: option.label,
              participantId: option.participantId,
            })),
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
