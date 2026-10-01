import path from "node:path";
import { Document, Font, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

/**
 * PDF brief. Fonts are bundled (assets/fonts, SIL OFL) and cover Latin,
 * Azerbaijani (ə, ı, ğ, ş…) and Cyrillic. English hyphenation is disabled so
 * Azerbaijani and Russian words are never broken incorrectly; long URLs get
 * zero-width break opportunities instead.
 */

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let fontsRegistered = false;

export function registerPdfFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(FONT_DIR, "Inter_400Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "Inter_400Regular_Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: path.join(FONT_DIR, "Inter_500Medium.ttf"), fontWeight: 500 },
      { src: path.join(FONT_DIR, "Inter_600SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "Inter_700Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "SourceSerif",
    fonts: [
      { src: path.join(FONT_DIR, "SourceSerif4_400Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "SourceSerif4_400Regular_Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: path.join(FONT_DIR, "SourceSerif4_600SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

/** Break opportunities for long tokens (URLs, identifiers) without visible hyphens. */
export function soft(text: string): string {
  return text
    .replace(/([/.?&=_\-:@])/g, "$1​")
    .replace(/(\S{28})(?=\S)/g, "$1​");
}

export type BriefRow = { title: string; subtitle?: string | null; period?: string | null; refs: number[]; flags: string[] };

export type BriefData = {
  fictional: boolean;
  generatedAt: string;
  labels: Record<string, string>;
  pageLabel: (page: number, total: number) => string;
  person: { name: string; nativeName: string | null; headline: string | null; location: string | null; roleNote: string | null };
  meta: { researched: string; snapshot: string; sources: string; partial: boolean; identity: string };
  summary: { text: string; refs: number[]; inferred: boolean }[];
  chronology: BriefRow[];
  education: BriefRow[];
  affiliations: BriefRow[];
  contacts: { type: string; value: string; owner: string; purpose: string | null; refs: number[]; direct: boolean }[];
  accounts: { platform: string; handle: string; url: string; how: string; refs: number[] }[];
  possibleAccountsNote: string | null;
  connections: { name: string; label: string; detail: string | null; refs: number[]; shared: boolean }[];
  developments: { date: string; text: string }[];
  media: { headline: string; outlet: string; date: string; summary: string; meta: string | null; refs: number[] }[];
  gaps: string[];
  questions: string[];
  sources: { n: number; title: string; publisher: string; href: string; displayUrl: string; date: string; accessed: string; note: string | null }[];
};

const INK = "#141b2b";
const MUTED = "#5d6676";
const LINE = "#e4dfd3";
const ACCENT = "#2c56c9";
const DEMO = "#7a4b00";

const s = StyleSheet.create({
  page: { paddingTop: 64, paddingBottom: 58, paddingHorizontal: 52, fontFamily: "Inter", fontSize: 9.5, color: INK, lineHeight: 1.45 },
  header: { position: "absolute", top: 26, left: 52, right: 52, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED, borderBottomWidth: 0.5, borderBottomColor: LINE, paddingBottom: 6 },
  footer: { position: "absolute", bottom: 26, left: 52, right: 52, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED },
  demoBanner: { backgroundColor: "#fff1d6", borderWidth: 0.75, borderColor: "#f0d29a", color: DEMO, padding: 8, borderRadius: 3, fontSize: 8.5, fontWeight: 600, marginBottom: 14 },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.2, textTransform: "uppercase", color: MUTED, fontWeight: 600 },
  name: { fontFamily: "SourceSerif", fontSize: 26, fontWeight: 600, marginTop: 4, lineHeight: 1.15 },
  native: { fontFamily: "SourceSerif", fontSize: 13, color: MUTED, marginTop: 2 },
  headline: { fontSize: 11.5, marginTop: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, paddingVertical: 6, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: LINE, fontSize: 8, color: MUTED, gap: 10 },
  h2: { fontFamily: "SourceSerif", fontSize: 14, fontWeight: 600, marginTop: 18, marginBottom: 6 },
  para: { fontFamily: "SourceSerif", fontSize: 11, lineHeight: 1.55, marginBottom: 5 },
  inferred: { fontFamily: "SourceSerif", fontStyle: "italic", color: "#3b4456" },
  ref: { color: ACCENT, fontSize: 7.5, textDecoration: "none" },
  row: { flexDirection: "row", paddingVertical: 4.5, borderBottomWidth: 0.5, borderBottomColor: LINE },
  rowPeriod: { width: 104, color: MUTED, fontSize: 8.5, paddingRight: 8 },
  rowBody: { flex: 1 },
  rowTitle: { fontWeight: 600, fontSize: 10 },
  rowSub: { color: "#2b3445" },
  flag: { fontSize: 7.5, color: "#9a6512", marginTop: 1 },
  note: { fontSize: 8, color: MUTED, marginTop: 4 },
  list: { marginTop: 2 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 10, color: MUTED },
  source: { flexDirection: "row", paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: LINE },
  sourceN: { width: 22, color: ACCENT, fontWeight: 600, fontSize: 8.5 },
  link: { color: ACCENT, textDecoration: "none", fontSize: 8 },
});

function Refs({ refs }: { refs: number[] }) {
  if (refs.length === 0) return null;
  return (
    <>
      {refs.slice(0, 6).map((n) => (
        <Link key={n} src={`#ref-${n}`} style={s.ref}>
          {` [${n}]`}
        </Link>
      ))}
    </>
  );
}

function Rows({ rows, empty }: { rows: BriefRow[]; empty: string }) {
  if (rows.length === 0) return <Text style={s.note}>{empty}</Text>;
  return (
    <View>
      {rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          <Text style={s.rowPeriod}>{r.period ?? ""}</Text>
          <View style={s.rowBody}>
            <Text style={s.rowTitle}>
              {soft(r.title)}
              <Refs refs={r.refs} />
            </Text>
            {r.subtitle ? <Text style={s.rowSub}>{soft(r.subtitle)}</Text> : null}
            {r.flags.length > 0 ? <Text style={s.flag}>{r.flags.join(" · ")}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={s.list}>
      {items.map((t, i) => (
        <View key={i} style={s.bullet} wrap={false}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={{ flex: 1 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

export function BriefDocument({ data }: { data: BriefData }) {
  const L = data.labels;
  return (
    <Document title={`${data.person.name} — PersonBrief`} author="PersonBrief" subject={data.fictional ? "Fictional demo brief" : "Professional meeting brief"} creator="PersonBrief" producer="PersonBrief" language="en">
      <Page size="A4" style={s.page} wrap>
        <View style={s.header} fixed>
          <Text>
            PersonBrief · {data.person.name}
            {data.fictional ? " · FICTIONAL DEMO" : ""}
          </Text>
          <Text>{data.meta.researched}</Text>
        </View>
        <View style={s.footer} fixed>
          <Text>{L.private}</Text>
          <Text render={({ pageNumber, totalPages }) => data.pageLabel(pageNumber, totalPages)} />
        </View>

        {data.fictional ? <Text style={s.demoBanner}>{L.fictionalBanner}</Text> : null}

        <Text style={s.eyebrow}>{L.title}</Text>
        <Text style={s.name}>{data.person.name}</Text>
        {data.person.nativeName ? <Text style={s.native}>{data.person.nativeName}</Text> : null}
        {data.person.headline ? <Text style={s.headline}>{data.person.headline}</Text> : null}
        {data.person.roleNote ? <Text style={s.flag}>{data.person.roleNote}</Text> : null}
        {data.person.location ? <Text style={{ color: MUTED, marginTop: 2 }}>{data.person.location}</Text> : null}
        <View style={s.metaRow}>
          <Text>{data.meta.researched}</Text>
          <Text>{data.meta.snapshot}</Text>
          <Text>{data.meta.sources}</Text>
        </View>
        <Text style={s.note}>
          {L.identity}: {data.meta.identity}
        </Text>
        {data.meta.partial ? <Text style={[s.flag, { marginTop: 6 }]}>{L.partial}</Text> : null}

        <Text style={s.h2}>{L.summary}</Text>
        {data.summary.length === 0 ? <Text style={s.note}>—</Text> : null}
        {data.summary.map((p, i) => (
          <Text key={i} style={[s.para, p.inferred ? s.inferred : {}]}>
            {p.inferred ? `[${L.inferred}] ` : ""}
            {p.text}
            <Refs refs={p.refs} />
          </Text>
        ))}

        <Text style={s.h2}>{L.chronology}</Text>
        <Rows rows={data.chronology} empty="—" />

        <Text style={s.h2}>{L.education}</Text>
        <Rows rows={data.education} empty="—" />

        {data.affiliations.length > 0 ? (
          <>
            <Text style={s.h2}>{L.affiliations}</Text>
            <Rows rows={data.affiliations} empty="—" />
          </>
        ) : null}

        <Text style={s.h2} minPresenceAhead={60}>
          {L.contacts}
        </Text>
        {data.contacts.length === 0 ? <Text style={s.note}>{L.contactsNone}</Text> : null}
        {data.contacts.map((c, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.rowPeriod}>{c.type}</Text>
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>
                {soft(c.value)}
                <Refs refs={c.refs} />
              </Text>
              <Text style={s.rowSub}>
                {c.owner}
                {c.direct ? "" : ` (${L.notDirect})`}
              </Text>
              {c.purpose ? <Text style={s.note}>{c.purpose}</Text> : null}
            </View>
          </View>
        ))}

        {data.accounts.length > 0 || data.possibleAccountsNote ? (
          <>
            <Text style={s.h2} minPresenceAhead={60}>
              {L.accounts}
            </Text>
            {data.accounts.map((a, i) => (
              <View key={i} style={s.row} wrap={false}>
                <Text style={s.rowPeriod}>{a.platform}</Text>
                <View style={s.rowBody}>
                  <Text style={s.rowTitle}>
                    {soft(a.handle)}
                    <Refs refs={a.refs} />
                  </Text>
                  <Text style={s.note}>
                    {soft(a.url)} · {a.how}
                  </Text>
                </View>
              </View>
            ))}
            {data.possibleAccountsNote ? <Text style={s.note}>{data.possibleAccountsNote}</Text> : null}
          </>
        ) : null}

        <Text style={s.h2} minPresenceAhead={60}>
          {L.connections}
        </Text>
        {data.connections.length === 0 ? <Text style={s.note}>{L.connectionsNone}</Text> : null}
        {data.connections.map((c, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.rowPeriod}>{c.label}</Text>
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>
                {c.name}
                <Refs refs={c.refs} />
              </Text>
              {c.detail ? <Text style={s.rowSub}>{c.detail}</Text> : null}
            </View>
          </View>
        ))}
        {data.connections.some((c) => c.shared) ? <Text style={s.note}>{L.sharedNote}</Text> : null}

        <Text style={s.h2} minPresenceAhead={60}>
          {L.media}
        </Text>
        {data.developments.length > 0 ? (
          <>
            <Text style={[s.eyebrow, { marginBottom: 4 }]}>{L.developments}</Text>
            {data.developments.map((d, i) => (
              <View key={i} style={s.row} wrap={false}>
                <Text style={s.rowPeriod}>{d.date}</Text>
                <Text style={s.rowBody}>{d.text}</Text>
              </View>
            ))}
          </>
        ) : null}
        {data.media.length === 0 ? <Text style={s.note}>{L.mediaNone}</Text> : null}
        {data.media.map((m, i) => (
          <View key={i} style={{ marginTop: 8 }} wrap={false}>
            <Text style={{ fontSize: 8, color: MUTED }}>
              {m.outlet} · {m.date}
            </Text>
            <Text style={{ fontFamily: "SourceSerif", fontSize: 11, fontWeight: 600 }}>
              {soft(m.headline)}
              <Refs refs={m.refs} />
            </Text>
            <Text>{m.summary}</Text>
            {m.meta ? <Text style={s.note}>{m.meta}</Text> : null}
          </View>
        ))}

        {data.gaps.length > 0 ? (
          <>
            <Text style={s.h2} minPresenceAhead={40}>
              {L.gaps}
            </Text>
            <Bullets items={data.gaps} />
          </>
        ) : null}

        {data.questions.length > 0 ? (
          <>
            <Text style={s.h2} minPresenceAhead={40}>
              {L.questions}
            </Text>
            <Bullets items={data.questions} />
          </>
        ) : null}

        <Text style={s.h2} minPresenceAhead={40}>
          {L.caveats}
        </Text>
        <Bullets items={[L.caveat1, L.caveat2, L.caveat3, L.caveat4]} />

        <Text style={s.h2} break minPresenceAhead={40}>
          {L.references}
        </Text>
        {data.sources.map((src) => (
          <View key={src.n} id={`ref-${src.n}`} style={s.source} wrap={false}>
            <Text style={s.sourceN}>[{src.n}]</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 500 }}>{soft(src.title)}</Text>
              <Text style={{ color: MUTED, fontSize: 8 }}>
                {src.publisher} · {src.date} · {src.accessed}
              </Text>
              <Link src={src.href} style={s.link}>
                {soft(src.displayUrl)}
              </Link>
              {src.note ? <Text style={{ color: MUTED, fontSize: 7.5 }}>{src.note}</Text> : null}
            </View>
          </View>
        ))}
        <Text style={[s.note, { marginTop: 10 }]}>{data.generatedAt}</Text>
      </Page>
    </Document>
  );
}
