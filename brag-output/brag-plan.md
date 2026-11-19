# Inkshift: brag plan

**What it is:** a small library for switching a site between light and dark mode. When you press the toggle, ink spreads from that exact point across the whole page, and a second press pulls the ink back.
**Who it's for:** front-end developers who want their theme toggle to be the nicest moment on the page.
**What sets it apart:** it isn't a circular ripple. Each splat has tendrils and droplets, the animation can be reversed mid-flight, and there's a smoke mode. About 6 kB gzipped, no runtime dependencies.
**Hook:** the first press. Within the first second, ink floods the real demo page from the toggle.
**Angle:** show the thing. Every page shot is the real demo, running the library from source, with each frame captured exactly by pausing the ink's own Web Animation and stepping `currentTime`.
**Tone:** `polished`: a printed journal on warm paper, with no gimmicks.
**Visual identity:** paper `#f2eee6`, charcoal `#16161a`, accent `#8f5b0e` / `#e0a84f`. Fraunces (headlines, italic captions), Instrument Sans (body), JetBrains Mono (install command). All of these come from the project.
**Share caption:** see share-copy.txt.

## Music
120 BPM (one beat is 0.5 s), 4/4, A minor / C major: a soft Rhodes-style chord bed, a round bass, a soft kick and brushed hats. Every cut falls on a beat. Ink sounds are soft filtered-noise swells tuned to the key, sitting under the music.

## Storyboard (22.0 s, 1920×1080, 30 fps)

| # | Time | Scene | What happens |
|---|---|---|---|
| 1 | 0.0–4.0 | **Hook**: demo hero, light | The cursor glides to the drop and presses it at 0.5 s. Ink floods the page at real speed (1.1 s), and the dark hero holds: "Let the other theme *bleed* through." The camera pushes in slowly. |
| 2 | 4.0–6.5 | **Reveal**: title card, dark | "Inkshift" in big Fraunces, then "An ink-bleed theme switch." (the project's own tagline) |
| 3 | 6.5–10.5 | **Highlight 1**: "Press anywhere on the sheet.", dark | The cursor presses off-centre on the sheet at 7.0 s. The light theme spreads from that point at 0.7× speed so the tendrils and droplets read. |
| 4 | 10.5–14.5 | **Highlight 2**: reversal, hero, dark | Press at 11.0 s; the ink runs about 45%. Second press at 11.5 s, and the ink pulls back the way it came. Caption: "Press again before it lands. The ink pulls back." |
| 5 | 14.5–18.0 | **Highlight 3**: "Or let it drift like smoke.", light | The Smoke preset is selected, and a press at 15.0 s lets the dark theme roll in as smoke (real 2 s). |
| 6 | 18.0–22.0 | **Outro**: dark card | Inkshift, `npm install inkshift`, "About 6 kB gzipped · no runtime dependencies · React or plain JS", github.com/lloydaq/inkshift |

No personal data appears on screen. The demo shows no records, and the only things on the page are the project's own name and repository URL.
