/** Derived hints from the public demo URL — shown as metadata (not measured runtime). */

export type StreamDetails = {
  /** e.g. MP4, WebM, M4V */
  container: string;
  /** e.g. "1080p", "640×360" */
  resolutionHint: string | null;
  /** Short label for “how it’s delivered” */
  streamKind: string;
  /** Human-readable host / project */
  source: string;
  /** License blurb */
  license: string;
};

function lastPathSegment(url: string): string {
  try {
    const { pathname } = new URL(url);
    const seg = pathname.split("/").filter(Boolean);
    return decodeURIComponent(seg[seg.length - 1] ?? "") || pathname;
  } catch {
    return url;
  }
}

export function streamDetailsForUrl(url: string): StreamDetails {
  const u = url.toLowerCase();
  const file = lastPathSegment(url);

  if (u.includes("durian/trailer/sintel")) {
    let res: string | null = null;
    if (file.includes("1080p")) res = "1080p";
    else if (file.includes("720p")) res = "720p";
    else if (file.includes("480p")) res = "480p";
    return {
      container: "MP4",
      resolutionHint: res,
      streamKind: "Progressive download · trailer",
      source: "Blender Foundation · Project Durian",
      license: "Creative Commons Attribution 3.0",
    };
  }

  if (u.includes("peach/bigbuckbunny_movies")) {
    let res: string | null = null;
    if (file.includes("720p")) res = "720p";
    else if (file.includes("640")) res = "640×360";
    else if (file.includes("320")) res = "320×180";
    if (file.endsWith(".m4v")) {
      return {
        container: "M4V",
        resolutionHint: res,
        streamKind: "Progressive download · feature",
        source: "Blender Foundation · Peach Open Movie",
        license: "Creative Commons Attribution 3.0",
      };
    }
    if (file.endsWith(".mov")) {
      return {
        container: "MOV",
        resolutionHint: res,
        streamKind: "Progressive download · feature",
        source: "Blender Foundation · Peach Open Movie",
        license: "Creative Commons Attribution 3.0",
      };
    }
    return {
      container: "MP4",
      resolutionHint: res,
      streamKind: "Progressive download · feature",
      source: "Blender Foundation · Peach Open Movie",
      license: "Creative Commons Attribution 3.0",
    };
  }

  if (u.includes("w3schools") && file.includes("mov_bbb")) {
    return {
      container: "MP4",
      resolutionHint: "Demo clip",
      streamKind: "Progressive download",
      source: "W3Schools · HTML tutorial sample",
      license: "Educational sample (check host terms)",
    };
  }

  if (u.includes("cc0-videos/flower")) {
    const isWebm = file.endsWith(".webm");
    return {
      container: isWebm ? "WebM" : "MP4",
      resolutionHint: "Short CC0 clip",
      streamKind: "Progressive download",
      source: "MDN · interactive-examples (CC0)",
      license: "CC0 (public domain dedication)",
    };
  }

  if (u.includes("rabbit320")) {
    const isWebm = file.endsWith(".webm");
    return {
      container: isWebm ? "WebM" : "MP4",
      resolutionHint: "320px-wide demo",
      streamKind: "Progressive download",
      source: "MDN · learning-area samples",
      license: "Educational sample (check host terms)",
    };
  }

  if (u.includes("filesamples.com")) {
    let res: string | null = null;
    if (file.includes("960")) res = "960×540";
    else if (file.includes("640")) res = "640×360";
    return {
      container: "MP4",
      resolutionHint: res,
      streamKind: "Progressive download · test asset",
      source: "FileSamples · public sample files",
      license: "Sample file (verify host license)",
    };
  }

  return {
    container: file.match(/\.([a-z0-9]+)$/i)?.[1]?.toUpperCase() ?? "Video",
    resolutionHint: null,
    streamKind: "Progressive download",
    source: "Remote URL",
    license: "Verify terms at source host",
  };
}
