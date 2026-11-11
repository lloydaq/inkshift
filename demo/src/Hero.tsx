import { ThemeToggle } from 'inkshift/react';
import { CodeBlock } from './CodeBlock';
import { Splat } from './Splat';
import { GITHUB_URL } from './links';

export function Hero() {
  return (
    <section className="hero wrap" id="top" aria-labelledby="hero-title">
      <div className="hero__text">
        <h1 id="hero-title" className="hero__title">
          Let the other theme <em>bleed</em> through.
        </h1>
        <p className="hero__lede">
          Inkshift switches between light and dark with ink that spreads from wherever you press it, across the whole page.
          Press again before it lands and the ink pulls back.
        </p>
        <div className="hero__actions">
          <CodeBlock label="Terminal" code="npm install inkshift" />
          <a className="text-link" href={GITHUB_URL}>
            Read the source and docs
          </a>
        </div>
      </div>
      <div className="hero__art">
        <Splat seed={7} className="hero__splat" />
        <ThemeToggle className="hero__toggle" />
        <p className="hero__caption">Press the drop. Press it again, quickly.</p>
      </div>
    </section>
  );
}
