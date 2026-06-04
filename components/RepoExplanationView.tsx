"use client";

import type { ReactNode } from "react";

/** Lightweight markdown-ish renderer (no extra deps). */
export default function RepoExplanationView({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");

  return (
    <article className="repo-explanation">
      {lines.map((line, i) => {
        const trimmed = line.trimEnd();
        if (!trimmed) return <div key={i} className="repo-explanation-spacer" />;
        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={i} className="repo-explanation-h1">
              {trimmed.slice(2)}
            </h1>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={i} className="repo-explanation-h2">
              {trimmed.slice(3)}
            </h2>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={i} className="repo-explanation-h3">
              {trimmed.slice(4)}
            </h3>
          );
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={i} className="repo-explanation-quote">
              {trimmed.slice(2)}
            </blockquote>
          );
        }
        if (trimmed.startsWith("```")) {
          return (
            <pre key={i} className="repo-explanation-code">
              {trimmed.replace(/^```\w*\n?/, "").replace(/```$/, "")}
            </pre>
          );
        }
        if (trimmed.startsWith("|")) {
          return (
            <pre key={i} className="repo-explanation-table">
              {trimmed}
            </pre>
          );
        }
        if (trimmed.startsWith("- ")) {
          return (
            <li key={i} className="repo-explanation-li">
              {formatInline(trimmed.slice(2))}
            </li>
          );
        }
        return (
          <p key={i} className="repo-explanation-p">
            {formatInline(trimmed)}
          </p>
        );
      })}
    </article>
  );
}

function formatInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="repo-explanation-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
