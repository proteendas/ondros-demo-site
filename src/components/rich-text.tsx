/**
 * Renders an Ondros `richtext` field.
 *
 * The delivery API returns rich text as a **ProseMirror/TipTap JSON document**
 * — `{ type: "doc", content: [...] }` — not as an HTML string. Dropping that
 * value straight into `dangerouslySetInnerHTML` prints `[object Object]`.
 *
 * Content seeded as raw HTML still arrives as a string, and older spaces may
 * hold those too, so a string value is passed through as HTML. Anything an
 * author saves from the editor is a document.
 *
 * Nodes and marks below mirror the editor's schema. Unknown types render their
 * children rather than disappearing, so a field that gains a node type still
 * shows its text.
 */
import type { JSX, ReactNode } from "react";

import type { CmsEntry } from "@/lib/cms";

type Mark = { type: string; attrs?: Record<string, unknown> };

export type RichTextNode = {
  type?: string;
  content?: RichTextNode[];
  text?: string;
  marks?: Mark[];
  attrs?: Record<string, unknown>;
};

/** Resolves an embedded entry id against the `includes` of the same response. */
export type EntryResolver = (id: unknown) => CmsEntry | undefined;

function isDoc(value: unknown): value is RichTextNode {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as RichTextNode).type === "doc"
  );
}

function applyMarks(content: ReactNode, marks: Mark[] | undefined, key: string): ReactNode {
  if (!marks?.length) return content;
  return marks.reduce<ReactNode>((acc, mark, i) => {
    const k = `${key}-m${i}`;
    switch (mark.type) {
      case "bold":
        return <strong key={k}>{acc}</strong>;
      case "italic":
        return <em key={k}>{acc}</em>;
      case "underline":
        return <u key={k}>{acc}</u>;
      case "strike":
        return <s key={k}>{acc}</s>;
      case "code":
        return <code key={k}>{acc}</code>;
      case "textStyle":
        return (
          <span key={k} style={{ color: mark.attrs?.color as string | undefined }}>
            {acc}
          </span>
        );
      case "highlight":
        return (
          <mark key={k} style={{ background: (mark.attrs?.color as string) || undefined }}>
            {acc}
          </mark>
        );
      case "link":
        return (
          <a key={k} href={String(mark.attrs?.href ?? "#")}>
            {acc}
          </a>
        );
      default:
        return acc;
    }
  }, content);
}

function Nodes({
  nodes,
  resolve,
  keyPrefix,
}: {
  nodes: RichTextNode[];
  resolve?: EntryResolver;
  keyPrefix: string;
}) {
  return (
    <>
      {nodes.map((node, i) => (
        <Node
          key={`${keyPrefix}-${i}`}
          node={node}
          resolve={resolve}
          nodeKey={`${keyPrefix}-${i}`}
        />
      ))}
    </>
  );
}

function Node({
  node,
  resolve,
  nodeKey,
}: {
  node: RichTextNode;
  resolve?: EntryResolver;
  nodeKey: string;
}) {
  const kids = <Nodes nodes={node.content ?? []} resolve={resolve} keyPrefix={nodeKey} />;

  switch (node.type) {
    case "text":
      return <>{applyMarks(node.text ?? "", node.marks, nodeKey)}</>;
    case "hardBreak":
      return <br />;
    case "paragraph":
      return <p>{kids}</p>;
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 2), 1), 6);
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      return <Tag>{kids}</Tag>;
    }
    case "blockquote":
      return <blockquote>{kids}</blockquote>;
    case "bulletList":
      return <ul>{kids}</ul>;
    case "orderedList":
      return <ol>{kids}</ol>;
    case "listItem":
      return <li>{kids}</li>;
    case "codeBlock":
      return (
        <pre>
          <code>{kids}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr />;
    case "table":
      return (
        <table>
          <tbody>{kids}</tbody>
        </table>
      );
    case "tableRow":
      return <tr>{kids}</tr>;
    case "tableCell":
      return <td>{kids}</td>;
    case "tableHeader":
      return <th>{kids}</th>;
    case "embeddedEntryBlock": {
      // Resolvable only when the page asked for `include >= 1`. A real site
      // would switch on `entry.contentType.apiId` and render its component.
      const entry = resolve?.(node.attrs?.id);
      if (!entry) return null;
      const title =
        (entry.fields[entry.contentType.displayField] as string | undefined) ??
        entry.slug ??
        entry.contentType.name;
      return (
        <div
          data-ondros-resource={`entry:${entry.id}`}
          data-ondros-component={entry.contentType.apiId}
          className="not-prose my-6 border border-neutral-200 p-6 dark:border-white/10"
        >
          <p className="font-display text-xs font-semibold uppercase tracking-widest text-[#ed1515]">
            {entry.contentType.name}
          </p>
          <p className="mt-1 font-display text-lg font-bold uppercase text-black dark:text-white">
            {title}
          </p>
        </div>
      );
    }
    case "embeddedEntryInline": {
      const entry = resolve?.(node.attrs?.id);
      if (!entry) return null;
      const label =
        (entry.fields[entry.contentType.displayField] as string | undefined) ??
        entry.slug ??
        entry.id;
      return entry.slug ? (
        <a href={`/${entry.contentType.apiId}s/${entry.slug}`}>{label}</a>
      ) : (
        <>{label}</>
      );
    }
    default:
      return node.content ? <>{kids}</> : null;
  }
}

export default function RichText({
  value,
  resolve,
  className,
  ...rest
}: {
  value: unknown;
  resolve?: EntryResolver;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  if (isDoc(value)) {
    return (
      <div className={className} {...rest}>
        <Nodes nodes={value.content ?? []} resolve={resolve} keyPrefix="rt" />
      </div>
    );
  }

  // Legacy HTML string. Sanitize server-side if authors are untrusted.
  if (typeof value === "string") {
    return <div className={className} {...rest} dangerouslySetInnerHTML={{ __html: value }} />;
  }

  return null;
}
