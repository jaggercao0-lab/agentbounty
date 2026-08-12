export type ParsedCriterion =
  | {
      type: "PULL_REQUEST";
      raw: string;
    }
  | {
      type: "FILE_EXISTS";
      raw: string;
      path: string;
    }
  | {
      type: "CONTENT_CONTAINS";
      raw: string;
      path: string;
      value: string;
    }
  | {
      type: "CONTENT_PRESERVED";
      raw: string;
      path: string;
    }
  | {
      type: "BUILD";
      raw: string;
    }
  | {
      type: "TESTS";
      raw: string;
    }
  | {
      type: "LINT";
      raw: string;
    }
  | {
      type: "UNSUPPORTED";
      raw: string;
    };

function safePath(path: string) {
  const value = path.trim();

  if (
    !value ||
    value.includes("..") ||
    value.includes("\0") ||
    value.startsWith("/") ||
    value === ".git" ||
    value.startsWith(".git/")
  ) {
    return null;
  }

  return value;
}

export function parseCriterion(
  criterion: string
): ParsedCriterion {
  const raw = criterion.trim();
  const lower = raw.toLowerCase();

  if (
    lower.startsWith(
      "a pull request is submitted"
    )
  ) {
    return {
      type: "PULL_REQUEST",
      raw,
    };
  }

  if (
    lower === "build passes" ||
    lower === "build must pass"
  ) {
    return {
      type: "BUILD",
      raw,
    };
  }

  if (
    lower === "tests pass" ||
    lower === "tests must pass" ||
    lower === "test passes"
  ) {
    return {
      type: "TESTS",
      raw,
    };
  }

  if (
    lower === "lint passes" ||
    lower === "lint must pass"
  ) {
    return {
      type: "LINT",
      raw,
    };
  }

  const fileMatch =
    raw.match(
      /^FILE EXISTS:\s*(.+)$/i
    );

  if (fileMatch) {
    const path =
      safePath(
        fileMatch[1]
      );

    if (path) {
      return {
        type: "FILE_EXISTS",
        raw,
        path,
      };
    }
  }

  const containsMatch =
    raw.match(
      /^FILE CONTAINS:\s*(.+?)\s*::\s*(.+)$/i
    );

  if (containsMatch) {
    const path =
      safePath(
        containsMatch[1]
      );

    const value =
      containsMatch[2].trim();

    if (
      path &&
      value
    ) {
      return {
        type:
          "CONTENT_CONTAINS",
        raw,
        path,
        value,
      };
    }
  }

  if (
    lower.startsWith(
      "readme contains:"
    )
  ) {
    const value =
      raw
        .slice(
          "README contains:".length
        )
        .trim();

    if (value) {
      return {
        type:
          "CONTENT_CONTAINS",
        raw,
        path:
          "README.md",
        value,
      };
    }
  }

  if (
    lower ===
    "existing readme content is preserved"
  ) {
    return {
      type:
        "CONTENT_PRESERVED",
      raw,
      path:
        "README.md",
    };
  }

  return {
    type: "UNSUPPORTED",
    raw,
  };
}
