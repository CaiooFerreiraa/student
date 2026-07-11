import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownContent({ children }: { children: string }) {
  return (
    <div className="space-y-3 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={["img"]}
        components={{
          h1: ({ children: content }) => <h1 className="text-lg font-bold text-navy">{content}</h1>,
          h2: ({ children: content }) => <h2 className="text-base font-bold text-navy">{content}</h2>,
          h3: ({ children: content }) => <h3 className="font-bold text-navy">{content}</h3>,
          p: ({ children: content }) => <p>{content}</p>,
          strong: ({ children: content }) => <strong className="font-bold text-navy">{content}</strong>,
          ul: ({ children: content }) => <ul className="ml-5 list-disc space-y-1">{content}</ul>,
          ol: ({ children: content }) => <ol className="ml-5 list-decimal space-y-1">{content}</ol>,
          li: ({ children: content }) => <li className="pl-1">{content}</li>,
          blockquote: ({ children: content }) => <blockquote className="border-l-2 border-blue-300 pl-3 text-slate-600">{content}</blockquote>,
          a: ({ children: content, href }) => <a href={href} target="_blank" rel="noreferrer noopener" className="font-medium text-blue-600 underline underline-offset-2">{content}</a>,
          code: ({ children: content }) => <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-slate-800">{content}</code>,
          pre: ({ children: content }) => <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{content}</pre>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
