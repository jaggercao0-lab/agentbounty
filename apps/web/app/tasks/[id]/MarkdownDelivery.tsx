import { Fragment, type ReactNode } from "react";

type Props = {
  content: string;
};

function safeHref(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol)
      ? value
      : null;
  } catch {
    return null;
  }
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={key}>{token.slice(2, -2)}</strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code key={key}>{token.slice(1, -1)}</code>
      );
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      const href = linkMatch ? safeHref(linkMatch[2]) : null;

      nodes.push(
        href && linkMatch ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {linkMatch[1]}
          </a>
        ) : (
          <Fragment key={key}>{token}</Fragment>
        )
      );
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function isTableSeparator(line: string) {
  const cells = line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map(cell => cell.trim());

  return (
    cells.length > 0 &&
    cells.every(cell => /^:?-{3,}:?$/.test(cell))
  );
}

function tableCells(line: string) {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map(cell => cell.trim());
}

function startsBlock(lines: string[], index: number) {
  const line = lines[index] || "";
  const next = lines[index + 1] || "";

  return (
    !line.trim() ||
    /^#{1,6}\s+/.test(line) ||
    /^```/.test(line.trim()) ||
    /^>\s?/.test(line) ||
    /^[-*+]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    (line.includes("|") && isTableSeparator(next))
  );
}

export default function MarkdownDelivery({ content }: Props) {
  const normalized = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n?/g, "\n")
    .trim();

  if (!normalized) {
    return <div className="ab-markdown-delivery">—</div>;
  }

  const lines = normalized.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockIndex = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const children = renderInline(
        heading[2],
        `h-${blockIndex}`
      );
      const key = `block-${blockIndex++}`;

      if (level <= 2) {
        blocks.push(<h3 key={key}>{children}</h3>);
      } else {
        blocks.push(<h4 key={key}>{children}</h4>);
      }

      i += 1;
      continue;
    }

    if (/^```/.test(line.trim())) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i += 1;

      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i += 1;
      }

      if (i < lines.length) i += 1;

      blocks.push(
        <pre key={`block-${blockIndex++}`}>
          <code data-language={language || undefined}>
            {codeLines.join("\n")}
          </code>
        </pre>
      );
      continue;
    }

    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      i += 2;

      while (
        i < lines.length &&
        lines[i].trim() &&
        lines[i].includes("|")
      ) {
        rows.push(tableCells(lines[i]));
        i += 1;
      }

      blocks.push(
        <div
          className="ab-markdown-table-wrap"
          key={`block-${blockIndex++}`}
        >
          <table>
            <thead>
              <tr>
                {headers.map((cell, cellIndex) => (
                  <th key={cellIndex}>
                    {renderInline(cell, `th-${blockIndex}-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map((_, cellIndex) => (
                    <td key={cellIndex}>
                      {renderInline(
                        row[cellIndex] || "",
                        `td-${blockIndex}-${rowIndex}-${cellIndex}`
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s+/, ""));
        i += 1;
      }

      blocks.push(
        <ul key={`block-${blockIndex++}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>
              {renderInline(item, `ul-${blockIndex}-${itemIndex}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i += 1;
      }

      blocks.push(
        <ol key={`block-${blockIndex++}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>
              {renderInline(item, `ol-${blockIndex}-${itemIndex}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }

      blocks.push(
        <blockquote key={`block-${blockIndex++}`}>
          {renderInline(quote.join(" "), `quote-${blockIndex}`)}
        </blockquote>
      );
      continue;
    }

    const paragraph: string[] = [line.trim()];
    i += 1;

    while (i < lines.length && !startsBlock(lines, i)) {
      paragraph.push(lines[i].trim());
      i += 1;
    }

    blocks.push(
      <p key={`block-${blockIndex++}`}>
        {renderInline(paragraph.join(" "), `p-${blockIndex}`)}
      </p>
    );
  }

  return <div className="ab-markdown-delivery">{blocks}</div>;
}
