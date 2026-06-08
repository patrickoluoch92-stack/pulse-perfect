// Minimal RFC5545 reader/writer for VEVENT date blocks.
// We only handle the fields needed for Airbnb/VRBO availability feeds:
// VEVENT with UID, SUMMARY, DTSTART;VALUE=DATE, DTEND;VALUE=DATE.

export type ICSEvent = {
  uid: string;
  summary: string | null;
  startsOn: string; // YYYY-MM-DD
  endsOn: string;   // YYYY-MM-DD (exclusive)
};

function unfoldLines(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseDateValue(v: string): string | null {
  // Accept YYYYMMDD or YYYYMMDDTHHMMSS(Z)
  const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseICS(text: string): ICSEvent[] {
  const lines = unfoldLines(text);
  const events: ICSEvent[] = [];
  let cur: Partial<ICSEvent> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur && cur.uid && cur.startsOn && cur.endsOn) {
        events.push({
          uid: cur.uid,
          summary: cur.summary ?? null,
          startsOn: cur.startsOn,
          endsOn: cur.endsOn,
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const name = head.split(";")[0].toUpperCase();
    if (name === "UID") cur.uid = value.trim();
    else if (name === "SUMMARY") cur.summary = value.trim();
    else if (name === "DTSTART") cur.startsOn = parseDateValue(value) ?? undefined;
    else if (name === "DTEND") cur.endsOn = parseDateValue(value) ?? undefined;
  }
  return events;
}

function dateOnly(s: string): string {
  return s.replace(/-/g, "");
}

function fold(line: string): string {
  // 75-octet line folding (approximate via chars).
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    parts.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
    i += 73;
  }
  return parts.join("\r\n");
}

export function buildICS(opts: {
  prodId: string;
  calName: string;
  events: ICSEvent[];
}): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${opts.prodId}`,
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${opts.calName}`,
  ];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  for (const e of opts.events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.startsOn)}`);
    lines.push(`DTEND;VALUE=DATE:${dateOnly(e.endsOn)}`);
    if (e.summary) lines.push(`SUMMARY:${e.summary.replace(/[\r\n]+/g, " ")}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
