import type { ReactNode } from 'react';

interface SectionProps {
  id: string;
  title: ReactNode;
  intro: ReactNode;
  children: ReactNode;
}

/** A spread: the heading and its argument in the margin, the working material beside it. */
export function Section({ id, title, intro, children }: SectionProps) {
  return (
    <section className="section wrap" id={id} aria-labelledby={`${id}-title`}>
      <div className="section__margin">
        <h2 id={`${id}-title`} className="section__title">
          {title}
        </h2>
        <div className="section__intro">{intro}</div>
      </div>
      <div className="section__body">{children}</div>
    </section>
  );
}
