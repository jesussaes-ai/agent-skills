import { describe, expect, it } from "vitest";
import { detectarEnlace, duracionASegundos, idiomaWhisper, leerRss, vttASegmentos } from "./enlaces";
import { elegirSubtitulos } from "./medios-remotos";

describe("detectarEnlace", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s", "youtube-video"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube-video"],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", "youtube-video"],
    ["https://www.youtube.com/playlist?list=PL1234567890", "youtube-lista"],
    ["https://www.youtube.com/@canalDePrueba", "youtube-lista"],
    ["https://podcasts.apple.com/mx/podcast/algo/id1234567890", "apple-podcast"],
    ["https://open.spotify.com/show/abc", "spotify"],
    ["https://ejemplo.com/episodio-3.mp3?x=1", "audio"],
    ["https://feeds.ejemplo.com/programa", "podcast-rss"],
    ["https://anchor.fm/s/12345/podcast/rss", "podcast-rss"],
    ["https://es.wikipedia.org/wiki/Gematr%C3%ADa", "web"],
  ])("%s → %s", (url, tipo) => {
    expect(detectarEnlace(url)?.tipo).toBe(tipo);
  });

  it("normaliza el video a su dirección canónica y rechaza lo que no es http(s)", () => {
    expect(detectarEnlace("https://youtu.be/dQw4w9WgXcQ?si=xyz")).toMatchObject({ id: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(detectarEnlace("javascript:alert(1)")).toBeNull();
    expect(detectarEnlace("no es un enlace")).toBeNull();
  });
});

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
<title><![CDATA[Numerología al día]]></title><itunes:author>Ana Prueba</itunes:author><language>es-MX</language>
<item><title>Ep. 2 &amp; el número 9</title><pubDate>Tue, 07 Oct 2026 10:00:00 GMT</pubDate><itunes:duration>1:02:03</itunes:duration>
<enclosure url="https://cdn.ejemplo.com/ep2.mp3?a=1&amp;b=2" type="audio/mpeg" length="1"/><guid>ep2</guid></item>
<item><title>Sin audio</title></item>
<item><title>Ep. 1</title><itunes:duration>754</itunes:duration><enclosure url='https://cdn.ejemplo.com/ep1.mp3' type="audio/mpeg"/></item>
</channel></rss>`;

describe("leerRss", () => {
  it("lee el programa y solo los episodios con audio", () => {
    const p = leerRss(RSS);
    expect(p).toMatchObject({ titulo: "Numerología al día", autor: "Ana Prueba", idioma: "es" });
    expect(p.episodios).toEqual([
      { titulo: "Ep. 2 & el número 9", audio: "https://cdn.ejemplo.com/ep2.mp3?a=1&b=2", fecha: "2026-10-07", duracionSegundos: 3723, guid: "ep2" },
      { titulo: "Ep. 1", audio: "https://cdn.ejemplo.com/ep1.mp3", fecha: null, duracionSegundos: 754, guid: null },
    ]);
  });

  it("rechaza lo que no es un feed", () => {
    expect(() => leerRss("<html><body>hola</body></html>")).toThrow(/RSS/);
  });

  it("convierte duraciones", () => {
    expect(duracionASegundos("62:03")).toBe(3723);
    expect(duracionASegundos("abc")).toBeNull();
  });
});

describe("vttASegmentos", () => {
  // Los subtítulos automáticos de YouTube repiten la línea anterior al empezar la siguiente.
  const VTT = `WEBVTT
Kind: captions

00:00:01.000 --> 00:00:03.000
hola a <c>todos</c>

00:00:03.000 --> 00:00:05.000
hola a todos hoy hablamos

00:00:62.000 --> 00:01:05.000
del número nueve`.replace("00:00:62.000", "00:01:02.000");

  it("quita repeticiones y agrupa por minuto con enlace al segundo", () => {
    const s = vttASegmentos(VTT, { enlace: (seg) => `https://www.youtube.com/watch?v=x&t=${seg}s` });
    expect(s).toHaveLength(2);
    expect(s[0].texto).toBe("[00:01–00:05] hola a todos hoy hablamos");
    expect(s[0].localizador).toEqual({ marcaTiempo: "00:01–00:05", url: "https://www.youtube.com/watch?v=x&t=1s" });
    expect(s[1].texto).toBe("[01:02–01:05] del número nueve");
  });
});

describe("elegirSubtitulos", () => {
  it("prefiere los del autor en español, luego los automáticos del idioma original", () => {
    expect(elegirSubtitulos({ subtitles: { en: [], "es-419": [] }, automatic_captions: { es: [] }, language: "en" })).toEqual({ idioma: "es-419", automaticos: false });
    expect(elegirSubtitulos({ subtitles: {}, automatic_captions: { "es-orig": [], en: [] }, language: "es" })).toEqual({ idioma: "es-orig", automaticos: true });
    expect(elegirSubtitulos({ subtitles: { live_chat: [] }, automatic_captions: { fr: [] }, language: undefined })).toBeNull();
  });
});

describe("idiomaWhisper", () => {
  it("usa el idioma del podcast o del video y, si no se sabe, español", () => {
    expect(idiomaWhisper("en-us")).toBe("en");
    expect(idiomaWhisper("PT")).toBe("pt");
    expect(idiomaWhisper(null)).toBe("es");
    expect(idiomaWhisper("1x")).toBe("es");
  });
});
