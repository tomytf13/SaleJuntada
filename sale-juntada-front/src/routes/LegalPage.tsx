import privacy from "../legal/privacidad.md?raw";
import terms from "../legal/terminos.md?raw";
import { Link } from "react-router-dom";

function inline(text: string) {
  return text
    .split(/(\*\*.+?\*\*|turinglab\.ar@hotmail\.com)/g)
    .map((part, i) =>
      part.startsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : part === "turinglab.ar@hotmail.com" ? (
        <a key={i} href={`mailto:${part}`}>
          {part}
        </a>
      ) : (
        part
      ),
    );
}
export default function LegalPage({ policy }: { policy: "privacy" | "terms" }) {
  const content = policy === "privacy" ? privacy : terms;
  return (
    <main className="legal-document">
      <Link to="/">← Sale Juntada</Link>
      {content
        .trim()
        .split(/\n\s*\n/)
        .map((block, i) => {
          if (block.startsWith("# ")) return <h1 key={i}>{block.slice(2)}</h1>;
          if (block.startsWith("## ")) return <h2 key={i}>{block.slice(3)}</h2>;
          if (block.startsWith("- "))
            return (
              <ul key={i}>
                {block.split("\n").map((line) => (
                  <li key={line}>{inline(line.slice(2))}</li>
                ))}
              </ul>
            );
          return <p key={i}>{inline(block)}</p>;
        })}
    </main>
  );
}
