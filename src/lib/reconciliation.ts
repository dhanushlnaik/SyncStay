import {
  Prisma,
  ReconciliationIssueSeverity,
  ReconciliationIssueStatus,
  ReconciliationRunStatus,
} from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type IssueCandidate = {
  hotelId: string;
  platformConfigId?: string;
  roomTypeId?: string;
  date?: Date;
  expectedAvailable?: number;
  actualAvailable?: number;
  severity: ReconciliationIssueSeverity;
  payload: Prisma.InputJsonValue;
};

type IssueKeySource = {
  hotelId: string;
  platformConfigId?: string | null;
  roomTypeId?: string | null;
  date?: Date | null;
};

function buildIssueKey(candidate: IssueKeySource) {
  return [
    candidate.hotelId,
    candidate.platformConfigId ?? "",
    candidate.roomTypeId ?? "",
    candidate.date?.toISOString().slice(0, 10) ?? "",
  ].join(":");
}

export async function runReconciliation(input: {
  hotelId: string;
  triggeredById?: string;
}) {
  const run = await prisma.syncReconciliationRun.create({
    data: {
      hotelId: input.hotelId,
      triggeredById: input.triggeredById,
      status: ReconciliationRunStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  try {
    const [platformConfigs, inventoryRows, recentFailures] = await Promise.all([
      prisma.hotelPlatformConfig.findMany({
        where: {
          hotelId: input.hotelId,
          isEnabled: true,
        },
      }),
      prisma.inventory.findMany({
        where: {
          hotelId: input.hotelId,
          date: {
            gte: new Date(),
            lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          roomTypeId: true,
          date: true,
          availableRooms: true,
        },
        orderBy: [{ date: "asc" }],
        take: 300,
      }),
      prisma.syncLog.findMany({
        where: {
          hotelId: input.hotelId,
          status: "FAILED",
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          hotelPlatformConfigId: true,
          correlationId: true,
          action: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
    ]);

    const issueCandidates: IssueCandidate[] = [];

    for (const inventory of inventoryRows) {
      for (const platform of platformConfigs) {
        const lastFailureForPlatform = recentFailures.find(
          (failure) => failure.hotelPlatformConfigId === platform.id,
        );

        const expected = inventory.availableRooms;
        const actual =
          platform.status === "CONNECTED" && !lastFailureForPlatform ? expected : Math.max(0, expected - 1);

        if (actual !== expected) {
          issueCandidates.push({
            hotelId: input.hotelId,
            platformConfigId: platform.id,
            roomTypeId: inventory.roomTypeId,
            date: inventory.date,
            expectedAvailable: expected,
            actualAvailable: actual,
            severity: lastFailureForPlatform ? ReconciliationIssueSeverity.HIGH : ReconciliationIssueSeverity.MEDIUM,
            payload: {
              source: "simulated-channel-comparison",
              lastFailure: lastFailureForPlatform
                ? {
                    id: lastFailureForPlatform.id,
                    action: lastFailureForPlatform.action,
                    errorMessage: lastFailureForPlatform.errorMessage,
                    createdAt: lastFailureForPlatform.createdAt.toISOString(),
                  }
                : null,
            },
          });
        }
      }
    }

    const openIssues = await prisma.syncReconciliationIssue.findMany({
      where: {
        hotelId: input.hotelId,
        status: ReconciliationIssueStatus.OPEN,
      },
      select: {
        id: true,
        hotelId: true,
        platformConfigId: true,
        roomTypeId: true,
        date: true,
      },
    });

    const newIssueKeySet = new Set(issueCandidates.map((item) => buildIssueKey(item)));
    const resolvedIssueIds = openIssues
      .filter((issue) => !newIssueKeySet.has(buildIssueKey(issue)))
      .map((issue) => issue.id);

    await prisma.$transaction(async (tx) => {
      if (resolvedIssueIds.length > 0) {
        await tx.syncReconciliationIssue.updateMany({
          where: {
            id: {
              in: resolvedIssueIds,
            },
          },
          data: {
            status: ReconciliationIssueStatus.RESOLVED,
            resolvedAt: new Date(),
          },
        });
      }

      if (issueCandidates.length > 0) {
        await tx.syncReconciliationIssue.createMany({
          data: issueCandidates.map((issue) => ({
            runId: run.id,
            hotelId: issue.hotelId,
            platformConfigId: issue.platformConfigId,
            roomTypeId: issue.roomTypeId,
            date: issue.date,
            expectedAvailable: issue.expectedAvailable,
            actualAvailable: issue.actualAvailable,
            severity: issue.severity,
            status: ReconciliationIssueStatus.OPEN,
            payload: issue.payload,
          })),
        });
      }

      await tx.syncReconciliationRun.update({
        where: { id: run.id },
        data: {
          status: ReconciliationRunStatus.COMPLETED,
          finishedAt: new Date(),
          totalChecked: inventoryRows.length * Math.max(platformConfigs.length, 1),
          issuesFound: issueCandidates.length,
          summary: {
            openIssues: issueCandidates.length,
            resolvedIssues: resolvedIssueIds.length,
            platformCount: platformConfigs.length,
          },
        },
      });
    });

    return prisma.syncReconciliationRun.findUniqueOrThrow({
      where: { id: run.id },
      include: {
        issues: {
          take: 50,
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (error) {
    logger.error("Reconciliation run failed", {
      hotelId: input.hotelId,
      runId: run.id,
      error: error instanceof Error ? error.message : String(error),
    });

    await prisma.syncReconciliationRun.update({
      where: { id: run.id },
      data: {
        status: ReconciliationRunStatus.FAILED,
        finishedAt: new Date(),
        summary: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
    });

    throw error;
  }
}
