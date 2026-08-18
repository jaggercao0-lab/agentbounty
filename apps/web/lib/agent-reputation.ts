type ReputationEvent = {
  type: string;
  createdAt: Date;
};

type ReputationTask = {
  id: string;

  events: ReputationEvent[];
};

type ReputationPayment = {
  agentPayoutCents: number;
};

export type AgentReputationMetrics = {
  reliabilityScore:
    | number
    | null;

  trackedJobs: number;
  resolvedJobs: number;
  successfulJobs: number;

  successRate:
    | number
    | null;

  firstPassSuccessRate:
    | number
    | null;

  revisionRate:
    | number
    | null;

  averageExecutionMs:
    | number
    | null;

  averageVerificationMs:
    | number
    | null;

  totalEarningsCents:
    number;
};

function average(
  values: number[]
) {
  if (values.length === 0) {
    return null;
  }

  return (
    values.reduce(
      (
        total,
        value
      ) =>
        total + value,
      0
    ) /
    values.length
  );
}

function percentage(
  numerator: number,
  denominator: number
) {
  if (denominator === 0) {
    return null;
  }

  return (
    numerator /
    denominator
  ) * 100;
}

function executionDurations(
  tasks: ReputationTask[]
) {
  const durations:
    number[] = [];

  for (const task of tasks) {
    const events =
      [...task.events].sort(
        (
          a,
          b
        ) =>
          a.createdAt.getTime() -
          b.createdAt.getTime()
      );

    let startedAt:
      Date |
      null =
        null;

    for (
      const event
      of events
    ) {
      if (
        event.type ===
        "EXECUTION_STARTED"
      ) {
        startedAt =
          event.createdAt;

        continue;
      }

      if (
        event.type ===
          "DELIVERY_SUBMITTED" &&
        startedAt
      ) {
        durations.push(
          event.createdAt.getTime() -
          startedAt.getTime()
        );

        startedAt =
          null;
      }
    }
  }

  return durations;
}

function verificationDurations(
  tasks: ReputationTask[]
) {
  const durations:
    number[] = [];

  const terminalTypes =
    new Set([
      "VERIFICATION_PASSED",
      "OWNER_REVIEW_ACCEPTED",
      "REVISION_REQUESTED",
      "CONTRACT_CANCELLED",
    ]);

  for (const task of tasks) {
    const events =
      [...task.events].sort(
        (
          a,
          b
        ) =>
          a.createdAt.getTime() -
          b.createdAt.getTime()
      );

    let deliveredAt:
      Date |
      null =
        null;

    for (
      const event
      of events
    ) {
      if (
        event.type ===
        "DELIVERY_SUBMITTED"
      ) {
        deliveredAt =
          event.createdAt;

        continue;
      }

      if (
        deliveredAt &&
        terminalTypes.has(
          event.type
        )
      ) {
        durations.push(
          event.createdAt.getTime() -
          deliveredAt.getTime()
        );

        deliveredAt =
          null;
      }
    }
  }

  return durations;
}

function hasSuccessfulOutcome(
  task: ReputationTask
) {
  return task.events.some(
    event =>
      event.type ===
        "VERIFICATION_PASSED" ||
      event.type ===
        "OWNER_REVIEW_ACCEPTED"
  );
}

function hasResolvedOutcome(
  task: ReputationTask
) {
  return (
    hasSuccessfulOutcome(task) ||
    task.events.some(
      event =>
        event.type ===
        "CONTRACT_CANCELLED"
    )
  );
}

export function calculateAgentReputation(
  tasks: ReputationTask[],
  payments: ReputationPayment[]
): AgentReputationMetrics {
  const trackedTasks =
    tasks.filter(
      task =>
        task.events.some(
          event =>
            event.type ===
            "EXECUTION_STARTED"
        )
    );

  const resolvedTasks =
    trackedTasks.filter(
      task =>
        hasResolvedOutcome(task)
    );

  const successfulTasks =
    resolvedTasks.filter(
      task =>
        hasSuccessfulOutcome(task)
    );

  const firstPassTasks =
    successfulTasks.filter(
      task =>
        !task.events.some(
          event =>
            event.type ===
            "REVISION_REQUESTED"
        )
    );

  const revisedTasks =
    resolvedTasks.filter(
      task =>
        task.events.some(
          event =>
            event.type ===
            "REVISION_REQUESTED"
        )
    );

  const successRate =
    percentage(
      successfulTasks.length,
      resolvedTasks.length
    );

  const firstPassSuccessRate =
    percentage(
      firstPassTasks.length,
      resolvedTasks.length
    );

  const revisionRate =
    percentage(
      revisedTasks.length,
      resolvedTasks.length
    );

  let reliabilityScore:
    | number
    | null =
      null;

  if (
    successRate !== null &&
    firstPassSuccessRate !== null &&
    revisionRate !== null
  ) {
    /*
     * Alpha reputation heuristic.
     *
     * Quality:
     * 60% successful outcomes
     * 25% first-pass outcomes
     * 15% revision avoidance
     *
     * New workers are blended toward
     * a neutral 70 until five tracked
     * outcomes exist.
     */

    const observedQuality =
      successRate * 0.60 +
      firstPassSuccessRate * 0.25 +
      (
        100 -
        revisionRate
      ) * 0.15;

    const confidence =
      Math.min(
        1,
        resolvedTasks.length /
          5
      );

    reliabilityScore =
      Math.round(
        (
          70 *
            (
              1 -
              confidence
            )
        ) +
        (
          observedQuality *
          confidence
        )
      );
  }

  return {
    reliabilityScore,

    trackedJobs:
      trackedTasks.length,

    resolvedJobs:
      resolvedTasks.length,

    successfulJobs:
      successfulTasks.length,

    successRate,

    firstPassSuccessRate,

    revisionRate,

    averageExecutionMs:
      average(
        executionDurations(
          trackedTasks
        )
      ),

    averageVerificationMs:
      average(
        verificationDurations(
          trackedTasks
        )
      ),

    totalEarningsCents:
      payments.reduce(
        (
          total,
          payment
        ) =>
          total +
          payment.agentPayoutCents,
        0
      ),
  };
}
