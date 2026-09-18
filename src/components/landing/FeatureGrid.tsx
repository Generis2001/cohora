const productFeatures = [
  {
    icon: () => (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-white" aria-hidden="true">
        <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Creator profiles',
    description:
      'Each creator gets a public profile with a handle, bio, content, store items, and community access points.',
  },
  {
    icon: () => (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-white" aria-hidden="true">
        <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 5V4a2 2 0 0 1 4 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Subscriptions in USDC',
    description:
      'Fans subscribe with USDC on Arc and Cohora tracks access based on the active subscription state.',
  },
  {
    icon: () => (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-white" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 10h6M10 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Gated content',
    description:
      'Creators can publish exclusive posts, media, and downloads that unlock after payment or membership.',
  },
  {
    icon: () => (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-white" aria-hidden="true">
        <path d="M10 2L3 6v4c0 4 3.5 7 7 8 3.5-1 7-4 7-8V6l-7-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Paid communities',
    description:
      'Cohora lets creators open subscriber communities with entry fees and member-only participation.',
  },
  {
    icon: () => (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-white" aria-hidden="true">
        <path d="M4 4h12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 14v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'Digital products',
    description:
      'Creators can list and sell digital products alongside subscriptions from the same dashboard.',
  },
];

const workflow = [
  'Connect a wallet and create a creator profile.',
  'Set up subscriptions, community access, content, or digital products.',
  'Receive USDC payments and manage fans from Cohora.',
];

export function FeatureGrid() {
  return (
    <div className="px-6 pb-24">
      <div className="mx-auto max-w-6xl space-y-20">

        {/* ── Product section ── */}
        <section id="product" className="cohora-panel cohora-watermark overflow-hidden p-6 md:p-8" data-watermark="PRODUCT">
          <div className="relative z-10 space-y-8">
            <div className="max-w-3xl space-y-4">
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-white/[0.42]">What Cohora does</p>
              <h2 className="text-3xl font-semibold tracking-[-0.06em] text-white md:text-5xl">
                Cohora gives creators one place to publish, charge, and manage access.
              </h2>
              <p className="cohora-copy max-w-2xl">
                The platform combines creator onboarding, paid content, subscriptions, digital
                products, and member communities in one workflow built on Arc.
              </p>
            </div>

            {/* Feature list — bare, no card boxes */}
            <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-5">
              {productFeatures.map((feature) => (
                <div key={feature.title} className="space-y-3">
                  <feature.icon />
                  <h3 className="text-base font-medium text-white">{feature.title}</h3>
                  <p className="text-sm leading-6 text-white/[0.56]">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Experience section ── */}
        <section id="experience" className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">

          {/* How it works */}
          <div className="cohora-panel cohora-watermark p-6 md:p-8" data-watermark="ACCESS">
            <div className="relative z-10 space-y-8">
              <div className="space-y-3">
                <p className="text-[0.7rem] uppercase tracking-[0.22em] text-white/[0.42]">How it works</p>
                <h3 className="text-2xl font-semibold tracking-[-0.05em] text-white md:text-3xl">
                  Cohora connects wallet payments directly to creator access.
                </h3>
              </div>

              {/* Workflow steps — bare numbered list, no box */}
              <ol className="space-y-5">
                {workflow.map((step, index) => (
                  <li key={step} className="flex items-start gap-4 text-sm text-white/[0.66]">
                    <span className="shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/[0.32] pt-0.5">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="leading-6">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Who it's for */}
          <div id="workflow">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-white/[0.42]">Who Cohora is for</p>
            <ul className="mt-6 space-y-6">
              {[
                'Creators who want paid subscriber access in USDC.',
                'Communities that need wallet-based paid access on Arc.',
                'Fans who want one wallet flow for subscriptions, content, and products.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6 text-white/[0.62]">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/[0.30]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

      </div>
    </div>
  );
}
