// Card text: blank lines separate paragraphs, single newlines stay line breaks,
// and [text](https://url) renders as a link. Built as React nodes (no HTML
// injection); only http(s) links are recognised.
const LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g

function inline(text) {
  const out = []
  let last = 0
  for (const m of text.matchAll(LINK)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      <a key={m.index} href={m[2]} target="_blank" rel="noopener noreferrer">
        {m[1]}
      </a>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export default function RichText({ text, className }) {
  const paragraphs = String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  return (
    <div className={className}>
      {paragraphs.map((p, i) => (
        <p key={i}>{inline(p)}</p>
      ))}
    </div>
  )
}
