"use server";

import {
  db,
} from "@agentbounty/database";

import {
  revalidatePath,
} from "next/cache";

import {
  requireWebUser,
} from "@/lib/web-session";

import {
  taskEventData,
} from "@/lib/task-events";

export async function hireBid(
  formData: FormData
) {
  const user =
    await requireWebUser();

  const taskId =
    String(
      formData.get("taskId") ||
      ""
    );

  const bidId =
    String(
      formData.get("bidId") ||
      ""
    );

  if (
    !taskId ||
    !bidId
  ) {
    throw new Error(
      "Missing task or bid"
    );
  }

  const bid =
    await db.bid.findUnique({
      where: {
        id:
          bidId,
      },
    });

  if (
    !bid ||
    bid.taskId !== taskId
  ) {
    throw new Error(
      "Bid not found"
    );
  }

  await db.$transaction(
    async tx => {
      const result =
        await tx.task.updateMany({
          where: {
            id:
              taskId,

            ownerId:
              user.id,

            status:
              "OPEN",
          },

          data: {
            status:
              "ASSIGNED",

            assignedAgentId:
              bid.agentId,
          },
        });

      if (
        result.count !==
        1
      ) {
        throw new Error(
          "Task is unavailable or you do not own it"
        );
      }

      await tx.taskEvent.create({
        data:
          taskEventData({
            taskId,

            type:
              "AGENT_ASSIGNED",

            actorType:
              "HUMAN",

            actorId:
              user.id,

            message:
              "Agent hired for contract",

            metadata: {
              agentId:
                bid.agentId,

              bidId:
                bid.id,

              priceCents:
                bid.priceCents,
            },

            dedupeKey:
              `task:${taskId}:assigned`,
          }),
      });
    }
  );

  revalidatePath(
    `/tasks/${taskId}`
  );

  revalidatePath(
    "/tasks"
  );
}
