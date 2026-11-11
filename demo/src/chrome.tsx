import { ThemeToggle } from 'inkshift/react';
import { GITHUB_URL, NPM_URL, PUBLISHED_ON_NPM } from './links';
import { ArrowUpRight } from './icons';

export function Masthead() {
  return (
    <header className="masthead">
      <div className="wrap masthead__bar">
        <a className="wordmark" href="#top">
          Inkshift
        </a>
        <nav aria-label="Sections" className="masthead__nav">
          <a href="#try">Try it</a>
          <a href="#reverse">Reversal</a>
          <a href="#configure">Configure</a>
          <a href="#install">Install</a>
          <a href={GITHUB_URL}>GitHub</a>
        </nav>
        <ThemeToggle className="masthead__toggle" />
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__inner">
        <p className="footer__line">
          Inkshift is MIT licensed. The ink was first spilled on{' '}
          <a href="https://github.com/lloydaq/lloyd-portfolio">Lloyd D’Souza’s portfolio</a>.
        </p>
        <ul className="footer__links">
          <li>
            <a href={GITHUB_URL}>
              Source on GitHub <ArrowUpRight />
            </a>
          </li>
          <li>
            {PUBLISHED_ON_NPM ? (
              <a href={NPM_URL}>
                npm package <ArrowUpRight />
              </a>
            ) : (
              <span className="footer__pending">npm package: first release pending</span>
            )}
          </li>
        </ul>
      </div>
    </footer>
  );
}
