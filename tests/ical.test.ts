import { describe, it, expect } from "vitest";
import { parseICS, buildICS, type ICSEvent } from "@/lib/ical";

const sample = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:abc-123
SUMMARY:Reserved (Airbnb)
DTSTART;VALUE=DATE:20260101
DTEND;VALUE=DATE:20260105
END:VEVENT
BEGIN:VEVENT
UID:def-456
DTSTART;VALUE=DATE:20260210
DTEND;VALUE=DATE:20260212
END:VEVENT
END:VCALENDAR
`.replace(/\n/g, "\r\n");

describe("parseICS", () => {
  it("parses VEVENT blocks with date-only fields", () => {
    const events = parseICS(sample);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      uid: "abc-123",
      summary: "Reserved (Airbnb)",
      startsOn: "2026-01-01",
      endsOn: "2026-01-05",
    });
    expect(events[1].summary).toBeNull();
  });

  it("ignores incomplete events", () => {
    const broken = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    expect(parseICS(broken)).toHaveLength(0);
  });

  it("handles line folding (continuation lines)", () => {
    const folded = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:fold-1",
      "SUMMARY:Long sum",
      " mary text",
      "DTSTART;VALUE=DATE:20260301",
      "DTEND;VALUE=DATE:20260302",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const [ev] = parseICS(folded);
    expect(ev.summary).toBe("Long summary text");
  });

  it("accepts datetime DTSTART values", () => {
    const dt = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:dt-1",
      "DTSTART:20260601T120000Z",
      "DTEND:20260603T120000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const [ev] = parseICS(dt);
    expect(ev.startsOn).toBe("2026-06-01");
    expect(ev.endsOn).toBe("2026-06-03");
  });
});

describe("buildICS", () => {
  const events: ICSEvent[] = [
    { uid: "u1", summary: "Booked", startsOn: "2026-04-10", endsOn: "2026-04-12" },
    { uid: "u2", summary: null, startsOn: "2026-05-01", endsOn: "2026-05-02" },
  ];

  it("emits well-formed VCALENDAR with CRLF line endings", () => {
    const out = buildICS({ prodId: "-//HostPulse//EN", calName: "Cal", events });
    expect(out).toContain("BEGIN:VCALENDAR\r\n");
    expect(out).toContain("PRODID:-//HostPulse//EN");
    expect(out).toContain("X-WR-CALNAME:Cal");
    expect(out.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("round-trips through parseICS", () => {
    const out = buildICS({ prodId: "-//x//EN", calName: "C", events });
    const parsed = parseICS(out);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].uid).toBe("u1");
    expect(parsed[0].startsOn).toBe("2026-04-10");
    expect(parsed[0].endsOn).toBe("2026-04-12");
  });

  it("strips newlines from SUMMARY", () => {
    const out = buildICS({
      prodId: "-//x//EN",
      calName: "C",
      events: [{ uid: "n", summary: "line1\nline2", startsOn: "2026-04-10", endsOn: "2026-04-11" }],
    });
    expect(out).toMatch(/SUMMARY:line1 line2/);
  });

  it("omits SUMMARY when null", () => {
    const out = buildICS({
      prodId: "-//x//EN",
      calName: "C",
      events: [{ uid: "n", summary: null, startsOn: "2026-04-10", endsOn: "2026-04-11" }],
    });
    expect(out).not.toMatch(/SUMMARY:/);
  });
});
