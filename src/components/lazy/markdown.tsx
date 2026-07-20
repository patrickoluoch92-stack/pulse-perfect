// Isolates react-markdown so it ships in a lazy chunk, off the initial
// concierge route bundle. Import only via `React.lazy(() => import(...))`.
import ReactMarkdown from "react-markdown";

export default function Markdown({ children }: { children: string }) {
  return <ReactMarkdown>{children}</ReactMarkdown>;
}
