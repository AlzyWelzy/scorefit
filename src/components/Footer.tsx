import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-28 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2 md:col-span-1">
          <Logo size={24} />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            The instrument panel for hypertrophy. Two 12-week programs, 53 exercises,
            every last set tracked.
          </p>
        </div>
        <FooterCol title="Train" links={[["/programs/beginner", "Beginner"], ["/programs/intermediate", "Intermediate / Advanced"], ["/exercises", "Exercise library"]]} />
        <FooterCol title="Learn" links={[["/guidebook", "Guidebook"], ["/guidebook/the-6-training-principles", "Training principles"], ["/guidebook/bodybuilding-nutrition", "Nutrition"], ["/guidebook/faq", "FAQ"]]} />
        <FooterCol title="Reference" links={[["/guidebook/muscle-anatomy-how-each-muscle-is-trained", "Anatomy"], ["/guidebook/bodybuilding-supplements", "Supplements"], ["/guidebook/references-clickable-in-the-original-guidebook", "References"]]} />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-5 py-5 text-xs text-faint sm:flex-row sm:items-center">
          <span className="tabular">scorefit.net</span>
          <span>Educational content. Consult a physician before starting any training program.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="eyebrow mb-3.5">{title}</h3>
      <ul className="space-y-2.5">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-muted transition-colors hover:text-fg">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
